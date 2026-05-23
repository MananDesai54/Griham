import type { MeshProvider, MeshJobStart, MeshJobStatus } from "./types";
import { MissingApiKeyError } from "../ai/index";

const BASE = "https://api.meshy.ai/openapi/v2/image-to-3d";

function authHeader(): string {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new MissingApiKeyError("MESHY_API_KEY");
  return `Bearer ${key}`;
}

export class MeshyProvider implements MeshProvider {
  name = "meshy" as const;

  async startJob(imageBytes: Buffer, mime: string): Promise<MeshJobStart> {
    const dataUrl = `data:${mime};base64,${imageBytes.toString("base64")}`;
    const res = await fetch(BASE, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: dataUrl, ai_model: "meshy-4", topology: "triangle" }),
    });
    if (!res.ok) throw new Error(`meshy startJob failed: ${res.status}`);
    const json = (await res.json()) as { result: string };
    return { jobId: json.result };
  }

  async pollJob(jobId: string): Promise<MeshJobStatus> {
    const res = await fetch(`${BASE}/${jobId}`, { headers: { Authorization: authHeader() } });
    if (!res.ok) throw new Error(`meshy pollJob failed: ${res.status}`);
    const json = (await res.json()) as {
      status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    switch (json.status) {
      case "PENDING":
      case "IN_PROGRESS":
        return { status: "pending" };
      case "SUCCEEDED":
        return { status: "ready", glbUrl: json.model_urls?.glb };
      case "FAILED":
        return { status: "failed", error: json.task_error?.message ?? "meshy failed" };
    }
  }
}
