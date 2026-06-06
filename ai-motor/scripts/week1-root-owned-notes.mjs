#!/usr/bin/env node
/**
 * Week 1 — patch root-owned files (run once with write access):
 *   sudo chown -R "$USER:$USER" middleware.ts lib/knowledge-search.ts \
 *     app/api/qdrant/search/route.ts components/kennisbank-search.tsx \
 *     app/api/conversations/route.ts app/api/conversations/[id]/route.ts
 *
 * Then apply the snippets below manually or via your editor.
 */

console.log(`
=== middleware.ts ===
Remove public /api/chat and /api/conversations; whitelist bridge only:

  if (pathname.startsWith("/api/chat/bridge/")) return true;
  // DELETE: if (pathname.startsWith("/api/chat")) return true;
  // DELETE: if (pathname.startsWith("/api/conversations")) return true;

=== lib/knowledge-search.ts ===
Replace file body with re-export from knowledge-service (see repo).

=== app/api/qdrant/search/route.ts ===
Optional: replace with searchKnowledge wrapper (rewrite already points to /api/knowledge/qdrant-search).

=== components/kennisbank-search.tsx ===
Error hint: replace hardcoded factory_os with dynamic collections from API response (j.collections).
`);
