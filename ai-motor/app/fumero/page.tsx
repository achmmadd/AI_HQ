"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Post {
  id: number;
  platform: string;
  content: string;
  hashtags?: string | null;
  status: string;
  created_at: string;
}

interface Template {
  id: number;
  naam: string;
  platform: string;
  toon: string;
  prompt?: string;
}

const PLATFORMS = ["instagram", "tiktok", "linkedin"] as const;

function badgeTone(s: string) {
  const map: Record<string, string> = {
    draft: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    published: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
  };
  return map[s] ?? "bg-surface-elevated text-text-secondary";
}

export default function FumeroPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [platform, setPlatform] =
    useState<(typeof PLATFORMS)[number]>("instagram");
  const [generatedContent, setGeneratedContent] = useState("");
  const [variabelen, setVariabelen] = useState<Record<string, string>>({});

  const tplVarKeys = useMemo(() => {
    const p = templates.find((t) => t.id === selectedTemplate)?.prompt;
    if (!p) return [];
    return [...new Set([...p.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]))];
  }, [templates, selectedTemplate]);

  const load = useCallback(async () => {
    const [postsData, templatesData] = await Promise.all([
      fetch("/api/content?klant=fumero").then((r) => r.json()),
      fetch("/api/content/templates?klant=fumero").then((r) => r.json()),
    ]);
    setPosts(Array.isArray(postsData.posts) ? postsData.posts : []);
    setTemplates(
      Array.isArray(templatesData.templates) ? templatesData.templates : []
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setVariabelen({});
  }, [selectedTemplate]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate ?? undefined,
          custom_prompt: customPrompt.trim() || undefined,
          klant: "fumero",
          platform,
          ...(tplVarKeys.length
            ? {
                variabelen: Object.fromEntries(
                  tplVarKeys.map((k) => [k, variabelen[k] ?? ""])
                ),
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      setGeneratedContent(typeof data.content === "string" ? data.content : "");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Genereren mislukt");
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  return (
    <AppShell title="Fumero · Content">
      <div className="space-y-6">
        <p className="text-sm text-text-secondary max-w-2xl">
          Content pipeline — templates, generator via Factory OS (
          <code className="text-xs">type: content_generate</code>), drafts in
          SQLite. Publicatie handmatig op het platform.
        </p>

        <Tabs defaultValue="generator">
          <TabsList className="flex-wrap">
            <TabsTrigger value="generator">Generator</TabsTrigger>
            <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={platform === p ? "default" : "secondary"}
                  size="sm"
                  className="rounded-xl capitalize"
                  onClick={() => setPlatform(p)}
                >
                  {p}
                </Button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {templates
                .filter((t) => t.platform === platform)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(t.id);
                      setCustomPrompt("");
                    }}
                    className={cn(
                      "rounded-2xl border border-border bg-surface p-3 text-left transition-colors hover:bg-surface-elevated/60",
                      selectedTemplate === t.id &&
                        "ring-2 ring-accent border-accent/40"
                    )}
                  >
                    <p className="text-sm font-medium">{t.naam}</p>
                    <span className="mt-1 inline-block rounded-lg border border-border px-2 py-0.5 text-[10px] text-text-secondary">
                      {t.toon}
                    </span>
                  </button>
                ))}
            </div>

            {tplVarKeys.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {tplVarKeys.map((key) => (
                  <label key={key} className="text-xs text-text-secondary">
                    {"{" + key + "}"}
                    <Input
                      className="mt-1 rounded-xl"
                      value={variabelen[key] ?? ""}
                      onChange={(e) =>
                        setVariabelen((v) => ({ ...v, [key]: e.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm text-text-secondary">Eigen prompt:</p>
              <Textarea
                placeholder="Schrijf een post over…"
                value={customPrompt}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  setSelectedTemplate(null);
                  setVariabelen({});
                }}
                rows={3}
                className="rounded-2xl"
              />
            </div>

            <Button
              type="button"
              onClick={() => void generate()}
              disabled={
                generating || (!selectedTemplate && !customPrompt.trim())
              }
              className="w-full rounded-2xl"
            >
              {generating ? "Genereren…" : "Genereer post"}
            </Button>

            {generatedContent ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Laatste output</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm whitespace-pre-wrap">
                    {generatedContent}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() =>
                        void navigator.clipboard.writeText(generatedContent)
                      }
                    >
                      Kopiëren
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => setGeneratedContent("")}
                    >
                      Wissen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          <TabsContent value="posts" className="mt-4 space-y-3">
            {posts.length === 0 ? (
              <p className="text-sm text-text-secondary">Nog geen posts</p>
            ) : (
              posts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-lg border border-border px-2 py-0.5 text-xs capitalize">
                        {post.platform}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          badgeTone(post.status)
                        )}
                      >
                        {post.status}
                      </span>
                    </div>
                    <p className="line-clamp-4 text-sm whitespace-pre-wrap">
                      {post.content}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() =>
                          void navigator.clipboard.writeText(post.content)
                        }
                      >
                        Kopiëren
                      </Button>
                      {post.status === "draft" ? (
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => void updateStatus(post.id, "approved")}
                        >
                          Goedkeuren
                        </Button>
                      ) : null}
                      {post.status === "approved" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="rounded-xl"
                          onClick={() =>
                            void updateStatus(post.id, "published")
                          }
                        >
                          Gepubliceerd
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-3">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{t.naam}</p>
                    <div className="flex gap-1">
                      <span className="rounded-lg border border-border px-2 py-0.5 text-xs">
                        {t.platform}
                      </span>
                      <span className="rounded-lg border border-border px-2 py-0.5 text-xs">
                        {t.toon}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
