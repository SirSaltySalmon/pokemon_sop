import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Salmon's Pokémon Smash or Pass",
  description: "Community smash-or-pass for Pokémon characters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <div style={{ maxWidth: "42rem", margin: "0 auto", padding: "0 1rem" }}>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
