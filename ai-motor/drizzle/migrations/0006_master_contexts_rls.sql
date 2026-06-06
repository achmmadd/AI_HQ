-- RLS for master_contexts (Sprint 1.3)

ALTER TABLE "master_contexts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "master_contexts" FORCE ROW LEVEL SECURITY;

CREATE POLICY "master_contexts_bypass" ON "master_contexts"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "master_contexts_tenant_all" ON "master_contexts"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (workspace_id::text = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));
