-- KaamSetu Phase 2 — additive upgrade for a database created from the KisanSetu (Phase 1) schema.
--
-- ORDER (as required by the migration plan):
--   0. Take a backup first:            pg_dump "$DATABASE_URL" -Fc -f kisansetu-before-phase2.dump
--   1. Run this script (psql -f ... or `prisma db execute --file ...`).
--   2. It only ADDS: new enum values, new tables, and backfills ProfessionalProfile from FarmerProfile.
--      No existing table, column or row is dropped or rewritten.
--   3. Verify with the queries in the "VERIFY" section, then deploy the new application build.
--
-- ProfessionalProfile."userId" is the SAME id as "User"."id" and "FarmerProfile"."userId", so every
-- existing foreign key, link and conversation keeps pointing at the same person.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot be used in the same transaction as statements that USE the new value.
-- This script never uses a new enum value, so it is safe to run with `psql -1`.

-- ───────────────────────── enum additions ─────────────────────────
ALTER TYPE "Role"             ADD VALUE IF NOT EXISTS 'PROFESSIONAL';
ALTER TYPE "PostKind"         ADD VALUE IF NOT EXISTS 'WORK';
ALTER TYPE "PostKind"         ADD VALUE IF NOT EXISTS 'SKILL';
ALTER TYPE "PostKind"         ADD VALUE IF NOT EXISTS 'OPPORTUNITY';
ALTER TYPE "PostKind"         ADD VALUE IF NOT EXISTS 'TUTORIAL';
ALTER TYPE "PostKind"         ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TYPE "SavedTarget"      ADD VALUE IF NOT EXISTS 'PROFESSIONAL';
ALTER TYPE "SavedTarget"      ADD VALUE IF NOT EXISTS 'WORK';
ALTER TYPE "SavedTarget"      ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TYPE "CommunityKind"    ADD VALUE IF NOT EXISTS 'PROFESSION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SERVICE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WORK';
ALTER TYPE "VerificationKind" ADD VALUE IF NOT EXISTS 'PROFESSIONAL';
ALTER TYPE "VerificationKind" ADD VALUE IF NOT EXISTS 'BUSINESS';

-- ───────────────────────── new enums ─────────────────────────
CREATE TYPE "ModerationStatus"      AS ENUM ('ACTIVE', 'PENDING', 'REJECTED');
CREATE TYPE "AvailabilityStatus"    AS ENUM ('AVAILABLE', 'BUSY', 'OPEN_TO_WORK', 'NOT_AVAILABLE');
CREATE TYPE "ServicePriceType"      AS ENUM ('FIXED', 'HOURLY', 'DAILY', 'PER_VISIT', 'MONTHLY', 'NEGOTIABLE');
CREATE TYPE "ServiceRequestStatus"  AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'AWAITING_CONFIRMATION', 'COMPLETED');
CREATE TYPE "WorkOpportunityKind"   AS ENUM ('JOB', 'DAILY', 'CONTRACT', 'SEASONAL', 'FREELANCE', 'SERVICE_REQUEST', 'APPRENTICESHIP', 'TRAINING');
CREATE TYPE "WorkStatus"            AS ENUM ('OPEN', 'CLOSED', 'FILLED');
CREATE TYPE "ApplicationStatus"     AS ENUM ('APPLIED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "WorkKind"              AS ENUM ('EMPLOYMENT', 'SELF_EMPLOYED', 'FAMILY', 'INDEPENDENT', 'SEASONAL', 'CONTRACT', 'APPRENTICESHIP');

-- ───────────────────────── additive columns on existing tables ─────────────────────────
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "targetId" TEXT;
ALTER TABLE "Course"              ADD COLUMN IF NOT EXISTS "professionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Existing schemes keep an empty audience = "agriculture" (shown to farm users exactly as before).
ALTER TABLE "GovernmentScheme"    ADD COLUMN IF NOT EXISTS "audience" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "GovernmentScheme"    ADD COLUMN IF NOT EXISTS "topic" TEXT;

-- ───────────────────────── catalog ─────────────────────────
CREATE TABLE "ProfessionCategory" (
  "id"        TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "nameHi"    TEXT NOT NULL,
  "emoji"     TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isDemo"    BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "Profession" (
  "id"                TEXT PRIMARY KEY,
  "categoryId"        TEXT NOT NULL REFERENCES "ProfessionCategory"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  "name"              TEXT NOT NULL,
  "nameHi"            TEXT NOT NULL DEFAULT '',
  "emoji"             TEXT NOT NULL DEFAULT '',
  "synonyms"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "suggestedSkills"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "suggestedServices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "attributes"        JSONB NOT NULL DEFAULT '[]',
  "dashboard"         TEXT NOT NULL DEFAULT 'GENERAL',
  "farmModules"       BOOLEAN NOT NULL DEFAULT false,
  "status"            "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
  "custom"            BOOLEAN NOT NULL DEFAULT false,
  "createdBy"         TEXT,
  "isDemo"            BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "Profession_categoryId_status_idx" ON "Profession"("categoryId", "status");

CREATE TABLE "Skill" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "professionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"        "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
  "isDemo"        BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- Reference rows the backfill below needs. The full catalog (≈ 35 professions, ≈ 250 skills) is loaded by the
-- application on boot from src/server/seed/professions.ts (idempotent insert-if-missing by id).
INSERT INTO "ProfessionCategory" ("id","name","nameHi","emoji","sortOrder") VALUES
  ('pc_agri','Agriculture','कृषि','🌾',1),
  ('pc_trades','Skilled Trades','कुशल कारीगर','🛠️',2),
  ('pc_services','Services','सेवाएं','🧰',3),
  ('pc_artisan','Artisan','शिल्पकार','🏺',4),
  ('pc_tech','Technical','तकनीकी','🔌',5),
  ('pc_independent','Independent','स्वतंत्र','💼',6),
  ('pc_other','Other','अन्य','✨',7)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Profession" ("id","categoryId","name","nameHi","emoji","synonyms","dashboard","farmModules","status","custom")
VALUES ('pr_farmer','pc_agri','Farmer','किसान','🌾', ARRAY['kisan','krishak','agriculture','kheti'], 'FARMER', true, 'ACTIVE', false),
       ('pr_other','pc_other','Other','अन्य','✨', ARRAY['other','kuch aur'], 'GENERAL', false, 'ACTIVE', false)
ON CONFLICT ("id") DO NOTHING;

-- ───────────────────────── professional profile & work tables ─────────────────────────
CREATE TABLE "ProfessionalProfile" (
  "userId"                 TEXT PRIMARY KEY REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "professionId"           TEXT NOT NULL REFERENCES "Profession"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  "secondaryProfessionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "customProfession"       TEXT,
  "about"                  TEXT NOT NULL DEFAULT '',
  "startedYear"            INTEGER NOT NULL,
  "skills"                 JSONB NOT NULL DEFAULT '[]',
  "languages"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "attributes"             JSONB NOT NULL DEFAULT '{}',
  "village"                TEXT,
  "district"               TEXT NOT NULL DEFAULT '',
  "state"                  TEXT NOT NULL DEFAULT 'Rajasthan',
  "serviceRadiusKm"        INTEGER NOT NULL DEFAULT 25,
  "serviceAreas"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "availabilityStatus"     "AvailabilityStatus" NOT NULL DEFAULT 'OPEN_TO_WORK',
  "availability"           JSONB NOT NULL DEFAULT '{}',
  "certifications"         JSONB NOT NULL DEFAULT '[]',
  "achievements"           JSONB NOT NULL DEFAULT '[]',
  "privacy"                JSONB NOT NULL,
  "businessId"             TEXT,
  "isDemo"                 BOOLEAN NOT NULL DEFAULT false,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProfessionalProfile_professionId_idx" ON "ProfessionalProfile"("professionId");
CREATE INDEX "ProfessionalProfile_district_state_idx" ON "ProfessionalProfile"("district", "state");

CREATE TABLE "Service" (
  "id"           TEXT PRIMARY KEY,
  "ownerId"      TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "name"         TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "price"        INTEGER,
  "priceType"    "ServicePriceType" NOT NULL,
  "areas"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "availability" TEXT NOT NULL DEFAULT '',
  "media"        JSONB NOT NULL DEFAULT '[]',
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "hidden"       BOOLEAN NOT NULL DEFAULT false,
  "isDemo"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Service_ownerId_idx" ON "Service"("ownerId");

CREATE TABLE "ServiceRequest" (
  "id"             TEXT PRIMARY KEY,
  "serviceId"      TEXT NOT NULL REFERENCES "Service"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "providerId"     TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "requesterId"    TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "date"           TIMESTAMP(3) NOT NULL,
  "village"        TEXT,
  "district"       TEXT NOT NULL,
  "state"          TEXT NOT NULL,
  "description"    TEXT NOT NULL,
  "status"         "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
  "conversationId" TEXT,
  "isDemo"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ServiceRequest_providerId_status_idx"  ON "ServiceRequest"("providerId", "status");
CREATE INDEX "ServiceRequest_requesterId_status_idx" ON "ServiceRequest"("requesterId", "status");

CREATE TABLE "PortfolioEntry" (
  "id"          TEXT PRIMARY KEY,
  "ownerId"     TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "skillsUsed"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "media"       JSONB NOT NULL DEFAULT '[]',
  "imageUrl"    TEXT,
  "videoUrl"    TEXT,
  "meta"        JSONB,
  "hidden"      BOOLEAN NOT NULL DEFAULT false,
  "isDemo"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PortfolioEntry_ownerId_idx" ON "PortfolioEntry"("ownerId");

CREATE TABLE "WorkHistoryEntry" (
  "id"           TEXT PRIMARY KEY,
  "ownerId"      TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "role"         TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "kind"         "WorkKind" NOT NULL,
  "location"     TEXT NOT NULL DEFAULT '',
  "startDate"    TEXT NOT NULL,
  "endDate"      TEXT,
  "description"  TEXT NOT NULL DEFAULT '',
  "skills"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isDemo"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WorkHistoryEntry_ownerId_idx" ON "WorkHistoryEntry"("ownerId");

CREATE TABLE "Recommendation" (
  "id"                  TEXT PRIMARY KEY,
  "subjectId"           TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "authorId"            TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "relationship"        TEXT NOT NULL,
  "body"                TEXT NOT NULL,
  "skill"               TEXT,
  "interactionVerified" BOOLEAN NOT NULL DEFAULT false,
  "hidden"              BOOLEAN NOT NULL DEFAULT false,
  "isDemo"              BOOLEAN NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Recommendation_subjectId_authorId_key" ON "Recommendation"("subjectId", "authorId");

CREATE TABLE "WorkOpportunity" (
  "id"            TEXT PRIMARY KEY,
  "posterId"      TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "businessId"    TEXT,
  "title"         TEXT NOT NULL,
  "description"   TEXT NOT NULL,
  "kind"          "WorkOpportunityKind" NOT NULL,
  "professionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "skills"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "openings"      INTEGER NOT NULL DEFAULT 1,
  "village"       TEXT,
  "district"      TEXT NOT NULL,
  "state"         TEXT NOT NULL,
  "startDate"     TIMESTAMP(3),
  "mode"          TEXT NOT NULL DEFAULT 'ONSITE',
  "payMin"        INTEGER,
  "payMax"        INTEGER,
  "payUnit"       TEXT NOT NULL DEFAULT 'NEGOTIABLE',
  "duration"      TEXT,
  "contactMethod" TEXT NOT NULL DEFAULT 'IN_APP',
  "status"        "WorkStatus" NOT NULL DEFAULT 'OPEN',
  "hidden"        BOOLEAN NOT NULL DEFAULT false,
  "isDemo"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WorkOpportunity_status_district_idx" ON "WorkOpportunity"("status", "district");
CREATE INDEX "WorkOpportunity_posterId_idx" ON "WorkOpportunity"("posterId");

CREATE TABLE "WorkApplication" (
  "id"             TEXT PRIMARY KEY,
  "opportunityId"  TEXT NOT NULL REFERENCES "WorkOpportunity"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "applicantId"    TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "note"           TEXT NOT NULL DEFAULT '',
  "status"         "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
  "conversationId" TEXT,
  "isDemo"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WorkApplication_opportunityId_applicantId_key" ON "WorkApplication"("opportunityId", "applicantId");

CREATE TABLE "Business" (
  "id"            TEXT PRIMARY KEY,
  "ownerId"       TEXT NOT NULL REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "about"         TEXT NOT NULL,
  "services"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "professionIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "district"      TEXT NOT NULL,
  "state"         TEXT NOT NULL,
  "website"       TEXT,
  "verifiedAt"    TIMESTAMP(3),
  "verifiedBy"    TEXT,
  "hidden"        BOOLEAN NOT NULL DEFAULT false,
  "isDemo"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Business_ownerId_idx" ON "Business"("ownerId");
CREATE INDEX "Business_district_idx" ON "Business"("district");

-- ───────────────────────── BACKFILL: link every existing farmer (ids preserved) ─────────────────────────
-- Skill level is derived from years of farming; nothing is invented beyond what the farmer already entered.
INSERT INTO "ProfessionalProfile"
  ("userId","professionId","about","startedYear","skills","languages","village","district","state","serviceRadiusKm","serviceAreas",
   "certifications","achievements","privacy","isDemo","createdAt","updatedAt")
SELECT
  f."userId", 'pr_farmer', f."story", f."farmingSince",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('name', s, 'level',
            CASE WHEN EXTRACT(YEAR FROM now())::int - f."farmingSince" >= 10 THEN 'EXPERT'
                 WHEN EXTRACT(YEAR FROM now())::int - f."farmingSince" >= 4  THEN 'INTERMEDIATE' ELSE 'BEGINNER' END))
            FROM unnest(f."skills") AS s), '[]'::jsonb),
  f."languages", f."village", f."district", f."state", 25, ARRAY[f."district"],
  f."certifications", f."achievements", f."privacy", f."isDemo", u."createdAt", u."createdAt"
FROM "FarmerProfile" f
JOIN "User" u ON u."id" = f."userId"
ON CONFLICT ("userId") DO NOTHING;

-- One work-history line derived from "farming since" (self-employed on the family farm).
INSERT INTO "WorkHistoryEntry" ("id","ownerId","role","organization","kind","location","startDate","description","skills","isDemo","createdAt")
SELECT 'wh_mig_' || f."userId", f."userId", 'Farmer', 'Own / family farm', 'SELF_EMPLOYED',
       concat_ws(', ', NULLIF(f."village", ''), f."district"), f."farmingSince"::text || '-01', f."specialization",
       f."skills"[1:6], f."isDemo", u."createdAt"
FROM "FarmerProfile" f JOIN "User" u ON u."id" = f."userId"
ON CONFLICT ("id") DO NOTHING;

-- Buyers become businesses owned by the same user (FPOs likewise are added by the application's migrate step).
INSERT INTO "Business" ("id","ownerId","name","kind","about","services","professionIds","district","state","website","verifiedAt","verifiedBy","isDemo","createdAt")
SELECT 'biz_' || b."userId", b."userId", b."businessName", 'Buyer / trader', b."about",
       ARRAY(SELECT 'Buys ' || c FROM unnest(b."cropsPurchased") AS c), ARRAY[]::TEXT[], b."district", b."state", b."website",
       u."verifiedAt", u."verifiedBy", b."isDemo", u."createdAt"
FROM "BuyerProfile" b JOIN "User" u ON u."id" = b."userId"
ON CONFLICT ("id") DO NOTHING;

-- ───────────────────────── VERIFY (run manually; the first two must return 0 rows) ─────────────────────────
-- SELECT f."userId" FROM "FarmerProfile" f LEFT JOIN "ProfessionalProfile" p ON p."userId" = f."userId" WHERE p."userId" IS NULL;
-- SELECT p."userId" FROM "ProfessionalProfile" p LEFT JOIN "User" u ON u."id" = p."userId" WHERE u."id" IS NULL;
-- SELECT (SELECT count(*) FROM "FarmerProfile") AS farmers, (SELECT count(*) FROM "ProfessionalProfile" WHERE "professionId" = 'pr_farmer') AS linked;

-- ───────────────────────── ROLLBACK (only if the application has NOT been switched to Phase 2) ─────────────────────────
-- DROP TABLE "WorkApplication","WorkOpportunity","Recommendation","WorkHistoryEntry","PortfolioEntry","ServiceRequest","Service",
--            "ProfessionalProfile","Business","Skill","Profession","ProfessionCategory";
-- DROP TYPE "ModerationStatus","AvailabilityStatus","ServicePriceType","ServiceRequestStatus","WorkOpportunityKind","WorkStatus","ApplicationStatus","WorkKind";
-- ALTER TABLE "VerificationRequest" DROP COLUMN "targetId"; ALTER TABLE "Course" DROP COLUMN "professionIds";
-- ALTER TABLE "GovernmentScheme" DROP COLUMN "audience"; ALTER TABLE "GovernmentScheme" DROP COLUMN "topic";
-- (Enum values added with ADD VALUE are harmless and cannot be removed in PostgreSQL.)
