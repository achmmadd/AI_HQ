"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Reservering {
  id: number;
  naam: string;
  datum: string;
  tijd: string;
  personen: number;
  status: string;
  opmerkingen?: string | null;
}

interface MenuItem {
  id: number;
  naam: string;
  categorie: string;
  prijs: number | null;
  vegan: number;
  gluten_vrij: number;
}

interface PersoneelRow {
  id: number;
  naam: string;
  rol: string;
  telefoon?: string | null;
  email?: string | null;
}

interface ShiftRow {
  id: number;
  personeels_id: number;
  datum: string;
  start_tijd: string;
  eind_tijd: string;
  rol: string | null;
  status: string;
  personeel_naam: string | null;
  personeel_rol: string | null;
}

function mondayIso(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  return m.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function nlDateLabel(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

export function BokasOperationsDashboard() {
  const [reserveringen, setReserveringen] = useState<Reservering[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [personeel, setPersoneel] = useState<PersoneelRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [planWeekStart, setPlanWeekStart] = useState(() => mondayIso(new Date()));
  const [newRes, setNewRes] = useState({
    naam: "",
    datum: "",
    tijd: "",
    personen: 2,
  });
  const [newStaff, setNewStaff] = useState({
    naam: "",
    rol: "",
    telefoon: "",
    email: "",
  });
  const [newShift, setNewShift] = useState({
    personeels_id: "",
    datum: "",
    start_tijd: "10:00",
    eind_tijd: "18:00",
    rol: "",
  });

  const weekEnd = useMemo(() => addDaysIso(planWeekStart, 6), [planWeekStart]);

  const loadCore = useCallback(async () => {
    const [resData, menuData, persData] = await Promise.all([
      fetch("/api/bokas/reserveringen").then((r) => r.json()),
      fetch("/api/bokas/menu").then((r) => r.json()),
      fetch("/api/bokas/personeel").then((r) => r.json()),
    ]);
    setReserveringen(resData.reserveringen ?? []);
    setMenu(menuData.menu ?? []);
    setPersoneel(persData.personeel ?? []);
  }, []);

  const loadShifts = useCallback(async () => {
    const q = new URLSearchParams({
      from: planWeekStart,
      to: weekEnd,
    });
    const r = await fetch(`/api/bokas/shifts?${q}`);
    const j = await r.json();
    setShifts(Array.isArray(j.shifts) ? j.shifts : []);
  }, [planWeekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    loadCore()
      .finally(() => setLoading(false));
  }, [loadCore]);

  useEffect(() => {
    void loadShifts();
  }, [loadShifts]);

  useEffect(() => {
    setNewShift((s) => ({ ...s, datum: planWeekStart }));
  }, [planWeekStart]);

  const shiftsByDay = useMemo(() => {
    const m = new Map<string, ShiftRow[]>();
    for (const s of shifts) {
      const list = m.get(s.datum) ?? [];
      list.push(s);
      m.set(s.datum, list);
    }
    return m;
  }, [shifts]);

  const weekDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDaysIso(planWeekStart, i));
    }
    return days;
  }, [planWeekStart]);

  const addReservering = async () => {
    if (!newRes.naam || !newRes.datum || !newRes.tijd) return;
    const res = await fetch("/api/bokas/reserveringen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRes),
    });
    const data = await res.json();
    if (data.id) {
      setReserveringen((prev) => [
        ...prev,
        {
          ...newRes,
          id: data.id as number,
          status: "bevestigd",
        },
      ]);
      setNewRes({ naam: "", datum: "", tijd: "", personen: 2 });
    }
  };

  const addStaff = async () => {
    if (!newStaff.naam.trim() || !newStaff.rol.trim()) return;
    const res = await fetch("/api/bokas/personeel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        naam: newStaff.naam.trim(),
        rol: newStaff.rol.trim(),
        telefoon: newStaff.telefoon || undefined,
        email: newStaff.email || undefined,
      }),
    });
    const data = await res.json();
    if (data.id) {
      await loadCore();
      setNewStaff({ naam: "", rol: "", telefoon: "", email: "" });
    }
  };

  const addShift = async () => {
    const pid = parseInt(newShift.personeels_id, 10);
    if (!newShift.datum || Number.isNaN(pid)) return;
    const res = await fetch("/api/bokas/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personeels_id: pid,
        datum: newShift.datum,
        start_tijd: newShift.start_tijd,
        eind_tijd: newShift.eind_tijd,
        rol: newShift.rol || undefined,
      }),
    });
    const data = await res.json();
    if (data.id) {
      await loadShifts();
      setNewShift((s) => ({
        ...s,
        rol: "",
      }));
    }
  };

  const removeShift = async (id: number) => {
    await fetch(`/api/bokas/shifts/${id}`, { method: "DELETE" });
    await loadShifts();
  };

  const categorien = [...new Set(menu.map((m) => m.categorie))];

  return (
      <div className="space-y-6">
        <p className="text-sm text-text-secondary">
          Horeca — reserveringen, menu, personeel en weekplanning
        </p>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-text-primary">Bonnetjes & Odoo</p>
              <p className="text-sm text-text-secondary">
                Wachtende bonnen goedkeuren, kwartaaloverzicht en CSV voor de boekhouder.
              </p>
            </div>
            <Link
              href="/bokas/bonnen"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Naar bonnen →
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="border-border/70">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-text-primary">Reviews</p>
                <p className="text-sm text-text-secondary">
                  Google-reviews bekijken en beantwoorden.
                </p>
              </div>
              <Link
                href="/bokas/reviews"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium"
              >
                Naar reviews →
              </Link>
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-text-primary">QR-menu artifacts</p>
                <p className="text-sm text-text-secondary">
                  Gebouwde QR-menu apps en previews voor Bokas.
                </p>
              </div>
              <Link
                href="/apps?klant=bokas"
                className="inline-flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium"
              >
                Naar apps →
              </Link>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reserveringen">
          <TabsList className="flex-wrap">
            <TabsTrigger value="reserveringen">Reserveringen</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="personeel">Personeel & planning</TabsTrigger>
          </TabsList>

          <TabsContent value="reserveringen" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nieuwe reservering</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Naam"
                  value={newRes.naam}
                  onChange={(e) =>
                    setNewRes((p) => ({ ...p, naam: e.target.value }))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Personen"
                  value={newRes.personen}
                  onChange={(e) =>
                    setNewRes((p) => ({
                      ...p,
                      personen: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
                <Input
                  type="date"
                  value={newRes.datum}
                  onChange={(e) =>
                    setNewRes((p) => ({ ...p, datum: e.target.value }))
                  }
                />
                <Input
                  type="time"
                  value={newRes.tijd}
                  onChange={(e) =>
                    setNewRes((p) => ({ ...p, tijd: e.target.value }))
                  }
                />
                <Button className="sm:col-span-2" onClick={addReservering}>
                  Reservering toevoegen
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {loading ? (
                <p className="text-sm text-text-secondary">Laden…</p>
              ) : reserveringen.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Geen reserveringen
                </p>
              ) : (
                reserveringen.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-medium">{r.naam}</p>
                        <p className="text-sm text-text-secondary">
                          {r.datum} · {r.tijd} · {r.personen} personen
                        </p>
                        {r.opmerkingen ? (
                          <p className="text-xs text-text-secondary">
                            {r.opmerkingen}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={
                          r.status === "bevestigd"
                            ? "rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400"
                            : "rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-700 dark:text-amber-400"
                        }
                      >
                        {r.status}
                      </span>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="menu" className="mt-4 space-y-6">
            {categorien.map((cat) => (
              <div key={cat}>
                <h3 className="mb-2 font-medium capitalize">{cat}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {menu
                    .filter((m) => m.categorie === cat)
                    .map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-3">
                          <div className="flex justify-between gap-2">
                            <span className="text-sm font-medium">
                              {item.naam}
                            </span>
                            <span className="text-sm text-text-secondary">
                              {item.prijs != null ? `€${item.prijs}` : "—"}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.vegan ? (
                              <span className="rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                vegan
                              </span>
                            ) : null}
                            {item.gluten_vrij ? (
                              <span className="rounded bg-sky-500/15 px-1 text-[10px] text-sky-700 dark:text-sky-400">
                                GV
                              </span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            ))}
            {menu.length === 0 && !loading ? (
              <p className="text-sm text-text-secondary">
                Nog geen menu-items — voeg toe via{" "}
                <code className="text-xs">POST /api/bokas/menu</code>
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="personeel" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nieuw teamlid</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Naam"
                  value={newStaff.naam}
                  onChange={(e) =>
                    setNewStaff((p) => ({ ...p, naam: e.target.value }))
                  }
                />
                <Input
                  placeholder="Rol (bv. bediening, keuken)"
                  value={newStaff.rol}
                  onChange={(e) =>
                    setNewStaff((p) => ({ ...p, rol: e.target.value }))
                  }
                />
                <Input
                  placeholder="Telefoon (optioneel)"
                  value={newStaff.telefoon}
                  onChange={(e) =>
                    setNewStaff((p) => ({ ...p, telefoon: e.target.value }))
                  }
                />
                <Input
                  placeholder="E-mail (optioneel)"
                  value={newStaff.email}
                  onChange={(e) =>
                    setNewStaff((p) => ({ ...p, email: e.target.value }))
                  }
                />
                <Button className="sm:col-span-2" onClick={() => void addStaff()}>
                  Teamlid toevoegen
                </Button>
              </CardContent>
            </Card>

            <div>
              <h3 className="mb-2 text-sm font-medium">Team</h3>
              {personeel.length === 0 && !loading ? (
                <p className="text-sm text-text-secondary">
                  Nog geen actief personeel — voeg hierboven iemand toe.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {personeel.map((p) => (
                    <Card key={p.id}>
                      <CardContent className="p-4">
                        <p className="font-medium">{p.naam}</p>
                        <p className="text-sm text-text-secondary">{p.rol}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Weekplanning</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() =>
                      setPlanWeekStart((w) => addDaysIso(w, -7))
                    }
                  >
                    ← Week
                  </Button>
                  <span className="text-xs text-text-secondary">
                    {nlDateLabel(planWeekStart)} — {nlDateLabel(weekEnd)}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() =>
                      setPlanWeekStart((w) => addDaysIso(w, 7))
                    }
                  >
                    Week →
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setPlanWeekStart(mondayIso(new Date()))}
                  >
                    Deze week
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs text-text-secondary sm:col-span-2">
                    Medewerker
                    <select
                      className="mt-1 flex h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm"
                      value={newShift.personeels_id}
                      onChange={(e) =>
                        setNewShift((s) => ({
                          ...s,
                          personeels_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Kies…</option>
                      {personeel.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.naam} — {p.rol}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-text-secondary">
                    Dag
                    <Input
                      type="date"
                      className="mt-1 rounded-xl"
                      value={newShift.datum}
                      onChange={(e) =>
                        setNewShift((s) => ({ ...s, datum: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-xs text-text-secondary">
                    Rol shift (optioneel)
                    <Input
                      className="mt-1 rounded-xl"
                      placeholder="Dienst"
                      value={newShift.rol}
                      onChange={(e) =>
                        setNewShift((s) => ({ ...s, rol: e.target.value }))
                      }
                    />
                  </label>
                  <label className="text-xs text-text-secondary">
                    Start
                    <Input
                      type="time"
                      className="mt-1 rounded-xl"
                      value={newShift.start_tijd}
                      onChange={(e) =>
                        setNewShift((s) => ({
                          ...s,
                          start_tijd: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs text-text-secondary">
                    Einde
                    <Input
                      type="time"
                      className="mt-1 rounded-xl"
                      value={newShift.eind_tijd}
                      onChange={(e) =>
                        setNewShift((s) => ({
                          ...s,
                          eind_tijd: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="flex items-end sm:col-span-2">
                    <Button
                      type="button"
                      className="w-full rounded-xl sm:w-auto"
                      disabled={!newShift.personeels_id || !newShift.datum}
                      onClick={() => void addShift()}
                    >
                      Dienst toevoegen
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-text-secondary">
                  Tip: kies een datum binnen de geselecteerde week om alles in
                  één oogopslag te zien.
                </p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {weekDays.map((day) => {
                const list = shiftsByDay.get(day) ?? [];
                return (
                  <div key={day}>
                    <h4 className="mb-2 text-sm font-medium text-text-primary">
                      {nlDateLabel(day)}{" "}
                      <span className="font-normal text-text-secondary">
                        ({day})
                      </span>
                    </h4>
                    {list.length === 0 ? (
                      <p className="text-xs text-text-secondary">
                        Geen diensten
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {list.map((s) => (
                          <Card key={s.id}>
                            <CardContent
                              className={cn(
                                "flex flex-wrap items-center justify-between gap-2 p-3"
                              )}
                            >
                              <div>
                                <p className="text-sm font-medium">
                                  {s.personeel_naam ?? `#${s.personeels_id}`}
                                </p>
                                <p className="text-xs text-text-secondary">
                                  {s.start_tijd} – {s.eind_tijd}
                                  {s.rol ? ` · ${s.rol}` : ""}
                                  {s.personeel_rol
                                    ? ` · ${s.personeel_rol}`
                                    : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    s.status === "gepland"
                                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                                      : "bg-surface-elevated text-text-secondary"
                                  )}
                                >
                                  {s.status}
                                </span>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="rounded-xl text-xs"
                                  onClick={() => void removeShift(s.id)}
                                >
                                  Verwijder
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );
}
