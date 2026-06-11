"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Mail, Trash2, UserPlus } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/design-system/components";
import { ROLE_LABELS } from "@/components/settings/master-context-editor";
import { WORKSPACE_LABELS } from "@/lib/brand";
import { getWorkspaceTheme } from "@/stores/useCompanyStore";
import type { WorkspaceId } from "@/lib/types";
import type { MembershipRole } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

const WORKSPACE_OPTIONS: { id: WorkspaceId; slug: string; label: string }[] = [
  { id: "fumero", slug: "fumero", label: WORKSPACE_LABELS.fumero },
  { id: "bokas", slug: "bokas", label: WORKSPACE_LABELS.bokas },
  { id: "personal", slug: "personal", label: WORKSPACE_LABELS.personal },
];

type Member = {
  id: string;
  email: string;
  role: MembershipRole;
  createdAt: string;
};

type PendingInvite = {
  id: string;
  email: string;
  role: MembershipRole;
  inviteUrl: string;
  expiresAt: string;
};

type Props = {
  defaultWorkspace?: WorkspaceId;
  allowedWorkspaces?: WorkspaceId[];
  membershipRole?: MembershipRole | null;
  isAdmin?: boolean;
};

export function TeamMembersPanel({
  defaultWorkspace = "fumero",
  allowedWorkspaces,
  membershipRole,
  isAdmin = false,
}: Props) {
  const workspaces = useMemo(() => {
    if (!allowedWorkspaces?.length) return WORKSPACE_OPTIONS;
    return WORKSPACE_OPTIONS.filter((w) => allowedWorkspaces.includes(w.id));
  }, [allowedWorkspaces]);

  const [selected, setSelected] = useState<WorkspaceId>(
    workspaces.some((w) => w.id === defaultWorkspace)
      ? defaultWorkspace
      : (workspaces[0]?.id ?? "fumero")
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("viewer");
  const [inviting, setInviting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const slug = workspaces.find((w) => w.id === selected)?.slug ?? selected;
  const theme = getWorkspaceTheme(selected);
  const canManage = isAdmin || membershipRole === "admin";

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${slug}/members`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Laden mislukt");
      }
      const data = (await res.json()) as {
        members?: Member[];
        pending_invites?: PendingInvite[];
      };
      setMembers(data.members ?? []);
      setInvites(data.pending_invites ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setLastInviteUrl(null);
    try {
      const res = await fetch(`/api/workspaces/${slug}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = (await res.json()) as {
        error?: string;
        invite?: PendingInvite;
        message?: string;
      };
      if (!res.ok) throw new Error(data.error || "Uitnodigen mislukt");
      setInviteEmail("");
      setLastInviteUrl(data.invite?.inviteUrl ?? null);
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uitnodigen mislukt");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, role: MembershipRole) {
    if (!canManage) return;
    try {
      const res = await fetch(`/api/workspaces/${slug}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Rol wijzigen mislukt");
      }
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rol wijzigen mislukt");
    }
  }

  async function handleRemove(id: string) {
    if (!canManage) return;
    if (!confirm("Weet je zeker dat je dit wilt verwijderen?")) return;
    try {
      const res = await fetch(`/api/workspaces/${slug}/members/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Verwijderen mislukt");
      }
      await loadTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt");
    }
  }

  async function copyInviteUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopiëren mislukt — selecteer de link handmatig");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {workspaces.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Workspace">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => setSelected(ws.id)}
              className={cn(
                "min-h-[var(--ds-touch-min,44px)] rounded-xl px-4 py-2.5 text-sm font-medium",
                selected === ws.id
                  ? "bg-accent/15 text-accent"
                  : "border border-border bg-surface text-text-secondary"
              )}
            >
              {ws.label}
            </button>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team — {theme.name}</CardTitle>
          <CardDescription className="leading-relaxed">
            Beheer wie toegang heeft. Rollen:{" "}
            <strong>Beheerder</strong> (instellingen + team),{" "}
            <strong>Editor</strong> (chat + kennisbank),{" "}
            <strong>Kijker</strong> (alleen lezen).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-text-secondary">Laden…</p>
          ) : (
            <>
              {error ? (
                <p className="text-sm text-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Rol</TableHead>
                      {canManage ? <TableHead className="w-24" /> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 3 : 2}
                          className="text-text-secondary"
                        >
                          Nog geen teamleden. Nodig een collega uit om samen te werken.
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium">{m.email}</TableCell>
                          <TableCell>
                            {canManage ? (
                              <select
                                value={m.role}
                                onChange={(e) =>
                                  void handleRoleChange(
                                    m.id,
                                    e.target.value as MembershipRole
                                  )
                                }
                                className="min-h-[40px] rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                                aria-label={`Rol voor ${m.email}`}
                              >
                                <option value="admin">Beheerder</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Kijker</option>
                              </select>
                            ) : (
                              ROLE_LABELS[m.role] ?? m.role
                            )}
                          </TableCell>
                          {canManage ? (
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Verwijder ${m.email}`}
                                onClick={() => void handleRemove(m.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {invites.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-text-primary">
                    Openstaande uitnodigingen
                  </h3>
                  <ul className="space-y-2">
                    {invites.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-elevated/40 px-3 py-2 text-sm"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-text-secondary" />
                        <span className="font-medium">{inv.email}</span>
                        <span className="text-text-secondary">
                          ({ROLE_LABELS[inv.role]})
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="ml-auto"
                          onClick={() => void copyInviteUrl(inv.inviteUrl)}
                        >
                          <Copy className="h-4 w-4" />
                          Link
                        </Button>
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Intrekken"
                            onClick={() => void handleRemove(inv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {canManage ? (
                <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
                  <h3 className="text-sm font-medium text-text-primary">
                    Teamlid uitnodigen
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Genereer een uitnodigingslink en stuur die naar je collega per
                    e-mail of WhatsApp.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1">
                      <label htmlFor="invite-email" className="text-sm font-medium">
                        E-mailadres
                      </label>
                      <Input
                        id="invite-email"
                        type="email"
                        touchFriendly
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="collega@voorbeeld.nl"
                        required
                      />
                    </div>
                    <div className="space-y-1 sm:w-40">
                      <label htmlFor="invite-role" className="text-sm font-medium">
                        Rol
                      </label>
                      <select
                        id="invite-role"
                        value={inviteRole}
                        onChange={(e) =>
                          setInviteRole(e.target.value as MembershipRole)
                        }
                        className="flex min-h-[var(--ds-touch-min,44px)] w-full rounded-xl border border-border bg-surface px-3 text-base"
                      >
                        <option value="viewer">Kijker</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Beheerder</option>
                      </select>
                    </div>
                    <Button
                      type="submit"
                      size="touch"
                      disabled={inviting || !inviteEmail.trim()}
                      className="w-full sm:w-auto"
                    >
                      <UserPlus className="h-5 w-5" />
                      {inviting ? "Bezig…" : "Uitnodigen"}
                    </Button>
                  </div>
                  {lastInviteUrl ? (
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
                      <p className="font-medium text-text-primary">
                        Uitnodigingslink (7 dagen geldig)
                      </p>
                      <code className="mt-1 block break-all text-xs text-text-secondary">
                        {lastInviteUrl}
                      </code>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => void copyInviteUrl(lastInviteUrl)}
                      >
                        <Copy className="h-4 w-4" />
                        {copied ? "Gekopieerd" : "Kopieer link"}
                      </Button>
                    </div>
                  ) : null}
                </form>
              ) : (
                <p className="text-sm text-text-secondary">
                  Alleen beheerders kunnen teamleden uitnodigen of rollen wijzigen.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
