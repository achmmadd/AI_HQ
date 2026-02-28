-- =============================================
-- OMEGA HOLDING TABELLEN
-- Voegt toe aan bestaande data/omega.db
-- Raakt GEEN bestaande tabellen aan
-- =============================================

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    brand_voice TEXT,
    target_audience TEXT,
    industry TEXT,
    config JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holding_agents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('manager','teamleider','werker','auditor')),
    specialization TEXT,
    skills JSON DEFAULT '[]',
    model TEXT DEFAULT 'gemini',
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle','busy','error','offline')),
    parent_agent_id TEXT,
    confidence_threshold REAL DEFAULT 0.8,
    system_prompt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (parent_agent_id) REFERENCES holding_agents(id)
);

CREATE TABLE IF NOT EXISTS holding_tasks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    assigned_to TEXT,
    created_by TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    input_data JSON,
    output_data JSON,
    status TEXT DEFAULT 'pending'
        CHECK(status IN ('pending','in_progress','review','approved','rejected')),
    priority INTEGER DEFAULT 5,
    confidence_score REAL,
    review_notes TEXT,
    reviewed_by TEXT,
    revision_count INTEGER DEFAULT 0,
    max_revisions INTEGER DEFAULT 3,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (assigned_to) REFERENCES holding_agents(id),
    FOREIGN KEY (reviewed_by) REFERENCES holding_agents(id)
);

CREATE TABLE IF NOT EXISTS corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    reviewer_agent_id TEXT NOT NULL,
    original_output TEXT,
    correction TEXT,
    reason TEXT,
    severity TEXT DEFAULT 'minor'
        CHECK(severity IN ('minor','major','critical')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES holding_tasks(id),
    FOREIGN KEY (reviewer_agent_id) REFERENCES holding_agents(id)
);

CREATE TABLE IF NOT EXISTS cost_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    model_used TEXT,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    task_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS holding_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT,
    agent_id TEXT,
    action TEXT NOT NULL,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hagents_tenant ON holding_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_htasks_tenant ON holding_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_htasks_status ON holding_tasks(status);
CREATE INDEX IF NOT EXISTS idx_htasks_assigned ON holding_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cost_tenant ON cost_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON holding_audit(tenant_id);
