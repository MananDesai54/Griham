"use client";
import Link from "next/link";
import { ThemeSwitcher } from "./theme-switcher";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklch,var(--color-background)_80%,transparent)] transition-all duration-200">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-serif text-xl font-semibold tracking-tight hover:text-[var(--color-primary)] transition-colors"
        >
          Griham
        </Link>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
