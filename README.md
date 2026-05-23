# Griham

AI home decor. Upload labeled room photos. Get redesigned 2D views with consistent style across rooms. Edit via chat or paint-mask. View as 3D mesh.

## Requirements

- **Bun** ≥ 1.3 ([install](https://bun.sh)) — runs Next.js + handles `bun:sqlite` natively.
- macOS, Linux, or WSL. (Native Windows untested.)
- At least one AI provider API key (see below).
- ~500 MB free disk for `node_modules` + generated images.

Check Bun is installed:
```bash
bun --version
```

## Get the code

```bash
git clone https://github.com/MananDesai54/Griham.git griham
cd griham
```

## Install dependencies

```bash
bun install
```

First install takes ~30-60s. Pulls `next`, `react`, `sharp`, `@google/genai`, `openai`, `replicate`, `three`, `@react-three/fiber`, `@react-three/drei`.

## Configure providers

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in **at least one** image-gen provider key, plus optionally `MESHY_API_KEY` for 3D.

```
GEMINI_API_KEY=          # ai.google.dev — cheapest, recommended for first try
OPENAI_API_KEY=          # platform.openai.com — best mask edits
REPLICATE_API_TOKEN=     # replicate.com — IP-Adapter SDXL
MESHY_API_KEY=           # meshy.ai — for 3D mesh generation
DEFAULT_PROVIDER=gemini  # which one shows up as default in the UI dropdown
GRIHAM_DATA_DIR=./data   # where SQLite + image blobs live
```

Where to get keys:
- **Gemini** — https://aistudio.google.com/apikey (free tier available)
- **OpenAI** — https://platform.openai.com/api-keys
- **Replicate** — https://replicate.com/account/api-tokens
- **Meshy** — https://meshy.ai/settings/api

You only need one of the three image providers to start. Meshy is optional (used only when you click "Generate 3D").

## Run dev server

```bash
bun run dev
```

Wait for `Ready in <Nms>` then open http://localhost:3000.

The app creates `./data/griham.db` (SQLite) and `./data/blobs/` (uploaded + generated images) on first use. Both are gitignored. Delete `./data/` to reset state.

## Use the app

1. **Create project** — type a name on the home page. Pick a provider (Gemini = cheapest). Click **Create**.
2. **Upload rooms** — for each room, type a label (e.g. `living room`, `kitchen`, `parking`), pick the photo, click **Upload**. Repeat for all rooms. Best results with one room labeled `living room` (used as the style anchor).
3. **Generate designs** — click **Generate designs**. First call establishes a style anchor from the living room, then redesigns every other room to match. Takes ~10-30s per room depending on provider.
4. **Edit a design** — click **Edit** on any ready design. Optionally paint over a region with the brush (white = "change this area"). Type an instruction like `replace sofa with green velvet`. Click **Apply edit**. A new version appears. Use ← → arrows to navigate the chain.
5. **3D mesh** — click **Generate 3D** on any ready design. Meshy takes 1-3 min real time. The button polls every 5s and flips to **View 3D** when ready. Click to open the three.js modal — drag to orbit, scroll to zoom, click outside to close.

## Other commands

```bash
bun run build      # next production build
bun run start      # serve the production build
bun test           # run Vitest under Bun (39 tests)
bun run test:watch # vitest in watch mode
```

## Reset / clean state

```bash
rm -rf data        # wipe DB + blobs
rm -rf .next       # wipe Next.js build cache
rm -rf node_modules && bun install   # nuke + reinstall deps
```

## Troubleshooting

- **`Missing env var: GEMINI_API_KEY`** on Generate — set the right key in `.env.local` and restart `bun run dev`.
- **Replicate model 404** — `lib/ai/replicate.ts` uses slug-only models (`lucataco/sdxl-ip-adapter`, `lucataco/sdxl-inpainting`). Slugs may have been renamed by their owners; swap to a current IP-Adapter SDXL / inpainting model.
- **Meshy job stuck pending > 30 min** — server marks it `failed` automatically on next poll. Click **Retry**.
- **`bun:sqlite` import error in tests** — make sure scripts use `bun --bun x vitest`, not `npx vitest`. Vitest needs Bun runtime to resolve `bun:sqlite`.
- **Three.js canvas blank** — GLB may have downloaded but is empty/corrupt. Check `data/blobs/` for a non-zero file matching the `glb_blob_id` in the `meshes` table.

## Tech

Next.js 15 (App Router) · Bun · TypeScript · `bun:sqlite` · Sharp · Vitest · Three.js + `@react-three/fiber` / `drei`. Single-user, local-only — no auth, no cloud.

## Providers (per project)

- `gemini` — Gemini 2.5 Flash Image. Cheap (~$0.04/img), multi-image native.
- `openai` — `gpt-image-1`. Best mask support. Pricier (~$0.17/img).
- `replicate` — SDXL + IP-Adapter (style transfer) / SDXL inpainting (edit). Cheap (~$0.01-0.03/img), most glue code.

## Scope

- **S1** (shipped): upload + 2D generation with style anchor.
- **S2** (shipped): chat + paint-mask edits, linear version chain navigation.
- **S3** (shipped): per-design 3D mesh via Meshy + three.js viewer.

Specs and implementation plans live under `docs/superpowers/`.
