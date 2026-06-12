import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "وكيل برو — WakilPro", template: "%s | WakilPro" },
  description: "منصة B2B خاصة تربط وكالات الاستقدام الخارجية بمكاتب الاستقدام المرخّصة. بالدعوة فقط.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plexArabic.variable}>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster richColors position="bottom-left" dir="rtl" theme="dark" />
      </body>
    </html>
  );
}
