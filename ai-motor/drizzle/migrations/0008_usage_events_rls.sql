-- RLS for usage_events (Sprint 2.3.2)

ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "usage_events_bypass" ON "usage_events"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "usage_events_tenant_select" ON "usage_events"
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "usage_events_tenant_insert" ON "usage_events"
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));
