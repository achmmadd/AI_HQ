-- RLS for tenant data tables (Sprint 1.2). audit_events is append-only (no UPDATE/DELETE policies).

ALTER TABLE "chat_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "chat_history" FORCE ROW LEVEL SECURITY;
ALTER TABLE "approvals" FORCE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_documents" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "chat_history_bypass" ON "chat_history"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "chat_history_tenant_all" ON "chat_history"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (workspace_id::text = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "approvals_bypass" ON "approvals"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "approvals_tenant_all" ON "approvals"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (workspace_id::text = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "knowledge_documents_bypass" ON "knowledge_documents"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "knowledge_documents_tenant_all" ON "knowledge_documents"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (workspace_id::text = current_setting('app.workspace_id', true))
  WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "audit_events_bypass" ON "audit_events"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.bypass_rls', true) = '1')
  WITH CHECK (current_setting('app.bypass_rls', true) = '1');

CREATE POLICY "audit_events_tenant_select" ON "audit_events"
  AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "audit_events_tenant_insert" ON "audit_events"
  AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));
