# Griham — Slices 2 + 3 Design

Date: 2026-05-23
Status: Approved for planning
Builds on: `2026-05-23-griham-s1-design.md`

## Overview

S1 ships project + room upload + 2D AI design with style anchor. This spec covers the next two slices:

- **S2 — Edit loop.** Text-chat + paint-mask edits on existing designs. Each edit produces a new `designs` row chained via `parent_design_id`. UI shows the leaf design with arrows to navigate the chain.
- **S3 — 3D view.** Image-to-3D mesh per design via Meshy. Three.js viewer modal. On-demand per design.

Both slices reuse S1's data model, provider abstraction, and blob storage. S2 lands first, then S3.

## Non-Goals

- Mesh editing or 3D inpainting
- Multi-room stitching into a single navigable house
- Branch/revert UI (chain is linear leaf-by-leaf)
- GLB download/export to user's device
- 3D for multiple providers — Meshy only in this slice (interface kept for future swap)

## Stack additions

- Three.js, `@react-three/fiber`, `@react-three/drei`
- Meshy AI image-to-3D v2 API (HTTP)

No new server-side runtime deps beyond fetch (already global in Bun).

---

## S2: Edit Loop

### Data model addition

`designs` table gains two columns:

```sql
ALTER TABLE designs ADD COLUMN edit_instruction TEXT;
ALTER TABLE designs ADD COLUMN mask_blob_id TEXT REFERENCES blobs(id);
```

`parent_design_id` already exists from S1. Use it.

A design is an **edit** iff `parent_design_id IS NOT NULL`. Anchor or first-pass designs have NULL parent.

### Chain semantics

- Each room has zero or more `designs` rows. The latest leaf (max `created_at` for the room) is the "current" design.
- Editing the current design inserts a new row with `parent_design_id` = current design id.
- Chain is linear in UI. Server allows editing any node (creates branch); UI only ever points at the latest leaf per room.
- No revert. To go back, the user re-edits.

### Provider interface

S1 already declared `editRoom?(base, mask, instruction)` as optional. Promote to required (drop `?`) in `lib/ai/types.ts`:

```ts
editRoom(base: ImageOut, mask: Buffer | null, instruction: string): Promise<ImageOut>;
```

Per-provider behavior:

| Provider | Approach |
|---|---|
| `gemini` | Multimodal: base image + (mask if given) + text instruction. Prompt: "Modify only the white region of the mask" if mask present, else apply instruction freely. |
| `openai` | Native `images.edit({ image, mask, prompt })`. Cleanest mask support. If mask is null, fall back to `images.edit` with image only and the instruction as prompt. |
| `replicate` | Different model than S1's IP-Adapter: an SDXL inpainting model, slug-only (e.g. `lucataco/sdxl-inpainting`), TODO to pin version hash before prod. Mask required for inpainting; if mask is null, fall back to img2img on the same model (or document this as a limitation). |

### API: `POST /api/designs/[id]/edit`

Request: multipart form
- `instruction` (string, required, non-empty)
- `mask` (PNG file, optional)

Response: `{ design_id }` once the new design row is created (status `pending` if async, but in S2 we run inline same as S1 generate). On success the new row is `ready` with `blob_id`.

Flow:
1. Load base design by id. Reject if not `ready` (400 "base design not ready").
2. Load base blob bytes.
3. Look up project to get provider name. `getProvider(name)`.
4. If mask present: read file, convert to Buffer.
5. Insert new `designs` row: `parent_design_id = <id>`, `room_id = base.room_id`, `prompt = stylePrompt`, `edit_instruction = instruction`, `mask_blob_id = <new blob id if mask>`, `status = 'pending'`.
6. Call `provider.editRoom(baseImage, maskBuf|null, instruction)`.
7. On success: write result blob, update row `blob_id` + `status='ready'`. Return row.
8. On failure: update row `status='failed'`, `error=<msg>`. Return 500 with error.

### UI: `DesignEditor` component

Mounted in a modal/drawer when the user clicks "Edit" on a design card in `DesignGrid`.

```
┌────────────────────────────────────┐
│  [design image w/ canvas overlay]  │
│                                    │
│  Brush: [- 12 +]   [Clear mask]    │
│  ┌──────────────────────────────┐  │
│  │ "Move sofa to left corner"   │  │
│  └──────────────────────────────┘  │
│  [Apply edit]        [Cancel]      │
└────────────────────────────────────┘
```

Subcomponents:
- **`MaskCanvas`** — HTML `<canvas>` overlay sized to the image. Mouse drag paints opaque white pixels at brush radius. Shift+drag (or right-click) erases. "Clear mask" resets. Exports via `canvas.toBlob('image/png')`. Empty mask (no painted pixels) → caller treats as null.
- **`InstructionInput`** — textarea + Apply/Cancel buttons.

On Apply: build FormData (instruction + optional mask PNG), POST to `/api/designs/[id]/edit`. On 2xx: close modal, `router.refresh()`. On error: show banner inline.

### UI: `DesignGrid` updates

Per-card additions:
- "Edit" button → opens `DesignEditor` modal for that design.
- Version chain arrows: if `designs` for that room form a chain of length > 1, show `← v3 of 5 →` and let the user step backward/forward. Stepping shows that design's blob; "Edit" still acts on the leaf.

Internally: `DesignGrid` already receives all designs for a project. Group by `room_id`, build chain per room by following `parent_design_id` from leaf back. Order leaf-most first.

### Tests

- `lib/ai/*.editRoom` — extend existing provider tests with one new case each (mask passed through correctly; null mask handled).
- Integration `tests/edit-route.test.ts` — POST edit with mock provider, assert new design row created with `parent_design_id` set, `status='ready'`, base design unchanged.

---

## S3: 3D View

### Data model addition

New table:

```sql
CREATE TABLE meshes (
  id TEXT PRIMARY KEY,
  design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
  glb_blob_id TEXT,
  job_id TEXT,                              -- Meshy job id
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | ready | failed
  error TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX meshes_design_id ON meshes(design_id);
```

At most one active mesh per design — UI uses the latest row by `created_at`. Retries insert new rows.

### Mesh provider interface

`lib/mesh/types.ts`:

```ts
export interface MeshJobStart {
  jobId: string;
}

export interface MeshJobStatus {
  status: "pending" | "ready" | "failed";
  glbUrl?: string;
  error?: string;
}

export interface MeshProvider {
  name: "meshy";
  startJob(imageBytes: Buffer, mime: string): Promise<MeshJobStart>;
  pollJob(jobId: string): Promise<MeshJobStatus>;
}
```

### Meshy client (`lib/mesh/meshy.ts`)

Endpoints (Meshy image-to-3D v2):
- `POST https://api.meshy.ai/openapi/v2/image-to-3d`
  - Body JSON: `{ image_url: "data:<mime>;base64,..." , ai_model: "meshy-4", topology: "triangle" }`
  - Auth: `Authorization: Bearer ${MESHY_API_KEY}`
  - Response: `{ result: "<job-id>" }`
- `GET https://api.meshy.ai/openapi/v2/image-to-3d/{job}`
  - Response: `{ status: "PENDING"|"IN_PROGRESS"|"SUCCEEDED"|"FAILED", model_urls: { glb?: string }, task_error?: { message } }`

Mapping:
- `PENDING` | `IN_PROGRESS` → `pending`
- `SUCCEEDED` → `ready` with `glbUrl = model_urls.glb`
- `FAILED` → `failed` with error message

`MissingApiKeyError("MESHY_API_KEY")` thrown if env missing.

### API routes

#### `POST /api/designs/[id]/mesh`

Start a mesh job for the given design.

Flow:
1. Load design. Reject if not `ready` (400).
2. Insert `meshes` row: `design_id`, `status='pending'`, `created_at`.
3. Load design blob bytes.
4. `meshy.startJob(bytes, mime)` → `jobId`.
5. Update row with `job_id`.
6. Return `{ mesh_id }`.

On error before step 4 completes: mark row failed, return 500.

#### `GET /api/meshes/[id]`

Returns current status. May actively poll Meshy if still pending.

Flow:
1. Load mesh row. 404 if missing.
2. If `status='ready'`: return `{ status: 'ready', glb_url: '/api/blobs/<glb_blob_id>' }`.
3. If `status='failed'`: return `{ status: 'failed', error }`.
4. If `status='pending'`: call `meshy.pollJob(job_id)`.
   - Still pending: return `{ status: 'pending' }`.
   - Ready: fetch GLB from `glbUrl`, write as blob with `model/gltf-binary` mime, update row → `glb_blob_id`, `status='ready'`. Return ready response.
   - Failed: update row → `status='failed'`, `error`. Return failed response.

Concurrency: status updates are idempotent (`UPDATE ... WHERE status='pending'` returns rowcount; if already updated by a concurrent poll, just re-read row).

### Blob serving

`/api/blobs/[id]` already exists from S1. GLB blobs use the same path. The route returns the `mime` stored in the `blobs` table; Meshy GLBs are stored with `model/gltf-binary`.

### UI: `MeshButton` component

State machine per design:

```
no row → "Generate 3D" button → POST mesh, transition to pending
pending → spinner + "Building mesh…" + poll GET /api/meshes/[id] every 5s
ready → "View 3D" button → opens MeshViewer modal
failed → red text "failed: <msg>" + "Retry" button (POSTs mesh again)
```

Mounts under each design card next to the Edit button.

### UI: `MeshViewer` component (modal)

Client component using `@react-three/fiber` + `@react-three/drei`:

```tsx
<Canvas camera={{ position: [0, 1.5, 3], fov: 50 }}>
  <ambientLight intensity={0.6} />
  <directionalLight position={[5, 5, 5]} intensity={0.8} />
  <Suspense fallback={null}><Model url={glbUrl} /></Suspense>
  <OrbitControls />
</Canvas>
```

`Model` uses `useGLTF(url)` from drei. Suspense handles loading.

Modal dismisses on backdrop click or Esc. No extra controls beyond orbit.

### Tests

- `tests/mesh-meshy.test.ts` — mock fetch. Verify startJob request body shape (data-URL image, auth header) + jobId extraction. Verify pollJob status mapping for all four Meshy states. Verify missing API key throws.
- Integration `tests/mesh-route.test.ts` — start job inserts row + stores jobId; poll route transitions pending → ready when mocked provider returns SUCCEEDED, downloads GLB, stores blob.
- No tests for `MeshViewer`/three.js — manual smoke.

---

## File structure additions (S2 + S3)

```
lib/
├── mesh/
│   ├── types.ts                 MeshProvider interface
│   └── meshy.ts                 Meshy client
└── ai/
    ├── types.ts                 promote editRoom to required
    ├── gemini.ts                + editRoom impl
    ├── openai.ts                + editRoom impl
    └── replicate.ts             + editRoom impl (inpaint model)

app/api/
├── designs/[id]/edit/route.ts   POST edit
├── designs/[id]/mesh/route.ts   POST start mesh
└── meshes/[id]/route.ts         GET poll

components/
├── DesignEditor.tsx             modal: image + canvas + textarea
├── MaskCanvas.tsx               brush canvas
├── MeshButton.tsx               state machine
├── MeshViewer.tsx               three.js modal
└── DesignGrid.tsx               +Edit, +3D, chain arrows

tests/
├── edit-route.test.ts
├── mesh-meshy.test.ts
└── mesh-route.test.ts
```

## Env additions

```
MESHY_API_KEY=
```

## Migrations

A migration runner runs all SQL in `MIGRATIONS` array on every `openDb`. New columns/tables append to the array; `IF NOT EXISTS` for tables; `ALTER TABLE` is unguarded but tolerated because SQLite will error on duplicate column add — wrap each ALTER in a try/catch that ignores "duplicate column" errors. Simple, no formal migration framework needed for single-user local app.

## Error / edge handling

- Edit base not ready → 400 `"base design not ready"`.
- Edit instruction empty → 400 `"instruction required"`.
- Mask file > 5 MB → 413.
- Mesh start when design not ready → 400.
- Mesh poll: Meshy job not found / 404 → mark failed.
- Mesh GLB download too large (> 50 MB) → reject, mark failed.
- Mesh job stuck > 30 min (created_at older than 30 min, still pending) → next poll attempt marks failed with `"timeout"`.

## Testing strategy

Same as S1: Vitest unit tests at module boundaries, mocked external HTTP, one integration test per new route. No browser-level tests for canvas/three.js — manual smoke after each slice.

## Smoke test plan

### After S2
1. Create project, upload 2 rooms, generate designs (from S1).
2. Click "Edit" on living-room design. Paint a small region on sofa area. Type "replace with green velvet sofa". Apply.
3. Verify new design appears with edit applied roughly to the masked region.
4. Step backward via arrow, see prior design. Step forward, see edited.

### After S3
1. On any ready design, click "Generate 3D".
2. Watch button transition pending → ready (may take 1-3 min real Meshy).
3. Click "View 3D". Modal opens with orbitable mesh.
4. Close. Click "View 3D" again — instant load (cached blob).

## Order of implementation

1. S2 first. Ship and smoke-test edits.
2. Then S3. Mesh + viewer.

Implementation plan companion doc: `docs/superpowers/plans/2026-05-23-griham-s2-s3.md`.

## Open items deferred to implementation

- Concrete Replicate inpainting model slug (pin at impl time).
- Exact prompt wording for edit instructions, esp. mask-region guidance for Gemini.
- Whether Meshy v2 API parameters (`ai_model`, `topology`) need tuning — start with defaults, iterate against real output.
