"use client";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/cn";

export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const draggingRef = useRef(false);

  function move(clientX: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setPos((x / rect.width) * 100);
  }

  useEffect(() => {
    function onUp() { draggingRef.current = false; }
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return;
      const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      move(clientX);
    }
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchmove", onMove);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("relative w-full overflow-hidden rounded-md select-none", className)}
      style={{ aspectRatio: "16 / 9" }}
    >
      <img src={afterSrc} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img src={beforeSrc} alt={beforeLabel} className="absolute inset-0 h-full w-auto max-w-none object-cover" style={{ width: ref.current?.clientWidth ?? "100%" }} />
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] cursor-ew-resize"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        onMouseDown={() => { draggingRef.current = true; }}
        onTouchStart={() => { draggingRef.current = true; }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white shadow flex items-center justify-center text-xs font-medium text-stone-700">
          ⇆
        </div>
      </div>
      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs">{beforeLabel}</span>
      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs">{afterLabel}</span>
    </div>
  );
}
