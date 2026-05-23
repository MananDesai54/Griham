"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function ProjectCreateForm({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, provider }),
      });
      if (res.ok) {
        const { id } = await res.json();
        toast.success("Project created");
        router.push(`/project/${id}`);
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error ?? "Failed to create project");
      }
    } catch {
      toast.error("Failed to create project");
    } finally {
      setBusy(false);
    }
  }

  const form = (
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
  );

  if (embedded) return form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New project</CardTitle>
        <CardDescription>
          Give your project a name and choose an AI provider.
        </CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
