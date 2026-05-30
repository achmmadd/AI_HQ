import type { AppRow } from "./apps-db";

export type AppPwaConfig = {
  manifestPath: string;
  swPath: string;
  startUrl: string;
  scope: string;
};

export function getPwaConfigForApp(app: AppRow): AppPwaConfig {
  const isInternal = app.type === "internal";
  const basePath = isInternal ? `/apps/${app.slug}` : `/embed/fumero/app/${app.slug}`;
  const scope = isInternal ? `/apps/${app.slug}/` : `/embed/fumero/app/${app.slug}/`;
  return {
    manifestPath: `${basePath}/manifest.json`,
    swPath: `${basePath}/sw.js`,
    startUrl: basePath,
    scope,
  };
}

export function buildWebAppManifest(app: AppRow): Record<string, unknown> {
  const cfg = getPwaConfigForApp(app);
  return {
    name: app.naam,
    short_name: app.naam.length > 20 ? app.naam.slice(0, 17) + "..." : app.naam,
    description: `${app.naam} (${app.type} full-stack app)`,
    start_url: cfg.startUrl,
    scope: cfg.scope,
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#69C400",
    orientation: "any",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}

export function buildServiceWorkerScript(app: AppRow): string {
  const cfg = getPwaConfigForApp(app);
  const safeSlug = app.slug.replace(/[^a-z0-9-]/g, "");
  // Minimal SW: cache shell + static assets; network-first for data API calls; offline fallback.
  return `const CACHE = 'fullapp-${safeSlug}-v1';
const SHELL = [${JSON.stringify(cfg.startUrl)}, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // For data API: network first (live data), fallback cache if offline
  const isDataApi = url.pathname.includes('/api/apps/') && url.pathname.includes('/data');
  if (isDataApi) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const clone = r.clone(); caches.open(CACHE).then(c => c.put(req, clone)); } return r; }).catch(() => caches.match(req)));
    return;
  }
  // Shell + icons: cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok && url.origin === self.location.origin) { const c2 = r.clone(); caches.open(CACHE).then(c => c.put(req, c2)); } return r; }).catch(() => caches.match(${JSON.stringify(cfg.startUrl)}))));
});
`;
}
