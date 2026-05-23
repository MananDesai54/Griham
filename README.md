# Griham

AI home decor: upload labeled room photos, get redesigned 2D views with consistent style across rooms.

## Setup

```bash
bun install
cp .env.local.example .env.local
# fill in at least one provider key
bun run dev
```

Open http://localhost:3000.

## Providers

Choose one per project on create:
- `gemini` — Gemini 2.5 Flash Image. Cheapest, multi-image native. Set `GEMINI_API_KEY`.
- `openai` — gpt-image-1. Best for masked edits (used in S2). Set `OPENAI_API_KEY`.
- `replicate` — SDXL + IP-Adapter. Strong style transfer. Set `REPLICATE_API_TOKEN`.

## Tests

```bash
bun test
```

> Tests run via Vitest under Bun (`bun x vitest`).

## Scope

S1 (this version): upload + 2D generation with style anchor.
S2 (next): chat + mask edits.
S3 (later): 2D → 3D mesh viewer.
