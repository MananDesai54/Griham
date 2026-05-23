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
