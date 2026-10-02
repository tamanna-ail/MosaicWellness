import type { Metadata, Viewport } from "next";
import { Caveat, Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { loadSnapshot } from "@/lib/data/repository";
import { HealthProvider } from "@/components/providers/health-store";
import { UploadProvider } from "@/components/providers/upload-manager";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Cormorant_Garamond({ variable: "--font-serif-display", subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"] });
// Handwriting, used only to render scanned handwritten prescriptions in the document preview.
const hand = Caveat({ variable: "--font-hand", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "healthly", template: "%s · healthly" },
  description: "Your lifelong medical record, organised — with an AI companion that answers from your own documents.",
};

export const viewport: Viewport = { themeColor: "#f7f8f5" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // With a database the record is per-request; the demo dataset can be prerendered.
  if (process.env.DATABASE_URL) await connection();
  const { snapshot } = await loadSnapshot();

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full">
        <HealthProvider initial={snapshot}>
          <UploadProvider>
            <AppShell>{children}</AppShell>
          </UploadProvider>
        </HealthProvider>
      </body>
    </html>
  );
}
