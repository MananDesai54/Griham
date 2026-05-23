# Griham — Slice 1 Design

Date: 2026-05-23
Status: Approved for planning

## Overview

Griham is a home decor web app. The user uploads photos of rooms (labeled "living room", "parking", etc.), and the app generates redesigned versions of each room using AI image generation. Generated designs share a consistent palette and style across all rooms in a project. The user can later iterate on designs through chat or mask-based edits (Slice 2), and convert designs into navigable 3D meshes (Slice 3).

This document covers **Slice 1 only**: upload rooms → generate 2D designs with cross-room style consistency, behind a pluggable AI provider abstraction.

## Scope Decomposition

The full product breaks into three slices, each shipped and validated before the next:

| Slice | Contents |
|---|---|
| **S1** (this spec) | Project + room upload, multi-provider AI generation, cross-room style anchor, view results |
| **S2** | Edit loop: text chat regen + paint-mask regen, version history |
| **S3** | 2D design → 3D mesh via Meshy/Tripo, three.js in-browser viewer |

## Non-Goals (S1)

- Authentication, multi-user, sharing
- 3D rendering or mesh generation
- Editing existing designs (chat or mask)
- Deployment / hosting concerns (local dev only)
- Undo history beyond a `parent_design_id` column for future use

## Stack

- Next.js 15, App Router, TypeScript
- SQLite via `better-sqlite3` (single-file DB at `./data/griham.db`)
- Local filesystem blob storage at `./data/blobs/`
- `sharp` for image resize/normalization
- `p-limit` for provider concurrency
- Vitest for tests

No auth, no external DB, no cloud storage. Single user, local only.

## Architecture

```
griham/
├── app/
│   ├── page.tsx                          Project list + create
│   ├── project/[id]/page.tsx             Upload rooms + view designs
│   └── api/
│       ├── projects/route.ts             GET list, POST create
│       ├── projects/[id]/route.ts        GET one
│       ├── rooms/route.ts                POST upload (multipart)
│       ├── designs/generate/route.ts     POST trigger batch gen
│       ├── designs/[id]/route.ts         GET design metadata
│       └── blobs/[id]/route.ts           GET blob bytes
├── lib/
│   ├── db.ts                             better-sqlite3 singleton + migrations
│   ├── storage.ts                        write/read blobs, return blob ids
│   ├── image.ts                          sharp wrapper: resize to 1024 max edge
│   ├── style.ts                          anchor selection + style-prompt builder
│   └── ai/
│       ├── types.ts                      DesignProvider interface
│       ├── gemini.ts                     Gemini 2.5 Flash Image
│       ├── openai.ts                     gpt-image-1
│       ├── replicate.ts                  SDXL + IP-Adapter
│       └── index.ts                      getProvider(name)
├── data/
│   ├── griham.db
│   └── blobs/                            content-addressed by blob id
└── docs/superpowers/specs/
```

## Data Model

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini',           -- 'gemini' | 'openai' | 'replicate'
  style_anchor_blob_id TEXT,                          -- null until first gen completes
  created_at INTEGER NOT NULL
);

CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                                -- 'living room', 'parking', etc.
  source_blob_id TEXT NOT NULL,                       -- uploaded photo
  created_at INTEGER NOT NULL
);

CREATE TABLE designs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  blob_id TEXT,                                       -- null while pending/failed
  prompt TEXT NOT NULL,
  parent_design_id TEXT REFERENCES designs(id),       -- for S2 edit history; null in S1
  status TEXT NOT NULL DEFAULT 'pending',             -- 'pending' | 'ready' | 'failed'
  error TEXT,                                         -- failure message if any
  created_at INTEGER NOT NULL
);

CREATE TABLE blobs (
  id TEXT PRIMARY KEY,                                -- ULID or random hex
  path TEXT NOT NULL,                                 -- relative path under data/blobs/
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL
);
```

IDs are ULIDs (sortable, no collision risk). All blobs go through `lib/storage.ts` so paths are not exposed to callers.

## AI Provider Abstraction

The user picks a provider per project at creation time. All generation calls for that project go through the chosen provider.

```ts
// lib/ai/types.ts
export interface RoomInput {
  label: string;
  bytes: Buffer;
  mime: string;
}

export interface ImageOut {
  bytes: Buffer;
  mime: string;
}

export interface DesignProvider {
  name: 'gemini' | 'openai' | 'replicate';

  // Pass all rooms, return first generated design + use it as style anchor for the rest.
  generateAnchor(rooms: RoomInput[], stylePrompt: string): Promise<{
    anchor: ImageOut;
    anchorRoomLabel: string;        // which room the anchor depicts
  }>;

  // Generate one room conditioned on the anchor.
  generateRoom(anchor: ImageOut, room: RoomInput, stylePrompt: string): Promise<ImageOut>;

  // S2 only — optional in S1.
  editRoom?(base: ImageOut, mask: Buffer | null, instruction: string): Promise<ImageOut>;
}
```

Provider comparison:

| Provider | Approx cost/image | Strengths | Weaknesses |
|---|---|---|---|
| `gemini` (2.5 Flash Image) | ~$0.04 | Native multi-image input, fast, cheap | Less precise mask edits |
| `openai` (gpt-image-1) | ~$0.17 | Best mask/edit support (helps S2) | Most expensive |
| `replicate` (SDXL + IP-Adapter) | ~$0.01–0.03 | IP-Adapter gives strong style lock from anchor | Slowest, most glue code |

Replicate model pin: an IP-Adapter SDXL variant (concrete model id chosen at implementation time; pinned in code, not in spec, since model availability shifts).

Env vars:
```
GEMINI_API_KEY=
OPENAI_API_KEY=
REPLICATE_API_TOKEN=
DEFAULT_PROVIDER=gemini
```

Missing key for the selected provider → API returns 400 with a clear message at generate time, not at project create time (so a user can browse a project even if they later change provider env).

## Style Consistency: The Anchor

The core problem: generating each room independently produces palette/material drift. Solution: a two-pass approach.

1. **Pass 1 — anchor generation.** Send *all* uploaded room photos plus a synthesized style prompt to the provider. The provider returns a single redesigned image for one chosen room (default: the first room labeled "living room", else the first room uploaded). That image becomes the **style anchor**, persisted on the project.
2. **Pass 2 — per-room generation.** For every other room, send `anchor + room source photo + style prompt` to the provider. The provider returns a redesigned image for that room, matching the anchor's palette/style.

`lib/style.ts` owns:
- Picking the anchor room (rule: prefer "living room" / "living" substring, else first by `created_at`).
- Building the style prompt. Default: "Modern, warm, consistent palette across all rooms. Preserve room geometry (walls, windows, doors). Replace furniture, surfaces, and decor with a cohesive design."
- Future: user-provided style hints (out of scope S1; field reserved on `projects` but not exposed in UI).

## Generation Flow

```
POST /api/projects { name, provider }
  → insert row, return { id }

POST /api/rooms (multipart: project_id, label, file)
  → resize to max 1024px edge via sharp
  → write blob, insert row, return { id }

POST /api/designs/generate { project_id }
  Server-side:
    1. Load project + all rooms.
    2. If style_anchor_blob_id is null:
         - Call provider.generateAnchor(rooms, stylePrompt).
         - Save anchor blob, set project.style_anchor_blob_id.
         - Insert design row for the anchor room with status='ready'.
       Else:
         - Reuse existing anchor.
    3. For each remaining room with no 'ready' design:
         - Insert design row status='pending'.
         - Call provider.generateRoom(anchor, room, stylePrompt) under p-limit(2).
         - On success: write blob, update row → status='ready', blob_id set.
         - On failure: update row → status='failed', error=<message>.
    4. Return list of design ids and their statuses.

GET /api/designs/[id]
  → { id, room_id, blob_url: '/api/blobs/<blob_id>', status, error }

GET /api/blobs/[id]
  → streams bytes with correct Content-Type
```

Concurrency: `p-limit(2)` across provider calls within one generate request. Sufficient for single-user local use; not tuned for scale.

Idempotency: re-calling generate skips rooms that already have a `status='ready'` design. Failed rooms are retried.

## UI Components

- **`app/page.tsx`** — list projects, create new project (name + provider dropdown).
- **`app/project/[id]/page.tsx`** — three sections:
  - **`RoomUploader`** — drag-drop files, label input per file, submit batch.
  - **`GenerateButton`** — triggers `/api/designs/generate`, shows progress (poll every 2s while any design is `pending`).
  - **`DesignGrid`** — for each room: source thumbnail + generated thumbnail side-by-side, status badge, retry button on failed.

No chat, no mask, no edit UI in S1.

## Error Handling

- Provider call fails on one room → that room's design row marked `failed` with error message; batch continues. UI shows retry per row.
- All rooms fail → batch returns 200 with all-failed list. UI shows error banner.
- Missing API key for selected provider → generate route returns 400 with which env var is missing.
- Upload too large (>20 MB pre-resize) → 413.
- Unsupported mime (not image/*) → 400.
- DB-level constraints (foreign key violations) → 500 with generic message; logged server-side.

## Testing

Vitest. Test boundaries are the small, well-bounded units:

- `lib/db.ts` — migrations apply cleanly to a fresh in-memory DB; basic CRUD.
- `lib/storage.ts` — write and read back; mime preserved; size matches.
- `lib/style.ts` — anchor room selection rules; prompt builder output.
- `lib/ai/*` — each provider tested with a mocked HTTP client. Asserts the right request shape (multi-image vs single-image vs IP-Adapter conditioning).
- Integration: `/api/designs/generate` end-to-end with the AI module mocked. Asserts: anchor created on first call; subsequent calls reuse anchor; one failure does not abort batch; idempotent re-runs skip ready rows.

No E2E browser tests in S1.

## Open Questions Deferred to Implementation

- Concrete Replicate model id (IP-Adapter SDXL variant).
- Exact prompt wording for anchor and per-room calls — iterate against real outputs.
- Whether to expose the style prompt as a user-editable field in S1 UI (currently no; field exists in code but UI ships hardcoded).

## Next Slices Preview

- **S2**: adds `/api/designs/[id]/edit` (text + optional mask). Reuses `editRoom` on the provider interface. New table `design_edits` or use `parent_design_id` chain on `designs`.
- **S3**: adds `/api/designs/[id]/mesh` calling Meshy/Tripo. New table `meshes(design_id, glb_blob_id, status)`. Three.js client component for viewer.
