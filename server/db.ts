import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, type PoolClient, type QueryResult } from 'pg';

dotenv.config();
import type {
  AuditLogEntry,
  AuthUser,
  CompanyModuleBinding,
  CompanySettings,
  CompanySummary,
  Customer,
  FinancialEntry,
  FinancialPayment,
  PaymentMethod,
  PlatformModule,
  Product,
  PurchaseOrder,
  Quote,
  Sale,
  Service,
  ServiceOrder,
  StockBalance,
  StockMovement,
  Warehouse,
} from '../src/types/gestor.ts';

export interface CompanyBusinessState {
  paymentMethods: PaymentMethod[];
  customers: Customer[];
  products: Product[];
  services: Service[];
  warehouses: Warehouse[];
  stockBalances: StockBalance[];
  stockMovements: StockMovement[];
  sales: Sale[];
  quotes: Quote[];
  serviceOrders: ServiceOrder[];
  financialEntries: FinancialEntry[];
  financialPayments: FinancialPayment[];
  purchaseOrders: PurchaseOrder[];
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL não configurada. Informe a connection string PostgreSQL do Supabase no ambiente do servidor.'
  );
}

const caCert = readFileSync(
  resolve(process.cwd(), 'certs', 'prod-ca-2021.crt'),
  'utf8'
);

const databaseUrl = new URL(connectionString);
databaseUrl.searchParams.delete('sslmode');
databaseUrl.searchParams.delete('sslrootcert');

const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl: {
    ca: caCert,
    rejectUnauthorized: true,
  },
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/** Compatibilidade assíncrona com a pequena API usada pelo backend antigo. */
export const db = {
  prepare(sql: string) {
    const statement = toPostgresPlaceholders(sql);
    return {
      async get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined> {
        const result = await pool.query(statement, params);
        return result.rows[0] as T | undefined;
      },
      async all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]> {
        const result = await pool.query(statement, params);
        return result.rows as T[];
      },
      async run(...params: unknown[]): Promise<{ changes: number }> {
        const result = await pool.query(statement, params);
        return { changes: result.rowCount ?? 0 };
      },
    };
  },
  async exec(sql: string): Promise<QueryResult> {
    return pool.query(sql);
  },
};

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

export async function initSchema(): Promise<void> {
  await pool.query(`
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
  `);
}

const MODULES: Array<Omit<PlatformModule, 'created_at' | 'updated_at'>> = [
  { id: 'mod-dashboard', slug: 'dashboard', name: 'Dashboard', description: 'Painel executivo com indicadores financeiros e operacionais.', icon: 'LayoutDashboard', route: '/dashboard', section: 'Visão geral', display_order: 1, is_active: true, is_core: true },
  { id: 'mod-clientes', slug: 'clientes', name: 'Clientes', description: 'Cadastro com validação de CPF/CNPJ e histórico do cliente.', icon: 'Users', route: '/clientes', section: 'Cadastros', display_order: 2, is_active: true, is_core: false },
  { id: 'mod-produtos', slug: 'produtos', name: 'Produtos e serviços', description: 'Catálogo com preço, custo, margem calculada e estoque mínimo.', icon: 'Package', route: '/produtos-servicos', section: 'Cadastros', display_order: 3, is_active: true, is_core: false },
  { id: 'mod-estoque', slug: 'estoque', name: 'Estoque', description: 'Saldo físico, reservado e disponível com movimentações.', icon: 'Boxes', route: '/estoque', section: 'Operação', display_order: 4, is_active: true, is_core: false },
  { id: 'mod-vendas', slug: 'vendas', name: 'Vendas', description: 'Registro de vendas com baixa automática de estoque e financeiro.', icon: 'ShoppingCart', route: '/vendas', section: 'Operação', display_order: 5, is_active: true, is_core: false },
  { id: 'mod-orcamentos', slug: 'orcamentos', name: 'Orçamentos', description: 'Propostas comerciais com conversão em venda ou ordem de serviço.', icon: 'FileText', route: '/orcamentos', section: 'Operação', display_order: 6, is_active: true, is_core: false },
  { id: 'mod-ordens-servico', slug: 'ordens_servico', name: 'Ordens de serviço', description: 'Controle técnico de equipamentos, peças e mão de obra.', icon: 'Wrench', route: '/ordens-servico', section: 'Operação', display_order: 7, is_active: true, is_core: false },
  { id: 'mod-compras', slug: 'compras', name: 'Compras', description: 'Pedidos de compra com fornecedores e entrada prevista.', icon: 'Truck', route: '/compras', section: 'Operação', display_order: 8, is_active: true, is_core: false },
  { id: 'mod-financeiro', slug: 'financeiro', name: 'Financeiro', description: 'Contas a receber e a pagar separadas do fluxo de caixa.', icon: 'Wallet', route: '/financeiro', section: 'Gestão', display_order: 9, is_active: true, is_core: false },
  { id: 'mod-configuracoes', slug: 'configuracoes', name: 'Configurações', description: 'Dados da empresa, regras operacionais e formas de pagamento.', icon: 'Settings', route: '/configuracoes', section: 'Gestão', display_order: 10, is_active: true, is_core: true },
];

export async function seedDatabase(): Promise<void> {
  const ts = nowIso();
  for (const module of MODULES) {
    await db.prepare(`
      INSERT INTO modules (id, slug, name, description, icon, route, section, display_order, is_active, is_core, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (slug) DO NOTHING
    `).run(
      module.id,
      module.slug,
      module.name,
      module.description,
      module.icon,
      module.route,
      module.section,
      module.display_order,
      module.is_active ? 1 : 0,
      module.is_core ? 1 : 0,
      ts,
      ts,
    );
  }
}

/** Cria o administrador somente no primeiro provisionamento; nunca redefine senha existente. */
export async function ensureAccountProvisioning(): Promise<void> {
  const adminEmail = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!adminEmail) {
    throw new Error('Configure PLATFORM_ADMIN_EMAIL no ambiente antes de iniciar o Gestor Fácil.');
  }

  const existing = await db.prepare('SELECT id, is_platform_admin FROM users WHERE LOWER(email) = ?').get<{
    id: string;
    is_platform_admin: number;
  }>(adminEmail);

  if (existing) {
    if (existing.is_platform_admin !== 1) {
      throw new Error('O e-mail definido em PLATFORM_ADMIN_EMAIL já pertence a uma conta de cliente. Use outro e-mail.');
    }
    return;
  }

  const adminPassword = String(process.env.PLATFORM_ADMIN_PASSWORD || '');
  if (adminPassword.length < 16) {
    throw new Error('Para criar o administrador inicial, configure PLATFORM_ADMIN_PASSWORD com pelo menos 16 caracteres.');
  }

  await db.prepare(`
    INSERT INTO users (id, company_id, name, email, password_hash, is_platform_admin, status, created_at)
    VALUES (?, NULL, ?, ?, ?, 1, 'ativo', ?)
  `).run(
    `usr-platform-admin-${crypto.randomUUID()}`,
    'Administrador da plataforma',
    adminEmail,
    hashPassword(adminPassword),
    nowIso(),
  );
}

interface RawModuleRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  section: string;
  display_order: number;
  is_active: number;
  is_core: number;
  created_at: string;
  updated_at: string;
}

export function mapModuleRow(row: RawModuleRow): PlatformModule {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    route: row.route,
    section: row.section,
    display_order: Number(row.display_order),
    is_active: Number(row.is_active) === 1,
    is_core: Number(row.is_core) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getAllPlatformModules(): Promise<PlatformModule[]> {
  const rows = await db.prepare('SELECT * FROM modules ORDER BY display_order ASC, name ASC').all<RawModuleRow>();
  return rows.map(mapModuleRow);
}

export async function getAllCompaniesSummary(): Promise<CompanySummary[]> {
  return db.prepare(
    'SELECT id, name, legal_name, document, email, phone, plan, status, created_at FROM companies ORDER BY name ASC'
  ).all<CompanySummary>();
}

export async function getAuthorizedModulesForCompany(companyId: string): Promise<PlatformModule[]> {
  const rows = await db.prepare(`
    SELECT m.*
    FROM modules m
    INNER JOIN company_modules cm ON cm.module_id = m.id
    WHERE cm.company_id = ? AND cm.enabled = 1 AND m.is_active = 1
    ORDER BY m.display_order ASC, m.name ASC
  `).all<RawModuleRow>(companyId);
  return rows.map(mapModuleRow);
}

export async function isModuleAuthorizedForCompany(companyId: string, slug: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT m.id
    FROM modules m
    INNER JOIN company_modules cm ON cm.module_id = m.id
    WHERE cm.company_id = ? AND m.slug = ? AND cm.enabled = 1 AND m.is_active = 1
    LIMIT 1
  `).get<{ id: string }>(companyId, slug);
  return Boolean(row);
}

export async function getCompanySettingsById(companyId: string): Promise<CompanySettings | null> {
  const row = await db.prepare('SELECT * FROM companies WHERE id = ?').get<{
    id: string; name: string; legal_name: string; document: string; email: string;
    phone: string; address: string; city: string; state: string;
    plan: 'Gratuito' | 'Profissional' | 'Empresarial'; allow_negative_stock: number;
  }>(companyId);
  if (!row) return null;

  const authorized = await getAuthorizedModulesForCompany(companyId);
  const slugs = authorized.map((module) => module.slug);
  const segments: CompanySettings['segment_features'] = [];
  if (slugs.includes('vendas') || slugs.includes('estoque') || slugs.includes('produtos')) segments.push('comercio');
  if (slugs.includes('ordens_servico')) segments.push('servicos');
  if (segments.length === 0) segments.push('comercio');

  return {
    id: row.id,
    name: row.name,
    legal_name: row.legal_name,
    document: row.document,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    currency: 'BRL',
    timezone: 'America/Sao_Paulo',
    allow_negative_stock: Number(row.allow_negative_stock) === 1,
    segment_features: segments,
    enabled_modules: slugs,
    plan: row.plan,
  };
}

const EMPTY_STATE = (companyId: string): CompanyBusinessState => ({
  paymentMethods: [
    { id: 'pm-pix', name: 'Pix', type: 'pix', active: true },
    { id: 'pm-dinheiro', name: 'Dinheiro', type: 'dinheiro', active: true },
    { id: 'pm-credito', name: 'Cartão de Crédito', type: 'cartao_credito', active: true },
  ],
  customers: [], products: [], services: [],
  warehouses: [{ id: `wh-${companyId}-01`, company_id: companyId, name: 'Matriz Principal', location: 'Sede' }],
  stockBalances: [], stockMovements: [], sales: [], quotes: [], serviceOrders: [],
  financialEntries: [], financialPayments: [], purchaseOrders: [],
});

export async function getCompanyState(companyId: string): Promise<CompanyBusinessState> {
  const row = await db.prepare('SELECT state_json FROM company_business_state WHERE company_id = ?').get<{
    state_json: CompanyBusinessState | string;
  }>(companyId);
  if (!row) return EMPTY_STATE(companyId);
  if (typeof row.state_json === 'string') return JSON.parse(row.state_json) as CompanyBusinessState;
  return row.state_json;
}

export async function saveCompanyState(companyId: string, state: CompanyBusinessState): Promise<void> {
  await db.prepare(`
    INSERT INTO company_business_state (company_id, state_json, updated_at)
    VALUES (?, ?::jsonb, ?)
    ON CONFLICT (company_id) DO UPDATE
    SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at
  `).run(companyId, JSON.stringify(state), nowIso());
}

export async function recordAuditLog(entry: {
  actor_user_id: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  company_id?: string | null;
  summary: string;
  old_data?: unknown;
  new_data?: unknown;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, actor_email, action, target_type, target_id, company_id, summary, old_data, new_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud-${crypto.randomUUID().slice(0, 12)}`,
    entry.actor_user_id,
    entry.actor_email,
    entry.action,
    entry.target_type,
    entry.target_id,
    entry.company_id ?? null,
    entry.summary,
    entry.old_data !== undefined ? JSON.stringify(entry.old_data) : null,
    entry.new_data !== undefined ? JSON.stringify(entry.new_data) : null,
    nowIso(),
  );
}

export async function getAdminOverview(): Promise<{
  companies: CompanySummary[];
  modules: PlatformModule[];
  companyModules: CompanyModuleBinding[];
  auditLogs: AuditLogEntry[];
  userEmailsByCompany: Record<string, string>;
}> {
  const companies = await getAllCompaniesSummary();
  const modules = await getAllPlatformModules();
  const rawBindings = await db.prepare(
    'SELECT company_id, module_id, enabled, updated_at FROM company_modules'
  ).all<{ company_id: string; module_id: string; enabled: number; updated_at: string }>();
  const companyModules: CompanyModuleBinding[] = rawBindings.map((binding) => ({
    company_id: binding.company_id,
    module_id: binding.module_id,
    enabled: Number(binding.enabled) === 1,
    updated_at: binding.updated_at,
  }));
  const auditLogs = await db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 80').all<AuditLogEntry>();
  const userRows = await db.prepare(
    'SELECT company_id, email FROM users WHERE is_platform_admin = 0 AND company_id IS NOT NULL'
  ).all<{ company_id: string; email: string }>();
  const userEmailsByCompany: Record<string, string> = {};
  for (const row of userRows) userEmailsByCompany[row.company_id] = row.email;
  return { companies, modules, companyModules, auditLogs, userEmailsByCompany };
}

export async function findUserBySessionToken(token: string): Promise<AuthUser | null> {
  const row = await db.prepare(`
    SELECT u.id, u.company_id, u.name, u.email, u.is_platform_admin, u.status, s.expires_at
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND u.status = 'ativo'
  `).get<{
    id: string; company_id: string | null; name: string; email: string;
    is_platform_admin: number; status: 'ativo' | 'inativo'; expires_at: string;
  }>(hashSessionToken(token));

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').run(hashSessionToken(token));
    return null;
  }
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    email: row.email,
    is_platform_admin: Number(row.is_platform_admin) === 1,
    status: row.status,
  };
}
