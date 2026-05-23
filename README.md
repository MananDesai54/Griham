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

## 3D

Per-design mesh via Meshy AI. Set `MESHY_API_KEY` then click **Generate 3D** on any ready design. Polls every 5s; view in three.js modal when ready.

## Scope

- **S1** (shipped): upload + 2D generation with style anchor.
- **S2** (shipped): chat + paint-mask edits, version chain navigation.
- **S3** (shipped): per-design 3D mesh via Meshy + three.js viewer.

## Smoke

After setup:

1. Create project, upload at least 2 rooms (one labeled "living room"), generate designs.
2. Click **Edit** on a ready design. Paint a small region, type an instruction, apply. Confirm new version appears and ← → arrows navigate.
3. Click **Generate 3D** on any ready design. Wait 1-3 min. When button flips to **View 3D**, click it. Modal opens with orbitable mesh.
