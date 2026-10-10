# KAAMSETU — CLOUD DEPLOYMENT & ANDROID APK TESTING GUIDE

This guide walks you through deploying **KaamSetu** (Next.js 15 App Router + Prisma ORM + PostgreSQL) to **Render** and connecting your signed Android APK over the internet.

---

## 1. Architecture Overview

```
                                  INTERNET
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
      ┌────────▼────────┐                           ┌────────▼────────┐
      │ Android Release │                           │ Desktop / Mobile│
      │       APK       │                           │     Browser     │
      └────────┬────────┘                           └────────┬────────┘
               │  (HTTPS API & Web Assets)                   │
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │ Render Web Service  │
                           │ Next.js 15 (NodeJS) │
                           │ Port: $PORT         │
                           │ Health: /api/healthz│
                           └──────────┬──────────┘
                                      │
                           ┌──────────▼──────────┐
                           │ Managed PostgreSQL  │
                           │     (Render DB)     │
                           │  Prisma Migrations  │
                           └─────────────────────┘
```

- **Unified Deployment:** Frontend pages (`/home`, `/market`, `/profile`, etc.) and backend REST API (`/api/...`) are served by a single Next.js Node.js service. No separate frontend/backend deployments required.
- **Dual Persistence:** 
  - `DEMO_MODE=false`: Real production running on managed PostgreSQL via Prisma.
  - `DEMO_MODE=true`: In-memory demo store with JSON snapshot (for local/testing).
- **Android Connectivity:** The signed release APK (`builds/KaamSetu-release-signed.apk`) connects to the production HTTPS backend either via embedded configuration (`public/app-config.js`) or via the in-app **Server Settings** modal.

---

## 2. Prerequisites

1. **GitHub Account:** To push your code repository.
2. **Render Account:** [https://render.com](https://render.com) (free tier supported for testing).
3. **Android Device or Emulator:** To install and test `KaamSetu-release-signed.apk`.

---

## 3. Step 1: Push Code to GitHub

Ensure that private keystores (`*.jks`) and `keystore.properties` remain strictly ignored by Git (already configured in `.gitignore`).

Run from your project root:

```bash
# 1. Verify git status (confirm no keystores or secrets are tracked)
git status --short

# 2. Stage all project files
git add .

# 3. Commit
git commit -m "feat: prepare KaamSetu for Render cloud deployment and Android internet testing"

# 4. Create a repository on GitHub (e.g. github.com/your-username/kaamsetu) and link it:
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/kaamsetu.git
git branch -M main
git push -u origin main
```

---

## 4. Step 2: Deploy to Render (Automated via Blueprint)

KaamSetu includes a `render.yaml` Blueprint file that automatically creates both the **Web Service** and the **Managed PostgreSQL Database**.

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository: `<YOUR_GITHUB_USERNAME>/kaamsetu`.
4. Render will read `render.yaml` and show:
   - **kaamsetu-db**: Managed PostgreSQL instance (Region: Singapore / Oregon / Frankfurt).
   - **kaamsetu-web**: Web Service (Node.js runtime).
5. Click **Apply**.
6. Render will:
   - Provision the PostgreSQL database.
   - Run build: `npm install && npx prisma generate && npm run build`
   - Run start: `npx prisma migrate deploy && npm start`
   - Monitor health check: `/api/healthz`

### Manual Web Service Setup (Alternative without Blueprint)

If you prefer setting up manually on Render:
1. **Create Database:** Click **New +** → **PostgreSQL**.
   - Name: `kaamsetu-db`
   - Plan: Free
   - Copy the **Internal Database URL**.
2. **Create Web Service:** Click **New +** → **Web Service**.
   - Name: `kaamsetu-web`
   - Runtime: `Node`
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && npm start`
   - Health Check Path: `/api/healthz`

---

## 5. Step 3: Configure Production Environment Variables

In Render Dashboard → your Web Service → **Environment**, verify or set:

| Variable | Recommended Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations & secure cookies |
| `DEMO_MODE` | `false` | Enables real PostgreSQL persistence via Prisma |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Client-side indicator |
| `OTP_DEV_MODE` | `false` | Must be false in production |
| `DATABASE_URL` | `<from database>` | Automatically filled by Render Blueprint |
| `SESSION_SECRET` | `<32+ char secret>` | Generated automatically by Render |
| `NEXT_PUBLIC_APP_URL` | `https://kaamsetu-web.onrender.com` | Your assigned Render service URL |
| `STORAGE_PROVIDER` | `local` | Set to `s3` when connecting AWS S3 |
| `SMS_PROVIDER` | `console` | Set to `fast2sms`, `msg91`, or `twilio` with API key |
| `MAPS_PROVIDER` | `static` | Safe district centroid provider with privacy jitter |

Once saved, Render will redeploy and `/api/healthz` will return:
```json
{
  "status": "ok",
  "service": "kaamsetu-api",
  "version": "0.1.0",
  "mode": "production",
  "database": "connected"
}
```

---

## 6. Step 4: Configure the Android APK for Your Cloud URL

You have two simple ways to point your Android APK to your Render cloud deployment:

### Method A: In-App Server Settings (Zero Rebuild Required)

You can use the already-built signed APK (`builds/KaamSetu-release-signed.apk`):
1. Install and open the app on your Android device:
   ```bash
   adb install builds/KaamSetu-release-signed.apk
   ```
2. When the bridge screen appears ("Unable to reach KaamSetu server"):
3. Tap **Server Settings**.
4. Enter your Render HTTPS URL:
   ```text
   https://kaamsetu-web.onrender.com
   ```
5. Tap **Save & Connect**.
6. The app saves the URL in `localStorage` and connects over the internet!

---

### Method B: Pre-Configure Default Cloud URL in APK Build

To distribute an APK that connects directly to your cloud URL without requiring users to open Server Settings:

1. In your local terminal, run the configuration helper with your Render URL:
   ```bash
   npm run cap:sync-prod https://kaamsetu-web.onrender.com
   ```
   *(This updates `public/app-config.js` and synchronizes `android/app/src/main/assets/public/app-config.js`)*.

2. Recompile the signed release artifacts:
   ```powershell
   cd android
   .\gradlew assembleRelease bundleRelease
   cd ..
   ```

3. Copy the fresh signed artifacts:
   ```powershell
   Copy-Item android/app/build/outputs/apk/release/app-release.apk builds/KaamSetu-release-signed.apk -Force
   Copy-Item android/app/build/outputs/bundle/release/app-release.aab builds/KaamSetu-release-signed.aab -Force
   ```

---

## 7. Step 5: Test the Android APK Over the Internet

1. Disconnect your Android device from the local Wi-Fi / use mobile cellular data to ensure true internet connectivity.
2. Install the signed APK:
   ```bash
   adb install -r builds/KaamSetu-release-signed.apk
   ```
3. Open **KaamSetu**:
   - The app immediately connects to `https://kaamsetu-web.onrender.com`.
   - The landing / login screen loads live from your cloud server.
4. Test core flows:
   - **Register / Login:** Register a new user account with phone OTP or email.
   - **Professional Profiles:** Browse directory, filter by trade and district.
   - **Farmer OS:** Add a farm parcel, create crop cycle, log expenses.
   - **Marketplace:** View listings and buyer requirements.
   - **Theme & Offline:** Switch themes in Settings, verify smooth performance.

