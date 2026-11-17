-- Schema inicial do Gestor Fácil para Supabase PostgreSQL.
-- O backend também aplica esta estrutura automaticamente na inicialização.

CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      document TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      plan TEXT NOT NULL DEFAULT 'Profissional',
      allow_negative_stock SMALLINT NOT NULL DEFAULT 0 CHECK (allow_negative_stock IN (0, 1)),
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_platform_admin SMALLINT NOT NULL DEFAULT 0 CHECK (is_platform_admin IN (0, 1)),
      status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK ((is_platform_admin = 1 AND company_id IS NULL) OR (is_platform_admin = 0 AND company_id IS NOT NULL))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
      is_platform_admin SMALLINT NOT NULL DEFAULT 0 CHECK (is_platform_admin IN (0, 1)),
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'Layers',
      route TEXT NOT NULL UNIQUE,
      section TEXT NOT NULL DEFAULT 'Operação',
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      is_core SMALLINT NOT NULL DEFAULT 0 CHECK (is_core IN (0, 1)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS company_modules (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      enabled SMALLINT NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(company_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS company_business_state (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
      summary TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_company_modules_company_id ON company_modules(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_modules_module_id ON company_modules(module_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

    -- O acesso ao banco ocorre somente pelo backend. Nenhuma chave pública do navegador
    -- recebe permissão para consultar ou alterar estas tabelas diretamente.
    ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE company_business_state ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE companies, users, sessions, modules, company_modules, company_business_state, audit_logs FROM anon, authenticated;
