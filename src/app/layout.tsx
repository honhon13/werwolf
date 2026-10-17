import type { Metadata, Viewport } from "next";
import { Grenze_Gotisch, Nunito } from "next/font/google";
import "./globals.css";

const title = Grenze_Gotisch({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["600", "800"],
});

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Werwolf",
  description: "Das Werwolf-Spiel für die ganze Familie – jeder spielt auf seinem Handy.",
  // Setting icons here replaces the link Next.js makes for app/icon.png, so it is listed too.
  // The version from next.config.ts makes iOS fetch a changed icon instead of a cached one.
  icons: {
    icon: [{ url: `/icon.png?v=${process.env.ICON_VERSION}`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `/apple-touch-icon.png?v=${process.env.ICON_VERSION}`, sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "Werwolf", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#070b24",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${title.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
