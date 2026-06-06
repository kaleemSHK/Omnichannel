-- ADR-007: Dynamic multi-tenant RBAC (Phase 1)
-- Global permission + page catalog; tenant roles, assignments, multi-role support.

-- ── Global catalog (not tenant-scoped) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS rbac_modules (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rbac_actions (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rbac_module_actions (
  module_key  TEXT NOT NULL REFERENCES rbac_modules (key) ON DELETE CASCADE,
  action_key  TEXT NOT NULL REFERENCES rbac_actions (key) ON DELETE CASCADE,
  PRIMARY KEY (module_key, action_key)
);

CREATE TABLE IF NOT EXISTS rbac_pages (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  route       TEXT NOT NULL,
  icon        TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

-- ── Tenant-scoped roles ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  role_type     TEXT NOT NULL DEFAULT 'custom'
    CHECK (role_type IN ('tenant_admin', 'supervisor', 'agent', 'manager', 'custom')),
  status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  is_system     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_roles_tenant ON tenant_roles (tenant_id);

CREATE TABLE IF NOT EXISTS tenant_role_permissions (
  role_id       UUID NOT NULL REFERENCES tenant_roles (id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted       BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS tenant_role_pages (
  role_id     UUID NOT NULL REFERENCES tenant_roles (id) ON DELETE CASCADE,
  page_key    TEXT NOT NULL REFERENCES rbac_pages (key),
  visible     BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (role_id, page_key)
);

-- ── User assignments (Chatwoot user overlay) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  chatwoot_user_id    BIGINT NOT NULL,
  full_name           TEXT,
  email               TEXT,
  phone               TEXT,
  department          TEXT,
  team                TEXT,
  supervisor_user_id  BIGINT,
  status              TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, chatwoot_user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users (tenant_id);

CREATE TABLE IF NOT EXISTS tenant_user_roles (
  tenant_user_id  UUID NOT NULL REFERENCES tenant_users (id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES tenant_roles (id) ON DELETE CASCADE,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_user_id, role_id)
);

-- ── RLS (tenant isolation) ────────────────────────────────────────────────────

ALTER TABLE tenant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_roles;
CREATE POLICY tenant_isolation ON tenant_roles
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE tenant_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_role_permissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_role_permissions;
CREATE POLICY tenant_isolation ON tenant_role_permissions
  USING (
    role_id IN (SELECT id FROM tenant_roles WHERE tenant_id = current_setting('app.tenant_id', true))
  )
  WITH CHECK (
    role_id IN (SELECT id FROM tenant_roles WHERE tenant_id = current_setting('app.tenant_id', true))
  );

ALTER TABLE tenant_role_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_role_pages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_role_pages;
CREATE POLICY tenant_isolation ON tenant_role_pages
  USING (
    role_id IN (SELECT id FROM tenant_roles WHERE tenant_id = current_setting('app.tenant_id', true))
  )
  WITH CHECK (
    role_id IN (SELECT id FROM tenant_roles WHERE tenant_id = current_setting('app.tenant_id', true))
  );

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_users;
CREATE POLICY tenant_isolation ON tenant_users
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE tenant_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_user_roles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_user_roles;
CREATE POLICY tenant_isolation ON tenant_user_roles
  USING (
    tenant_user_id IN (SELECT id FROM tenant_users WHERE tenant_id = current_setting('app.tenant_id', true))
  )
  WITH CHECK (
    tenant_user_id IN (SELECT id FROM tenant_users WHERE tenant_id = current_setting('app.tenant_id', true))
  );
