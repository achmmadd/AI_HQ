-- Default workspaces — maps legacy fumero/bokas tenants (idempotent).
SELECT set_config('app.bypass_rls', '1', true);
INSERT INTO workspaces (slug, display_name, legacy_klant)
VALUES
  ('fumero', 'Fumero', 'fumero'),
  ('bokas', 'Bokas', 'bokas'),
  ('motor', 'Motor AI Factory', 'system'),
  ('personal', 'Personal', 'personal')
ON CONFLICT (slug) DO NOTHING;
