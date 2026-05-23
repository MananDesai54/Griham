"use client";
import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";

export interface MaskCanvasHandle {
  exportMask(): Promise<Blob | null>;
  clear(): void;
}

export const MaskCanvas = forwardRef<MaskCanvasHandle, { src: string; brushSize: number }>(function MaskCanvas(
  { src, brushSize },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const eraseRef = useRef(false);
  const [hasPaint, setHasPaint] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  function paintAt(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext("2d")!;
    ctx.globalCompositeOperation = eraseRef.current ? "destination-out" : "source-over";
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    setHasPaint(true);
  }

  useImperativeHandle(ref, () => ({
    async exportMask() {
      const canvas = canvasRef.current;
      if (!canvas || !hasPaint) return null;
      return new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), "image/png"));
    },
    clear() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
      setHasPaint(false);
    },
  }));

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <img src={src} alt="base" style={{ display: "block", maxWidth: "100%" }} />
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair", opacity: 0.5 }}
        onMouseDown={e => { drawingRef.current = true; eraseRef.current = e.shiftKey || e.button === 2; paintAt(e); }}
        onMouseMove={e => { if (drawingRef.current) paintAt(e); }}
        onMouseUp={() => { drawingRef.current = false; }}
        onMouseLeave={() => { drawingRef.current = false; }}
        onContextMenu={e => e.preventDefault()}
      />
    </div>
  );
});
