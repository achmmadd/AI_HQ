"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function BokasPage() {
  const [reserveringen, setReserveringen] = useState<Reservering[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [personeel, setPersoneel] = useState<PersoneelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRes, setNewRes] = useState({
    naam: "",
    datum: "",
    tijd: "",
    personen: 2,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/bokas/reserveringen").then((r) => r.json()),
      fetch("/api/bokas/menu").then((r) => r.json()),
      fetch("/api/bokas/personeel").then((r) => r.json()),
    ])
      .then(([resData, menuData, persData]) => {
        setReserveringen(resData.reserveringen ?? []);
        setMenu(menuData.menu ?? []);
        setPersoneel(persData.personeel ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

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

  const categorien = [...new Set(menu.map((m) => m.categorie))];

  return (
    <AppShell title="Bokas">
      <div className="space-y-6">
        <p className="text-sm text-text-secondary">
          Horeca — reserveringen, menu en personeel
        </p>

        <Tabs defaultValue="reserveringen">
          <TabsList>
            <TabsTrigger value="reserveringen">Reserveringen</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="personeel">Personeel</TabsTrigger>
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

          <TabsContent value="personeel" className="mt-4">
            {personeel.length === 0 && !loading ? (
              <p className="text-sm text-text-secondary">
                Geen actief personeel — planning volgt (shifts API staat klaar
                in de database).
              </p>
            ) : (
              <div className="space-y-2">
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
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
