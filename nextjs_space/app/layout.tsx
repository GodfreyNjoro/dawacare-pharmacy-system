import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  title: "DawaCare - Pharmacy Management System",
  description: "Comprehensive pharmacy inventory management system for healthcare professionals",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
  openGraph: {
    title: "DawaCare - Pharmacy Management System",
    description: "Comprehensive pharmacy inventory management system for healthcare professionals",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />
        <style
          dangerouslySetInnerHTML={{
            __html: `[data-hydration-error] { display: none !important; }`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-gray-50`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
