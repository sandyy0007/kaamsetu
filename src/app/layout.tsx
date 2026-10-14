import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/layout/pwa-register";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/components/providers/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KaamSetu — Your Work. Your Identity. Your Opportunities.", template: "%s · KaamSetu" },
  description: "A professional network for skilled, independent and local professionals — farmers, electricians, carpenters, mechanics, drivers, tailors, artisans and more. Build your profile, show your work, find opportunities and learn. काम से पहचान, हुनर से अवसर।",
  applicationName: "KaamSetu",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f2ea",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="farm" data-mode="light" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/app-config.js" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
