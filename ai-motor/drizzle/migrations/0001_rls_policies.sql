-- Row Level Security — cross-tenant isolation at DB level (Sprint 1.1 / M5 prod).
-- Session vars: app.workspace_id, app.user_id, app.bypass_rls (admin migrations only).

ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_memberships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workspace_memberships" FORCE ROW LEVEL SECURITY;

-- Bypass for migrations / superuser scripts
CREATE POLICY "workspaces_bypass" ON "workspaces"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "workspaces_tenant_select" ON "workspaces"
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (id::text = current_setting('app.workspace_id', true));

CREATE POLICY "workspaces_tenant_write" ON "workspaces"
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (id::text = current_setting('app.workspace_id', true));

CREATE POLICY "workspaces_tenant_update" ON "workspaces"
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING (id::text = current_setting('app.workspace_id', true))
  WITH CHECK (id::text = current_setting('app.workspace_id', true));

CREATE POLICY "workspaces_tenant_delete" ON "workspaces"
  AS PERMISSIVE FOR DELETE TO PUBLIC
  USING (id::text = current_setting('app.workspace_id', true));

CREATE POLICY "memberships_bypass" ON "workspace_memberships"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "memberships_tenant_all" ON "workspace_memberships"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (workspace_id::text = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "users_bypass" ON "users"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "users_tenant_select" ON "users"
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (
    id::text = current_setting('app.user_id', true)
    OR EXISTS (
      SELECT 1 FROM workspace_memberships wm
      WHERE wm.user_id = users.id
        AND wm.workspace_id::text = current_setting('app.workspace_id', true)
    )
  );

CREATE POLICY "users_tenant_insert" ON "users"
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (current_setting('app.workspace_id', true) IS NOT NULL);

CREATE POLICY "users_tenant_update" ON "users"
  AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING (
    id::text = current_setting('app.user_id', true)
    OR EXISTS (
      SELECT 1 FROM workspace_memberships wm
      WHERE wm.user_id = users.id
        AND wm.workspace_id::text = current_setting('app.workspace_id', true)
    )
  );

CREATE POLICY "users_tenant_delete" ON "users"
  AS PERMISSIVE FOR DELETE TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships wm
      WHERE wm.user_id = users.id
        AND wm.workspace_id::text = current_setting('app.workspace_id', true)
    )
  );
