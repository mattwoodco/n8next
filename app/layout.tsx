import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Next8n - Workflow Builer",
  description:
    " Next8n is a workflow builder that helps you automate your tasks and processes with ease.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Next8n - Workflow Builer",
    description:
      " Next8n is a workflow builder that helps you automate your tasks and processes with ease.",
    url: "https://next8n.mattwood.co",
    siteName: "Next8n",
    images: [
      {
        url: "/icon.svg",
        width: 192,
        height: 192,
      },
    ],
    locale: "en-US",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "hsl(var(--background))" },
    { media: "(prefers-color-scheme: dark)", color: "hsl(var(--background))" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
