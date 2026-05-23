"use client";
import { ThemeProvider as NextThemes } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="data-theme"
      defaultTheme="sand"
      themes={["sand", "charcoal", "slate"]}
      enableSystem={false}
    >
      {children}
    </NextThemes>
  );
}
