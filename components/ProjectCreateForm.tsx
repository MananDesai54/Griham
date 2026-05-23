"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function ProjectCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, provider }),
    });
    setBusy(false);
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/project/${id}`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New project</CardTitle>
        <CardDescription>Give your project a name and choose an AI provider.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            required
            className="flex-1"
          />
          <Select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="sm:w-36"
          >
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="replicate">Replicate</option>
          </Select>
          <Button type="submit" disabled={busy || !name}>
            {busy ? "Creating…" : "Create"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
