"use client";
import { useTheme } from "next-themes";
import { Sun, Moon, Droplet, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sand: Sun,
  charcoal: Moon,
  slate: Droplet,
};
const LABELS: Record<string, string> = {
  sand: "Sand",
  charcoal: "Charcoal",
  slate: "Slate",
};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-9 w-9" />;

  const current = theme ?? "sand";
  const next =
    current === "sand" ? "charcoal" : current === "charcoal" ? "slate" : "sand";
  const Icon = ICONS[current] ?? Palette;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      title={`Theme: ${LABELS[current]} (click for ${LABELS[next]})`}
      className="gap-2"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline text-xs uppercase tracking-wide">
        {LABELS[current]}
      </span>
    </Button>
  );
}
