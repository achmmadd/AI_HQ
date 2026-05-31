"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Download, Search, Video } from "lucide-react";
import { FumeroPageHeader } from "@/components/fumero/ops/fumero-page-header";
import { FumeroStatusBadge } from "@/components/fumero/ops/fumero-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Post {
  id: number;
  platform: string;
  type?: string | null;
  titel?: string | null;
  content: string;
  status: string;
  created_at: string;
  scheduled_at?: string | null;
  media_url?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  product_photo: "Productfoto",
  banner: "Banner",
  social_video: "Video-script",
  voiceover_script: "Voiceover",
  product_text: "Producttekst",
  social_post: "Social post",
  email_template: "E-mail",
  seo_article: "SEO-artikel",
  post: "Post",
};

function cleanCaption(content: string): string {
  return content.replace(/!\[[^\]]*\]\([^)]*\)\s*/g, "").trim();
}

function postDisplayName(post: Post): string {
  if (post.titel?.trim()) return post.titel.trim();
  const line = cleanCaption(post.content).split("\n")[0]?.trim() || "Zonder titel";
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

function typeLabel(type?: string | null): string {
  if (!type) return "Content";
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function isScriptType(type?: string | null): boolean {
  return type === "social_video" || type === "voiceover_script";
}

export function FumeroBibliotheek() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/content?klant=fumero", { credentials: "include" });
      const data = (await res.json()) as { posts?: Post[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Laden mislukt");
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (!q) return true;
      return (
        post.content.toLowerCase().includes(q) ||
        postDisplayName(post).toLowerCase().includes(q) ||
        (post.type ?? "").toLowerCase().includes(q)
      );
    });
  }, [libraryQuery, posts, statusFilter]);

  const downloadAsset = (post: Post) => {
    if (post.media_url) {
      window.open(post.media_url, "_blank", "noopener,noreferrer");
      return;
    }
    const blob = new Blob([post.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${postDisplayName(post).replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const schedulePost = async (id: number) => {
    const when = window.prompt("Inplannen op (YYYY-MM-DD HH:MM, lokaal):");
    if (!when?.trim()) return;
    const res = await fetch("/api/fumero/content/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ post_id: id, scheduled_at: when.trim() }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error || "Inplannen mislukt");
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-7xl">
      <FumeroPageHeader
        title="Bibliotheek"
        description="Al je gegenereerde content — beeld, teksten en scripts. Nieuwe content maak je in Studio of via Chat."
        actionLabel="Nieuw in chat"
        actionHref="/fumero/chat"
      />
      <p className="-mt-4 mb-4 text-[12px] text-[#737373]">
        Productfoto&apos;s en banners?{" "}
        <a href="/fumero/photo-studio" className="font-medium text-[#3d7a00] hover:underline">
          Open Studio
        </a>
      </p>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#a3a3a3]" />
          <Input
            className="h-9 rounded-lg border-[#E5E5E5] pl-9"
            placeholder="Zoeken…"
            value={libraryQuery}
            onChange={(e) => setLibraryQuery(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-[#E5E5E5] bg-white px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Alle statussen</option>
          <option value="draft">Concept</option>
          <option value="approved">Goedgekeurd</option>
          <option value="scheduled">Gepland</option>
          <option value="published">Gepubliceerd</option>
        </select>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-[#737373]">Bibliotheek laden…</p>
      ) : filtered.length === 0 && posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#525252]">Nog geen content in de bibliotheek</p>
          <p className="mt-1 text-xs text-[#737373]">
            Genereer productfoto&apos;s, teksten of scripts via chat — ze verschijnen hier
            automatisch.
          </p>
          <Button asChild className="mt-4 rounded-lg bg-[#69C400] shadow-none hover:bg-[#5db000]">
            <Link href="/fumero/chat">Maak content in chat</Link>
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E5E5E5] bg-white px-6 py-10 text-center">
          <p className="text-sm text-[#737373]">Geen resultaten voor deze filters.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 rounded-lg text-[#525252]"
            onClick={() => {
              setLibraryQuery("");
              setStatusFilter("all");
            }}
          >
            Filters wissen
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((post) => (
            <article
              key={post.id}
              className="group relative overflow-hidden rounded-xl border border-[#E5E5E5] bg-white transition-shadow hover:shadow-md"
            >
              {post.media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.media_url}
                  alt=""
                  className="h-40 w-full border-b border-[#E5E5E5] bg-[#FAFAFA] object-cover"
                />
              ) : (
                <div className="flex h-40 items-center justify-center border-b border-[#E5E5E5] bg-[#FAFAFA] px-4 text-center">
                  {isScriptType(post.type) ? (
                    <Video className="h-7 w-7 text-[#a3a3a3]" strokeWidth={1.5} />
                  ) : (
                    <p className="line-clamp-4 text-xs leading-relaxed text-[#737373]">
                      {cleanCaption(post.content)}
                    </p>
                  )}
                </div>
              )}
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  title="Download"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"
                  onClick={() => downloadAsset(post)}
                >
                  <Download className="h-4 w-4" />
                </button>
                {post.status === "approved" ? (
                  <button
                    type="button"
                    title="Inplannen (lokaal)"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#525252] shadow-sm hover:bg-[#FAFAFA]"
                    onClick={() => void schedulePost(post.id)}
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-medium text-[#171717]">
                  {postDisplayName(post)}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md border border-[#E5E5E5] bg-[#FAFAFA] px-1.5 py-0.5 text-[10px] font-medium text-[#525252]">
                    {typeLabel(post.type)}
                  </span>
                  <FumeroStatusBadge status={post.status} />
                </div>
                {post.status === "scheduled" && post.scheduled_at ? (
                  <p className="text-[11px] text-[#3d7a00]">
                    Gepland ·{" "}
                    {new Date(post.scheduled_at).toLocaleString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : (
                  <p className="text-[11px] text-[#a3a3a3]">
                    {new Date(post.created_at).toLocaleDateString("nl-NL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
