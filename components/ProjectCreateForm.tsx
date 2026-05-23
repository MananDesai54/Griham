"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/projects", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, provider }),
    });
    setBusy(false);
    if (res.ok) { const { id } = await res.json(); router.push(`/project/${id}`); }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" required />
      <select value={provider} onChange={e => setProvider(e.target.value)}>
        <option value="gemini">Gemini</option>
        <option value="openai">OpenAI</option>
        <option value="replicate">Replicate</option>
      </select>
      <button disabled={busy || !name}>Create</button>
    </form>
  );
}
