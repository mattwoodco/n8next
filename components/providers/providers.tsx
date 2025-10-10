"use client";

import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";

import { ThemeProvider } from "@/components/providers/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Analytics />
      </ThemeProvider>
    </Suspense>
  );
}
