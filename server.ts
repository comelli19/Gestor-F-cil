import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import {
  db,
  closeDatabase,
  ensureAccountProvisioning,
  findUserBySessionToken,
  getAdminOverview,
  getAllCompaniesSummary,
  getAllPlatformModules,
  getAuthorizedModulesForCompany,
  getCompanySettingsById,
  getCompanyState,
  hashPassword,
  hashSessionToken,
  initSchema,
  isModuleAuthorizedForCompany,
  mapModuleRow,
  nowIso,
  recordAuditLog,
  saveCompanyState,
  seedDatabase,
  verifyPassword,
  withTransaction,
} from './server/db.ts';
import { generateShareToken, onlyDigits, roundCents } from './src/lib/formatters.ts';
import type {
  AuthUser,
  Customer,
  FinancialEntry,
  FinancialPayment,
  PaymentMethod,
  Product,
  PurchaseOrder,
  Quote,
  QuoteItem,
  QuoteStatus,
  Sale,
  SaleItem,
  SaleStatus,
  Service,
  ServiceOrder,
  ServiceOrderItem,
  ServiceOrderStatus,
  StockBalance,
  StockMovement,
  StockMovementType,
} from './src/types/gestor.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json({ limit: '2mb' }));

// Express 4 não encaminha automaticamente rejeições de handlers async para o middleware de erro.
const routeMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;
for (const method of routeMethods) {
  const original = app[method].bind(app) as (...args: any[]) => any;
  (app as any)[method] = (...args: any[]) => original(...args.map((handler: any) => {
    if (typeof handler !== 'function') return handler;
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        Promise.resolve(handler(req, res, next)).catch(next);
      } catch (error) {
        next(error);
      }
    };
  }));
}


interface AuthenticatedRequest extends Request {
  auth?: AuthUser;
  authToken?: string;
  effectiveCompanyId?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sessão não autenticada. Faça login para continuar.' });
    return;
  }
  const user = await findUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Faça login novamente.' });
    return;
  }
  req.auth = user;
  req.authToken = token;
  next();
}

function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Sessão não autenticada.' });
    return;
  }
  if (!req.auth.is_platform_admin) {
    res.status(403).json({
      error: 'Acesso negado: somente o administrador principal (desenvolvedor) pode gerenciar módulos da plataforma.',
    });
    return;
  }
  next();
}

async function resolveAdminPreviewCompanyId(req: Request): Promise<string | null> {
  const headerId =
    typeof req.headers['x-admin-company-id'] === 'string'
      ? req.headers['x-admin-company-id'].trim()
      : '';
  const queryId = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';
  const requestedId = headerId || queryId;

  if (requestedId) {
    const found = await db.prepare('SELECT id FROM companies WHERE id = ?').get(requestedId) as
      | { id: string }
      | undefined;
    if (found) return found.id;
  }

  const firstCompany = await db
    .prepare('SELECT id FROM companies ORDER BY name ASC LIMIT 1')
    .get() as { id: string } | undefined;
  return firstCompany?.id ?? null;
}

async function requireClientCompany(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ error: 'Sessão não autenticada.' });
    return;
  }

  // Administrador principal pode selecionar uma empresa para visualizar e testar todas as telas
  if (req.auth.is_platform_admin) {
    const previewCompanyId = await resolveAdminPreviewCompanyId(req);
    if (!previewCompanyId) {
      req.effectiveCompanyId = '';
      next();
      return;
    }
    req.effectiveCompanyId = previewCompanyId;
    next();
    return;
  }

  if (!req.auth.company_id) {
    res.status(403).json({
      error: 'Esta operação pertence ao contexto de uma empresa cliente.',
    });
    return;
  }

  // Proteção contra manipulação de company_id via query ou body
  const bodyCompanyId =
    req.body && typeof req.body === 'object' && 'company_id' in req.body
      ? String((req.body as Record<string, unknown>).company_id || '')
      : '';
  const queryCompanyId = typeof req.query.company_id === 'string' ? req.query.company_id : '';
  if (
    (bodyCompanyId && bodyCompanyId !== req.auth.company_id) ||
    (queryCompanyId && queryCompanyId !== req.auth.company_id)
  ) {
    res.status(403).json({
      error: 'Violação de isolamento de empresa: não é permitido acessar ou alterar dados de outra empresa.',
    });
    return;
  }
  req.effectiveCompanyId = req.auth.company_id;
  next();
}

function requireModuleEnabled(slug: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (req.auth?.is_platform_admin) {
      if (!req.effectiveCompanyId) {
        res.status(404).json({ error: 'Nenhuma empresa selecionada para teste.' });
        return;
      }
      next();
      return;
    }

    const companyId = req.effectiveCompanyId || req.auth?.company_id;
    if (!companyId) {
      res.status(403).json({ error: 'Empresa não vinculada à sessão.' });
      return;
    }
    if (!await isModuleAuthorizedForCompany(companyId, slug)) {
      res.status(403).json({
        error: `Acesso bloqueado: o módulo "${slug}" não está habilitado para esta empresa.`,
        module_slug: slug,
      });
      return;
    }
    next();
  };
}

function updateBalanceQty(
  balances: StockBalance[],
  productId: string,
  warehouseId: string,
  physicalDelta: number,
  reservedDelta = 0
): StockBalance[] {
  const exists = balances.find(
    (b) => b.product_id === productId && b.warehouse_id === warehouseId
  );
  if (!exists) {
    return [
      ...balances,
      {
        product_id: productId,
        warehouse_id: warehouseId,
        physical_qty: roundCents(physicalDelta),
        reserved_qty: Math.max(0, roundCents(reservedDelta)),
      },
    ];
  }
  return balances.map((b) =>
    b.product_id === productId && b.warehouse_id === warehouseId
      ? {
          ...b,
          physical_qty: roundCents(b.physical_qty + physicalDelta),
          reserved_qty: Math.max(0, roundCents(b.reserved_qty + reservedDelta)),
        }
      : b
  );
}

// Health check
app.get('/api/health', async (_req, res) => {
  await db.exec('SELECT 1');
  res.json({ ok: true, database: 'connected', service: 'gestor-facil', timezone: 'America/Sao_Paulo' });
});

// ==================== AUTH ====================
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  if (!email || !password) {
    res.status(400).json({ error: 'Informe e-mail e senha para entrar.' });
    return;
  }

  const userRow = await db
    .prepare('SELECT * FROM users WHERE LOWER(email) = ?')
    .get(email) as
    | {
        id: string;
        company_id: string | null;
        name: string;
        email: string;
        password_hash: string;
        is_platform_admin: number;
        status: 'ativo' | 'inativo';
      }
    | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    return;
  }

  if (userRow.status !== 'ativo') {
    res.status(403).json({ error: 'Usuário inativo. Contate o administrador da plataforma.' });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  await db.prepare(
    `INSERT INTO sessions (token, user_id, company_id, is_platform_admin, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(hashSessionToken(token), userRow.id, userRow.company_id, userRow.is_platform_admin, expiresAt, createdAt);

  const user: AuthUser = {
    id: userRow.id,
    company_id: userRow.company_id,
    name: userRow.name,
    email: userRow.email,
    is_platform_admin: userRow.is_platform_admin === 1,
    status: userRow.status,
  };

  if (user.is_platform_admin) {
    res.json({
      token,
      user,
      company: null,
      modules: await getAllPlatformModules(),
    });
    return;
  }

  const company = user.company_id ? await getCompanySettingsById(user.company_id) : null;
  const modules = user.company_id ? await getAuthorizedModulesForCompany(user.company_id) : [];

  res.json({
    token,
    user,
    company,
    modules,
  });
});

app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.authToken) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').run(hashSessionToken(req.authToken));
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.auth!;
  if (user.is_platform_admin) {
    res.json({ user, company: null, modules: await getAllPlatformModules() });
    return;
  }
  const company = user.company_id ? await getCompanySettingsById(user.company_id) : null;
  const modules = user.company_id ? await getAuthorizedModulesForCompany(user.company_id) : [];
  res.json({ user, company, modules });
});

// ==================== ROUTE / MODULE ACCESS GUARD ====================
app.get('/api/modules/check-access', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.auth!;
  const routeQuery = typeof req.query.route === 'string' ? req.query.route.trim() : '';
  const slugQuery = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';

  if (user.is_platform_admin) {
    res.json({ allowed: true, admin: true });
    return;
  }

  if (routeQuery.startsWith('/admin')) {
    res.status(403).json({
      allowed: false,
      error: 'Acesso negado: área administrativa exclusiva do desenvolvedor da plataforma.',
    });
    return;
  }

  if (!user.company_id) {
    res.status(403).json({ allowed: false, error: 'Empresa não vinculada.' });
    return;
  }

  const authorized = await getAuthorizedModulesForCompany(user.company_id);
  const found = authorized.find(
    (m) => (slugQuery && m.slug === slugQuery) || (routeQuery && m.route === routeQuery)
  );

  if (!found) {
    res.status(403).json({
      allowed: false,
      error: 'Acesso negado: este módulo não está habilitado para a sua empresa.',
    });
    return;
  }

  res.json({ allowed: true, module: found });
});

// ==================== CLIENT WORKSPACE BOOTSTRAP ====================
app.get('/api/workspace/bootstrap', requireAuth, requireClientCompany, async (req: AuthenticatedRequest, res) => {
  const companyId = req.effectiveCompanyId || '';
  const isAdminPreview = Boolean(req.auth!.is_platform_admin);
  if (isAdminPreview && !companyId) {
    res.json({
      company: null,
      modules: await getAllPlatformModules(),
      enabledModuleIdsForCompany: [],
      adminCompanies: await getAllCompaniesSummary(),
      data: {
        paymentMethods: [], customers: [], products: [], services: [], warehouses: [],
        stockBalances: [], stockMovements: [], sales: [], quotes: [], serviceOrders: [],
        financialEntries: [], financialPayments: [], purchaseOrders: [],
      },
    });
    return;
  }
  const company = await getCompanySettingsById(companyId);
  const authorizedForCompany = await getAuthorizedModulesForCompany(companyId);
  const modules = isAdminPreview ? await getAllPlatformModules() : authorizedForCompany;
  const enabledSlugs = new Set(authorizedForCompany.map((m) => m.slug));
  const state = await getCompanyState(companyId);

  // Para clientes, só retorna dados dos módulos efetivamente habilitados para a empresa!
  // Para o administrador principal, libera todas as coleções para visualização e testes completos.
  const allowCustomers =
    isAdminPreview ||
    enabledSlugs.has('clientes') ||
    enabledSlugs.has('vendas') ||
    enabledSlugs.has('orcamentos') ||
    enabledSlugs.has('ordens_servico') ||
    enabledSlugs.has('financeiro');
  const allowCatalog =
    isAdminPreview ||
    enabledSlugs.has('produtos') ||
    enabledSlugs.has('estoque') ||
    enabledSlugs.has('vendas') ||
    enabledSlugs.has('orcamentos') ||
    enabledSlugs.has('ordens_servico') ||
    enabledSlugs.has('dashboard');

  res.json({
    company,
    modules,
    enabledModuleIdsForCompany: authorizedForCompany.map((m) => m.id),
    adminCompanies: isAdminPreview ? await getAllCompaniesSummary() : undefined,
    data: {
      paymentMethods:
        isAdminPreview ||
        enabledSlugs.has('configuracoes') ||
        enabledSlugs.has('vendas') ||
        enabledSlugs.has('financeiro')
          ? state.paymentMethods
          : [],
      customers: allowCustomers ? state.customers : [],
      products: allowCatalog ? state.products : [],
      services:
        isAdminPreview ||
        enabledSlugs.has('produtos') ||
        enabledSlugs.has('orcamentos') ||
        enabledSlugs.has('ordens_servico')
          ? state.services
          : [],
      warehouses:
        isAdminPreview ||
        enabledSlugs.has('estoque') ||
        enabledSlugs.has('vendas') ||
        enabledSlugs.has('ordens_servico')
          ? state.warehouses
          : [],
      stockBalances:
        isAdminPreview ||
        enabledSlugs.has('estoque') ||
        enabledSlugs.has('vendas') ||
        enabledSlugs.has('ordens_servico') ||
        enabledSlugs.has('dashboard')
          ? state.stockBalances
          : [],
      stockMovements: isAdminPreview || enabledSlugs.has('estoque') ? state.stockMovements : [],
      sales: isAdminPreview || enabledSlugs.has('vendas') || enabledSlugs.has('dashboard') ? state.sales : [],
      quotes:
        isAdminPreview || enabledSlugs.has('orcamentos') || enabledSlugs.has('dashboard')
          ? state.quotes
          : [],
      serviceOrders:
        isAdminPreview || enabledSlugs.has('ordens_servico') || enabledSlugs.has('dashboard')
          ? state.serviceOrders
          : [],
      financialEntries:
        isAdminPreview || enabledSlugs.has('financeiro') || enabledSlugs.has('dashboard')
          ? state.financialEntries
          : [],
      financialPayments:
        isAdminPreview || enabledSlugs.has('financeiro') || enabledSlugs.has('dashboard')
          ? state.financialPayments
          : [],
      purchaseOrders: isAdminPreview || enabledSlugs.has('compras') ? state.purchaseOrders : [],
    },
  });
});

// ==================== CLIENT PROTECTED MODULE ENDPOINTS ====================

// M02: Clientes
app.post(
  '/api/modules/clientes/save',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('clientes'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const editingId = req.body?.editingId ? String(req.body.editingId) : undefined;
    const data = req.body?.data as Omit<Customer, 'id' | 'company_id' | 'created_at'> | undefined;

    if (!data || !data.name?.trim()) {
      res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
      return;
    }

    const cleanDoc = onlyDigits(data.document || '');
    if (cleanDoc) {
      const duplicate = state.customers.find(
        (c) => onlyDigits(c.document) === cleanDoc && c.id !== editingId
      );
      if (duplicate) {
        res.status(409).json({
          error: `Já existe um cliente cadastrado com este documento (${duplicate.name}).`,
        });
        return;
      }
    }

    if (editingId) {
      state.customers = state.customers.map((c) =>
        c.id === editingId ? { ...c, ...data, document: cleanDoc, company_id: companyId } : c
      );
    } else {
      const created: Customer = {
        ...data,
        document: cleanDoc,
        id: `cli-${Date.now()}`,
        company_id: companyId,
        created_at: new Date().toISOString().slice(0, 10),
      };
      state.customers = [created, ...state.customers];
    }

    await saveCompanyState(companyId, state);
    res.json({ ok: true, customers: state.customers });
  }
);

app.patch(
  '/api/modules/clientes/:id/toggle',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('clientes'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const id = String(req.params.id);
    state.customers = state.customers.map((c) =>
      c.id === id ? { ...c, status: c.status === 'ativo' ? 'inativo' : 'ativo' } : c
    );
    await saveCompanyState(companyId, state);
    res.json({ ok: true, customers: state.customers });
  }
);

// M03: Produtos e Serviços
app.post(
  '/api/modules/produtos/products/save',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('produtos'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const editingId = req.body?.editingId ? String(req.body.editingId) : undefined;
    const data = req.body?.data as Omit<Product, 'id' | 'company_id'> | undefined;

    if (!data || !data.name?.trim()) {
      res.status(400).json({ error: 'Nome do produto é obrigatório.' });
      return;
    }

    if (editingId) {
      state.products = state.products.map((p) =>
        p.id === editingId ? { ...p, ...data, company_id: companyId } : p
      );
    } else {
      const created: Product = {
        ...data,
        id: `prod-${Date.now()}`,
        company_id: companyId,
      };
      state.products = [created, ...state.products];
      if (created.tracks_stock && state.warehouses[0]) {
        state.stockBalances = [
          ...state.stockBalances,
          {
            product_id: created.id,
            warehouse_id: state.warehouses[0].id,
            physical_qty: 0,
            reserved_qty: 0,
          },
        ];
      }
    }

    await saveCompanyState(companyId, state);
    res.json({ ok: true, products: state.products, stockBalances: state.stockBalances });
  }
);

app.patch(
  '/api/modules/produtos/products/:id/toggle',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('produtos'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const id = String(req.params.id);
    state.products = state.products.map((p) =>
      p.id === id ? { ...p, status: p.status === 'ativo' ? 'inativo' : 'ativo' } : p
    );
    await saveCompanyState(companyId, state);
    res.json({ ok: true, products: state.products });
  }
);

app.post(
  '/api/modules/produtos/services/save',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('produtos'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const editingId = req.body?.editingId ? String(req.body.editingId) : undefined;
    const data = req.body?.data as Omit<Service, 'id' | 'company_id'> | undefined;

    if (!data || !data.name?.trim()) {
      res.status(400).json({ error: 'Nome do serviço é obrigatório.' });
      return;
    }

    if (editingId) {
      state.services = state.services.map((s) =>
        s.id === editingId ? { ...s, ...data, company_id: companyId } : s
      );
    } else {
      const created: Service = {
        ...data,
        id: `serv-${Date.now()}`,
        company_id: companyId,
      };
      state.services = [created, ...state.services];
    }

    await saveCompanyState(companyId, state);
    res.json({ ok: true, services: state.services });
  }
);

app.patch(
  '/api/modules/produtos/services/:id/toggle',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('produtos'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const id = String(req.params.id);
    state.services = state.services.map((s) =>
      s.id === id ? { ...s, status: s.status === 'ativo' ? 'inativo' : 'ativo' } : s
    );
    await saveCompanyState(companyId, state);
    res.json({ ok: true, services: state.services });
  }
);

// M04: Estoque
app.post(
  '/api/modules/estoque/movement',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('estoque'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const company = await getCompanySettingsById(companyId)!;
    const state = await getCompanyState(companyId);
    const input = req.body as {
      product_id: string;
      warehouse_id: string;
      target_warehouse_id?: string;
      movement_type:
        | 'entrada_compra'
        | 'saida_manual'
        | 'ajuste_inventario'
        | 'transferencia'
        | 'devolucao_cliente';
      quantity: number;
      unit_cost?: number;
      reason?: string;
      responsible: string;
    };

    const product = state.products.find((p) => p.id === input.product_id);
    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    const currentBalance = state.stockBalances.find(
      (b) => b.product_id === input.product_id && b.warehouse_id === input.warehouse_id
    ) ?? {
      product_id: input.product_id,
      warehouse_id: input.warehouse_id,
      physical_qty: 0,
      reserved_qty: 0,
    };

    const available = currentBalance.physical_qty - currentBalance.reserved_qty;

    if (input.movement_type === 'ajuste_inventario' && !input.reason?.trim()) {
      res.status(400).json({ error: 'Ajuste de inventário exige justificativa (RN-13).' });
      return;
    }

    if (input.movement_type === 'transferencia') {
      if (!input.target_warehouse_id || input.target_warehouse_id === input.warehouse_id) {
        res.status(400).json({ error: 'Selecione um local de destino diferente da origem.' });
        return;
      }
      if (input.quantity <= 0) {
        res.status(400).json({ error: 'A quantidade deve ser maior que zero.' });
        return;
      }
      if (!company.allow_negative_stock && available - input.quantity < 0) {
        res.status(400).json({
          error: `Saldo disponível insuficiente no local de origem (${available} ${product.unit}).`,
        });
        return;
      }

      const ts = nowIso();
      const refId = `TRF-${String(state.stockMovements.length + 1).padStart(4, '0')}`;
      const cost = input.unit_cost ?? product.cost_price;

      state.stockBalances = updateBalanceQty(
        state.stockBalances,
        input.product_id,
        input.warehouse_id,
        -input.quantity
      );
      state.stockBalances = updateBalanceQty(
        state.stockBalances,
        input.product_id,
        input.target_warehouse_id,
        input.quantity
      );

      const outMov: StockMovement = {
        id: `mov-${Date.now()}-out`,
        company_id: companyId,
        product_id: input.product_id,
        warehouse_id: input.warehouse_id,
        movement_type: 'transferencia_saida',
        quantity: -input.quantity,
        unit_cost: cost,
        source_type: 'Transferência',
        source_id: refId,
        reason: input.reason || 'Transferência entre locais',
        created_by: input.responsible || req.auth!.name,
        created_at: ts,
      };
      const inMov: StockMovement = {
        id: `mov-${Date.now()}-in`,
        company_id: companyId,
        product_id: input.product_id,
        warehouse_id: input.target_warehouse_id,
        movement_type: 'transferencia_entrada',
        quantity: input.quantity,
        unit_cost: cost,
        source_type: 'Transferência',
        source_id: refId,
        reason: input.reason || 'Transferência entre locais',
        created_by: input.responsible || req.auth!.name,
        created_at: ts,
      };
      state.stockMovements = [inMov, outMov, ...state.stockMovements];
      await saveCompanyState(companyId, state);
      res.json({ ok: true, stockBalances: state.stockBalances, stockMovements: state.stockMovements });
      return;
    }

    let delta = Number(input.quantity);
    const movType = input.movement_type as StockMovementType;
    if (input.movement_type === 'saida_manual') {
      delta = -Math.abs(delta);
    } else if (
      input.movement_type === 'entrada_compra' ||
      input.movement_type === 'devolucao_cliente'
    ) {
      delta = Math.abs(delta);
    }

    if (delta === 0 || Number.isNaN(delta)) {
      res.status(400).json({ error: 'Informe uma quantidade diferente de zero.' });
      return;
    }

    if (delta < 0 && !company.allow_negative_stock && available + delta < 0) {
      res.status(400).json({
        error: `Saldo disponível insuficiente (${available} ${product.unit}). Estoque negativo está bloqueado.`,
      });
      return;
    }

    state.stockBalances = updateBalanceQty(
      state.stockBalances,
      input.product_id,
      input.warehouse_id,
      delta
    );
    const newMov: StockMovement = {
      id: `mov-${Date.now()}`,
      company_id: companyId,
      product_id: input.product_id,
      warehouse_id: input.warehouse_id,
      movement_type: movType,
      quantity: delta,
      unit_cost: input.unit_cost ?? product.cost_price,
      source_type:
        movType === 'entrada_compra'
          ? 'Compra'
          : movType === 'ajuste_inventario'
            ? 'Inventário'
            : movType === 'devolucao_cliente'
              ? 'Devolução'
              : 'Mov. Manual',
      source_id: `MOV-${String(state.stockMovements.length + 12).padStart(4, '0')}`,
      reason: input.reason,
      created_by: input.responsible || req.auth!.name,
      created_at: nowIso(),
    };
    state.stockMovements = [newMov, ...state.stockMovements];
    await saveCompanyState(companyId, state);
    res.json({ ok: true, stockBalances: state.stockBalances, stockMovements: state.stockMovements });
  }
);

// M05: Vendas
app.post(
  '/api/modules/vendas/create',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('vendas'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const company = await getCompanySettingsById(companyId)!;
    const state = await getCompanyState(companyId);
    const payload = req.body as {
      customer_id: string | null;
      items: Omit<SaleItem, 'id'>[];
      discount: number;
      addition: number;
      payment_method_id: string;
      payment_condition: Sale['payment_condition'];
      paid_amount: number;
      status: SaleStatus;
      notes?: string;
    };

    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      res.status(400).json({ error: 'Informe ao menos um item na venda.' });
      return;
    }

    const subtotal = roundCents(payload.items.reduce((acc, i) => acc + i.total, 0));
    const total = roundCents(Math.max(0, subtotal - payload.discount + payload.addition));
    const docNum = `VND-${String(108 + state.sales.length).padStart(4, '0')}`;
    const today = new Date().toISOString().slice(0, 10);
    const defaultWh = state.warehouses[0]?.id ?? `wh-${companyId}-01`;

    if (payload.status !== 'rascunho' && !company.allow_negative_stock) {
      for (const item of payload.items) {
        const prod = state.products.find((p) => p.id === item.product_id);
        if (prod?.tracks_stock) {
          const bal = state.stockBalances.find(
            (b) => b.product_id === item.product_id && b.warehouse_id === defaultWh
          );
          const avail = (bal?.physical_qty ?? 0) - (bal?.reserved_qty ?? 0);
          if (avail < item.quantity) {
            res.status(400).json({
              error: `Estoque disponível insuficiente para "${prod.name}" (disp: ${avail}).`,
            });
            return;
          }
        }
      }
    }

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      company_id: companyId,
      document_number: docNum,
      customer_id: payload.customer_id,
      status: payload.status,
      items: payload.items.map((item, idx) => ({ ...item, id: `si-${Date.now()}-${idx}` })),
      subtotal,
      discount: roundCents(payload.discount),
      addition: roundCents(payload.addition),
      total,
      payment_method_id: payload.payment_method_id,
      payment_condition: payload.payment_condition,
      paid_amount: roundCents(payload.paid_amount),
      sale_date: today,
      notes: payload.notes,
    };

    state.sales = [newSale, ...state.sales];

    if (payload.status === 'aguardando_entrega') {
      for (const item of newSale.items) {
        state.stockBalances = updateBalanceQty(
          state.stockBalances,
          item.product_id,
          defaultWh,
          0,
          item.quantity
        );
      }
    } else if (payload.status === 'confirmada' || payload.status === 'entregue') {
      const ts = nowIso();
      for (const item of newSale.items) {
        state.stockBalances = updateBalanceQty(
          state.stockBalances,
          item.product_id,
          defaultWh,
          -item.quantity,
          0
        );
      }
      const movs: StockMovement[] = newSale.items.map((item, idx) => ({
        id: `mov-sale-${Date.now()}-${idx}`,
        company_id: companyId,
        product_id: item.product_id,
        warehouse_id: defaultWh,
        movement_type: 'saida_venda',
        quantity: -item.quantity,
        unit_cost: item.unit_cost,
        source_type: 'Venda',
        source_id: docNum,
        created_by: req.auth!.name,
        created_at: ts,
      }));
      state.stockMovements = [...movs, ...state.stockMovements];
    }

    if (payload.status !== 'rascunho' && total > 0) {
      const customerName =
        state.customers.find((c) => c.id === payload.customer_id)?.name || 'Consumidor Final';
      const paid = Math.min(total, roundCents(payload.paid_amount));
      const finStatus: FinancialEntry['status'] =
        paid >= total ? 'quitado' : paid > 0 ? 'parcial' : 'pendente';

      const entryId = `fin-${Date.now()}`;
      const newEntry: FinancialEntry = {
        id: entryId,
        company_id: companyId,
        entry_type: 'receber',
        origin_type: 'venda',
        origin_id: docNum,
        customer_id: payload.customer_id || undefined,
        description: `Venda ${docNum} — ${customerName}`,
        category: 'Vendas de Produtos',
        amount: total,
        paid_amount: paid,
        due_date: today,
        payment_method_id: payload.payment_method_id,
        status: finStatus,
      };
      state.financialEntries = [newEntry, ...state.financialEntries];

      if (paid > 0) {
        const pay: FinancialPayment = {
          id: `pay-${Date.now()}`,
          company_id: companyId,
          financial_entry_id: entryId,
          entry_type: 'receber',
          description: `Recebimento ${docNum}`,
          amount: paid,
          payment_date: today,
          payment_method_id: payload.payment_method_id,
        };
        state.financialPayments = [pay, ...state.financialPayments];
      }
    }

    await saveCompanyState(companyId, state);
    res.json({
      ok: true,
      sales: state.sales,
      stockBalances: state.stockBalances,
      stockMovements: state.stockMovements,
      financialEntries: state.financialEntries,
      financialPayments: state.financialPayments,
    });
  }
);

app.patch(
  '/api/modules/vendas/:id/status',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('vendas'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const saleId = String(req.params.id);
    const nextStatus = req.body?.status as SaleStatus;
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale || sale.status === nextStatus) {
      res.json({ ok: true, sales: state.sales });
      return;
    }

    const defaultWh = state.warehouses[0]?.id ?? `wh-${companyId}-01`;
    const ts = nowIso();

    if (nextStatus === 'cancelada') {
      if (sale.status === 'aguardando_entrega') {
        for (const item of sale.items) {
          state.stockBalances = updateBalanceQty(
            state.stockBalances,
            item.product_id,
            defaultWh,
            0,
            -item.quantity
          );
        }
      } else if (sale.status === 'confirmada' || sale.status === 'entregue') {
        for (const item of sale.items) {
          state.stockBalances = updateBalanceQty(
            state.stockBalances,
            item.product_id,
            defaultWh,
            item.quantity,
            0
          );
        }
        const estornos: StockMovement[] = sale.items.map((item, idx) => ({
          id: `mov-est-${Date.now()}-${idx}`,
          company_id: companyId,
          product_id: item.product_id,
          warehouse_id: defaultWh,
          movement_type: 'estorno',
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          source_type: 'Estorno Venda',
          source_id: sale.document_number,
          reason: 'Cancelamento de venda',
          created_by: req.auth!.name,
          created_at: ts,
        }));
        state.stockMovements = [...estornos, ...state.stockMovements];
      }
      state.financialEntries = state.financialEntries.map((f) =>
        f.origin_id === sale.document_number && f.status !== 'quitado'
          ? { ...f, status: 'cancelado' }
          : f
      );
    } else if (nextStatus === 'entregue' && sale.status === 'aguardando_entrega') {
      for (const item of sale.items) {
        state.stockBalances = updateBalanceQty(
          state.stockBalances,
          item.product_id,
          defaultWh,
          -item.quantity,
          -item.quantity
        );
      }
      const movs: StockMovement[] = sale.items.map((item, idx) => ({
        id: `mov-ent-${Date.now()}-${idx}`,
        company_id: companyId,
        product_id: item.product_id,
        warehouse_id: defaultWh,
        movement_type: 'saida_venda',
        quantity: -item.quantity,
        unit_cost: item.unit_cost,
        source_type: 'Venda',
        source_id: sale.document_number,
        created_by: req.auth!.name,
        created_at: ts,
      }));
      state.stockMovements = [...movs, ...state.stockMovements];
    }

    state.sales = state.sales.map((s) => (s.id === saleId ? { ...s, status: nextStatus } : s));
    await saveCompanyState(companyId, state);
    res.json({
      ok: true,
      sales: state.sales,
      stockBalances: state.stockBalances,
      stockMovements: state.stockMovements,
      financialEntries: state.financialEntries,
    });
  }
);

// M06: Orçamentos
app.post(
  '/api/modules/orcamentos/create',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('orcamentos'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const payload = req.body as {
      customer_id: string;
      items: Omit<QuoteItem, 'id'>[];
      discount: number;
      valid_until: string;
      payment_terms: string;
      notes: string;
      status: QuoteStatus;
    };

    if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
      res.status(400).json({ error: 'Informe ao menos um item no orçamento.' });
      return;
    }

    const subtotal = roundCents(payload.items.reduce((acc, i) => acc + i.total, 0));
    const total = roundCents(Math.max(0, subtotal - payload.discount));
    const docNum = `ORC-${String(90 + state.quotes.length).padStart(4, '0')}`;
    const newQuote: Quote = {
      id: `orc-${Date.now()}`,
      company_id: companyId,
      document_number: docNum,
      customer_id: payload.customer_id,
      status: payload.status,
      items: payload.items.map((item, idx) => ({ ...item, id: `qi-${Date.now()}-${idx}` })),
      subtotal,
      discount: roundCents(payload.discount),
      total,
      valid_until: payload.valid_until,
      payment_terms: payload.payment_terms,
      notes: payload.notes,
      share_token: generateShareToken(),
      revision: 1,
      created_at: new Date().toISOString().slice(0, 10),
    };
    state.quotes = [newQuote, ...state.quotes];
    await saveCompanyState(companyId, state);
    res.json({ ok: true, quotes: state.quotes, quote: newQuote });
  }
);

app.patch(
  '/api/modules/orcamentos/:id/status',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('orcamentos'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const quoteId = String(req.params.id);
    const nextStatus = req.body?.status as QuoteStatus;
    state.quotes = state.quotes.map((q) => (q.id === quoteId ? { ...q, status: nextStatus } : q));
    await saveCompanyState(companyId, state);
    res.json({ ok: true, quotes: state.quotes });
  }
);

app.post(
  '/api/modules/orcamentos/:id/convert',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('orcamentos'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const target = String(req.body?.target || '');
    const isAdmin = Boolean(req.auth?.is_platform_admin);
    if (!isAdmin && target === 'sale' && !await isModuleAuthorizedForCompany(companyId, 'vendas')) {
      res.status(403).json({
        error: 'Conversão bloqueada: o módulo de Vendas não está habilitado para esta empresa.',
      });
      return;
    }
    if (!isAdmin && target === 'os' && !await isModuleAuthorizedForCompany(companyId, 'ordens_servico')) {
      res.status(403).json({
        error: 'Conversão bloqueada: o módulo de Ordens de Serviço não está habilitado para esta empresa.',
      });
      return;
    }

    const company = await getCompanySettingsById(companyId)!;
    const state = await getCompanyState(companyId);
    const quoteId = String(req.params.id);
    const quote = state.quotes.find((q) => q.id === quoteId);
    if (!quote) {
      res.status(404).json({ error: 'Orçamento não encontrado.' });
      return;
    }
    if (quote.converted_at) {
      res.status(400).json({ error: 'Este orçamento já foi convertido anteriormente (RN-17).' });
      return;
    }

    const defaultWh = state.warehouses[0]?.id ?? `wh-${companyId}-01`;
    const today = new Date().toISOString().slice(0, 10);

    if (target === 'sale') {
      const productItems = quote.items.filter((i) => i.item_type === 'produto' && i.product_id);
      if (productItems.length === 0) {
        res.status(400).json({
          error: 'Este orçamento contém apenas serviços. Converta para Ordem de Serviço.',
        });
        return;
      }
      if (!company.allow_negative_stock) {
        for (const item of productItems) {
          const prod = state.products.find((p) => p.id === item.product_id);
          if (prod?.tracks_stock) {
            const bal = state.stockBalances.find(
              (b) => b.product_id === item.product_id && b.warehouse_id === defaultWh
            );
            const avail = (bal?.physical_qty ?? 0) - (bal?.reserved_qty ?? 0);
            if (avail < item.quantity) {
              res.status(400).json({
                error: `Estoque disponível insuficiente para "${prod.name}" (disp: ${avail}).`,
              });
              return;
            }
          }
        }
      }

      const saleItems: SaleItem[] = productItems.map((i, idx) => {
        const prod = state.products.find((p) => p.id === i.product_id);
        return {
          id: `si-${Date.now()}-${idx}`,
          product_id: i.product_id!,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: prod?.cost_price ?? 0,
          total: i.total,
        };
      });
      const subtotal = roundCents(saleItems.reduce((acc, i) => acc + i.total, 0));
      const total = roundCents(Math.max(0, subtotal - quote.discount));
      const docNum = `VND-${String(108 + state.sales.length).padStart(4, '0')}`;
      const pmId = state.paymentMethods.find((p) => p.active)?.id ?? 'pm-pix';

      const newSale: Sale = {
        id: `sale-${Date.now()}`,
        company_id: companyId,
        document_number: docNum,
        customer_id: quote.customer_id,
        status: 'confirmada',
        items: saleItems,
        subtotal,
        discount: quote.discount,
        addition: 0,
        total,
        payment_method_id: pmId,
        payment_condition: 'a_vista',
        paid_amount: 0,
        sale_date: today,
        notes: `Convertido do orçamento ${quote.document_number}`,
      };
      state.sales = [newSale, ...state.sales];

      const ts = nowIso();
      for (const item of saleItems) {
        state.stockBalances = updateBalanceQty(
          state.stockBalances,
          item.product_id,
          defaultWh,
          -item.quantity,
          0
        );
      }
      const movs: StockMovement[] = saleItems.map((item, idx) => ({
        id: `mov-sale-${Date.now()}-${idx}`,
        company_id: companyId,
        product_id: item.product_id,
        warehouse_id: defaultWh,
        movement_type: 'saida_venda',
        quantity: -item.quantity,
        unit_cost: item.unit_cost,
        source_type: 'Venda',
        source_id: docNum,
        created_by: req.auth!.name,
        created_at: ts,
      }));
      state.stockMovements = [...movs, ...state.stockMovements];

      if (total > 0) {
        const custName =
          state.customers.find((c) => c.id === quote.customer_id)?.name || 'Cliente';
        state.financialEntries = [
          {
            id: `fin-${Date.now()}`,
            company_id: companyId,
            entry_type: 'receber',
            origin_type: 'venda',
            origin_id: docNum,
            customer_id: quote.customer_id,
            description: `Venda ${docNum} — ${custName}`,
            category: 'Vendas de Produtos',
            amount: total,
            paid_amount: 0,
            due_date: today,
            payment_method_id: pmId,
            status: 'pendente',
          },
          ...state.financialEntries,
        ];
      }

      state.quotes = state.quotes.map((q) =>
        q.id === quoteId
          ? { ...q, status: 'aprovado', converted_at: nowIso(), converted_to: 'Venda' }
          : q
      );
      await saveCompanyState(companyId, state);
      res.json({
        ok: true,
        quotes: state.quotes,
        sales: state.sales,
        stockBalances: state.stockBalances,
        stockMovements: state.stockMovements,
        financialEntries: state.financialEntries,
      });
      return;
    }

    if (target === 'os') {
      const productItems = quote.items.filter((i) => i.item_type === 'produto' && i.product_id);
      if (!company.allow_negative_stock) {
        for (const item of productItems) {
          const prod = state.products.find((p) => p.id === item.product_id);
          if (prod?.tracks_stock) {
            const bal = state.stockBalances.find(
              (b) => b.product_id === item.product_id && b.warehouse_id === defaultWh
            );
            const avail = (bal?.physical_qty ?? 0) - (bal?.reserved_qty ?? 0);
            if (avail < item.quantity) {
              res.status(400).json({
                error: `Estoque disponível insuficiente para reservar "${prod.name}".`,
              });
              return;
            }
          }
        }
      }

      const osItems: ServiceOrderItem[] = quote.items.map((i, idx) => {
        const prod = i.product_id ? state.products.find((p) => p.id === i.product_id) : undefined;
        const serv = i.service_id ? state.services.find((s) => s.id === i.service_id) : undefined;
        return {
          id: `osi-${Date.now()}-${idx}`,
          item_type: i.item_type,
          product_id: i.product_id,
          service_id: i.service_id,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          unit_cost: prod?.cost_price ?? serv?.estimated_cost ?? 0,
          total: i.total,
        };
      });
      const total = roundCents(osItems.reduce((acc, i) => acc + i.total, 0));
      const docNum = `OS-${String(46 + state.serviceOrders.length).padStart(4, '0')}`;
      const newOs: ServiceOrder = {
        id: `os-${Date.now()}`,
        company_id: companyId,
        document_number: docNum,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        requested_service: `Execução referente ao orçamento ${quote.document_number}`,
        equipment: 'Conforme orçamento aprovado',
        problem_description: quote.notes || 'Solicitação originada de orçamento aprovado.',
        diagnosis: 'Aguardando verificação técnica.',
        technician: 'Equipe Técnica',
        status: 'aberta',
        items: osItems,
        labor_cost: 0,
        total,
        opened_at: today,
        expected_at: quote.valid_until,
        notes: `Convertido de ${quote.document_number}`,
      };
      state.serviceOrders = [newOs, ...state.serviceOrders];

      for (const item of productItems) {
        state.stockBalances = updateBalanceQty(
          state.stockBalances,
          item.product_id!,
          defaultWh,
          0,
          item.quantity
        );
      }

      state.quotes = state.quotes.map((q) =>
        q.id === quoteId
          ? { ...q, status: 'aprovado', converted_at: nowIso(), converted_to: 'Ordem de Serviço' }
          : q
      );
      await saveCompanyState(companyId, state);
      res.json({
        ok: true,
        quotes: state.quotes,
        serviceOrders: state.serviceOrders,
        stockBalances: state.stockBalances,
      });
      return;
    }

    res.status(400).json({ error: 'Destino de conversão inválido.' });
  }
);

// M07: Ordens de Serviço
app.post(
  '/api/modules/ordens_servico/create',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('ordens_servico'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const company = await getCompanySettingsById(companyId)!;
    const state = await getCompanyState(companyId);
    const payload = req.body as {
      customer_id: string;
      requested_service: string;
      equipment: string;
      problem_description: string;
      diagnosis: string;
      technician: string;
      items: Omit<ServiceOrderItem, 'id'>[];
      labor_cost: number;
      expected_at: string;
      notes: string;
    };

    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!payload?.customer_id || !payload?.requested_service?.trim()) {
      res.status(400).json({ error: 'Informe o cliente e o serviço solicitado na OS.' });
      return;
    }

    const defaultWh = state.warehouses[0]?.id ?? `wh-${companyId}-01`;
    const productItems = items.filter((i) => i.item_type === 'produto' && i.product_id);

    if (!company.allow_negative_stock) {
      for (const item of productItems) {
        const prod = state.products.find((p) => p.id === item.product_id);
        if (prod?.tracks_stock) {
          const bal = state.stockBalances.find(
            (b) => b.product_id === item.product_id && b.warehouse_id === defaultWh
          );
          const avail = (bal?.physical_qty ?? 0) - (bal?.reserved_qty ?? 0);
          if (avail < item.quantity) {
            res.status(400).json({
              error: `Estoque disponível insuficiente para reservar "${prod.name}".`,
            });
            return;
          }
        }
      }
    }

    const itemsTotal = roundCents(items.reduce((acc, i) => acc + i.total, 0));
    const total = roundCents(itemsTotal + (Number(payload.labor_cost) || 0));
    const docNum = `OS-${String(46 + state.serviceOrders.length).padStart(4, '0')}`;

    const newOs: ServiceOrder = {
      id: `os-${Date.now()}`,
      company_id: companyId,
      document_number: docNum,
      customer_id: payload.customer_id,
      requested_service: payload.requested_service,
      equipment: payload.equipment,
      problem_description: payload.problem_description,
      diagnosis: payload.diagnosis,
      technician: payload.technician,
      status: 'aberta',
      items: items.map((item, idx) => ({ ...item, id: `osi-${Date.now()}-${idx}` })),
      labor_cost: roundCents(Number(payload.labor_cost) || 0),
      total,
      opened_at: new Date().toISOString().slice(0, 10),
      expected_at: payload.expected_at,
      notes: payload.notes,
    };

    state.serviceOrders = [newOs, ...state.serviceOrders];
    for (const item of productItems) {
      state.stockBalances = updateBalanceQty(
        state.stockBalances,
        item.product_id!,
        defaultWh,
        0,
        item.quantity
      );
    }

    await saveCompanyState(companyId, state);
    res.json({
      ok: true,
      serviceOrders: state.serviceOrders,
      stockBalances: state.stockBalances,
    });
  }
);

app.patch(
  '/api/modules/ordens_servico/:id/status',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('ordens_servico'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const osId = String(req.params.id);
    const nextStatus = req.body?.status as ServiceOrderStatus;
    const generateReceivable = req.body?.generateReceivable !== false;

    const os = state.serviceOrders.find((o) => o.id === osId);
    if (!os || os.status === nextStatus) {
      res.json({ ok: true, serviceOrders: state.serviceOrders });
      return;
    }

    const defaultWh = state.warehouses[0]?.id ?? `wh-${companyId}-01`;
    const productItems = os.items.filter((i) => i.item_type === 'produto' && i.product_id);
    const ts = nowIso();
    const today = ts.slice(0, 10);
    const wasOpen = !['concluida', 'entregue', 'cancelada'].includes(os.status);

    if (nextStatus === 'concluida' && wasOpen) {
      if (productItems.length > 0) {
        for (const item of productItems) {
          state.stockBalances = updateBalanceQty(
            state.stockBalances,
            item.product_id!,
            defaultWh,
            -item.quantity,
            -item.quantity
          );
        }
        const movs: StockMovement[] = productItems.map((item, idx) => ({
          id: `mov-os-${Date.now()}-${idx}`,
          company_id: companyId,
          product_id: item.product_id!,
          warehouse_id: defaultWh,
          movement_type: 'saida_os',
          quantity: -item.quantity,
          unit_cost: item.unit_cost,
          source_type: 'OS',
          source_id: os.document_number,
          created_by: os.technician,
          created_at: ts,
        }));
        state.stockMovements = [...movs, ...state.stockMovements];
      }

      if (generateReceivable && os.total > 0) {
        const cust = state.customers.find((c) => c.id === os.customer_id);
        const alreadyExists = state.financialEntries.some(
          (f) => f.origin_id === os.document_number
        );
        if (!alreadyExists) {
          state.financialEntries = [
            {
              id: `fin-os-${Date.now()}`,
              company_id: companyId,
              entry_type: 'receber',
              origin_type: 'os',
              origin_id: os.document_number,
              customer_id: os.customer_id,
              description: `Ordem de Serviço ${os.document_number} — ${cust?.name ?? 'Cliente'}`,
              category: 'Prestação de Serviços',
              amount: os.total,
              paid_amount: 0,
              due_date: today,
              payment_method_id: 'pm-pix',
              status: 'pendente',
            },
            ...state.financialEntries,
          ];
        }
      }
    } else if (nextStatus === 'cancelada' && wasOpen && productItems.length > 0) {
      for (const item of productItems) {
        state.stockBalances = updateBalanceQty(
          state.stockBalances,
          item.product_id!,
          defaultWh,
          0,
          -item.quantity
        );
      }
    }

    state.serviceOrders = state.serviceOrders.map((o) =>
      o.id === osId
        ? {
            ...o,
            status: nextStatus,
            completed_at: nextStatus === 'concluida' ? today : o.completed_at,
          }
        : o
    );

    await saveCompanyState(companyId, state);
    res.json({
      ok: true,
      serviceOrders: state.serviceOrders,
      stockBalances: state.stockBalances,
      stockMovements: state.stockMovements,
      financialEntries: state.financialEntries,
    });
  }
);

// Módulo Compras
app.post(
  '/api/modules/compras/create',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('compras'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const payload = req.body as Omit<PurchaseOrder, 'id' | 'company_id' | 'document_number' | 'order_date'>;
    if (!payload?.supplier_name?.trim() || !payload?.items_summary?.trim()) {
      res.status(400).json({ error: 'Informe fornecedor e resumo dos itens.' });
      return;
    }
    const created: PurchaseOrder = {
      id: `po-${Date.now()}`,
      company_id: companyId,
      document_number: `CMP-${String(35 + state.purchaseOrders.length).padStart(4, '0')}`,
      supplier_name: payload.supplier_name.trim(),
      supplier_document: onlyDigits(payload.supplier_document || ''),
      items_summary: payload.items_summary.trim(),
      total: roundCents(Number(payload.total) || 0),
      status: payload.status || 'pendente',
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: payload.expected_date || new Date().toISOString().slice(0, 10),
    };
    state.purchaseOrders = [created, ...state.purchaseOrders];
    await saveCompanyState(companyId, state);
    res.json({ ok: true, purchaseOrders: state.purchaseOrders });
  }
);

app.patch(
  '/api/modules/compras/:id/status',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('compras'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const id = String(req.params.id);
    const nextStatus = req.body?.status as PurchaseOrder['status'];
    state.purchaseOrders = state.purchaseOrders.map((po) =>
      po.id === id ? { ...po, status: nextStatus } : po
    );
    await saveCompanyState(companyId, state);
    res.json({ ok: true, purchaseOrders: state.purchaseOrders });
  }
);

// M08: Financeiro
app.post(
  '/api/modules/financeiro/entries',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('financeiro'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const payload = req.body as {
      entry_type: FinancialEntry['entry_type'];
      description: string;
      category: string;
      amount: number;
      due_date: string;
      payment_method_id: string;
      customer_id?: string;
    };
    if (!payload?.description?.trim() || !(Number(payload.amount) > 0)) {
      res.status(400).json({ error: 'Informe descrição e valor maior que zero para o lançamento.' });
      return;
    }

    const newEntry: FinancialEntry = {
      id: `fin-${Date.now()}`,
      company_id: companyId,
      entry_type: payload.entry_type,
      origin_type: 'manual',
      origin_id: `LAN-${String(state.financialEntries.length + 101).padStart(4, '0')}`,
      customer_id: payload.customer_id,
      description: payload.description,
      category: payload.category,
      amount: roundCents(payload.amount),
      paid_amount: 0,
      due_date: payload.due_date,
      payment_method_id: payload.payment_method_id,
      status: 'pendente',
    };
    state.financialEntries = [newEntry, ...state.financialEntries];
    await saveCompanyState(companyId, state);
    res.json({ ok: true, financialEntries: state.financialEntries });
  }
);

app.post(
  '/api/modules/financeiro/payments',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('financeiro'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const payload = req.body as {
      entryId: string;
      amount: number;
      payment_date: string;
      payment_method_id: string;
      external_ref?: string;
    };

    const entry = state.financialEntries.find((f) => f.id === payload.entryId);
    if (!entry) {
      res.status(404).json({ error: 'Lançamento não encontrado.' });
      return;
    }

    const remaining = roundCents(entry.amount - entry.paid_amount);
    const val = roundCents(payload.amount);
    if (val <= 0 || val > remaining) {
      res.status(400).json({
        error: `Informe um valor entre R$ 0,01 e o saldo restante (R$ ${remaining.toFixed(2).replace('.', ',')}).`,
      });
      return;
    }

    if (payload.external_ref?.trim()) {
      const dup = state.financialPayments.find(
        (p) => p.external_ref && p.external_ref === payload.external_ref?.trim()
      );
      if (dup) {
        res.status(409).json({ error: 'Esta referência de pagamento já foi registrada (RN-22).' });
        return;
      }
    }

    const newPaid = roundCents(entry.paid_amount + val);
    const newStatus: FinancialEntry['status'] = newPaid >= entry.amount ? 'quitado' : 'parcial';

    state.financialEntries = state.financialEntries.map((f) =>
      f.id === payload.entryId ? { ...f, paid_amount: newPaid, status: newStatus } : f
    );

    const payment: FinancialPayment = {
      id: `pay-${Date.now()}`,
      company_id: companyId,
      financial_entry_id: entry.id,
      entry_type: entry.entry_type,
      description: `${entry.entry_type === 'receber' ? 'Recebimento' : 'Pagamento'} — ${entry.description}`,
      amount: val,
      payment_date: payload.payment_date,
      payment_method_id: payload.payment_method_id,
      external_ref: payload.external_ref?.trim() || undefined,
    };
    state.financialPayments = [payment, ...state.financialPayments];

    await saveCompanyState(companyId, state);
    res.json({
      ok: true,
      financialEntries: state.financialEntries,
      financialPayments: state.financialPayments,
    });
  }
);

// M09: Configurações (somente dados da empresa e formas de pagamento; NUNCA módulos!)
app.patch(
  '/api/modules/configuracoes/company',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('configuracoes'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const current = await getCompanySettingsById(companyId);
    if (!current) {
      res.status(404).json({ error: 'Empresa não encontrada.' });
      return;
    }
    const body = req.body as Partial<{
      name: string;
      legal_name: string;
      document: string;
      email: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      allow_negative_stock: boolean;
    }>;

    // Cliente NUNCA pode alterar enabled_modules ou plan por aqui
    await db.prepare(
      `UPDATE companies
       SET name = ?, legal_name = ?, document = ?, email = ?, phone = ?, address = ?, city = ?, state = ?, allow_negative_stock = ?
       WHERE id = ?`
    ).run(
      body.name ?? current.name,
      body.legal_name ?? current.legal_name,
      body.document !== undefined ? onlyDigits(body.document) : current.document,
      body.email ?? current.email,
      body.phone !== undefined ? onlyDigits(body.phone) : current.phone,
      body.address ?? current.address,
      body.city ?? current.city,
      body.state ?? current.state,
      body.allow_negative_stock !== undefined
        ? body.allow_negative_stock
          ? 1
          : 0
        : current.allow_negative_stock
          ? 1
          : 0,
      companyId
    );

    res.json({ ok: true, company: await getCompanySettingsById(companyId) });
  }
);

app.post(
  '/api/modules/configuracoes/payment-methods',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('configuracoes'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const name = String(req.body?.name ?? '').trim();
    const type = String(req.body?.type ?? 'pix') as PaymentMethod['type'];
    if (!name) {
      res.status(400).json({ error: 'Informe o nome da forma de pagamento.' });
      return;
    }
    const newMethod: PaymentMethod = {
      id: `pm-${Date.now()}`,
      name,
      type,
      active: true,
    };
    state.paymentMethods = [...state.paymentMethods, newMethod];
    await saveCompanyState(companyId, state);
    res.json({ ok: true, paymentMethods: state.paymentMethods });
  }
);

app.patch(
  '/api/modules/configuracoes/payment-methods/:id/toggle',
  requireAuth,
  requireClientCompany,
  requireModuleEnabled('configuracoes'),
  async (req: AuthenticatedRequest, res) => {
    const companyId = req.effectiveCompanyId!;
    const state = await getCompanyState(companyId);
    const id = String(req.params.id);
    state.paymentMethods = state.paymentMethods.map((pm) =>
      pm.id === id ? { ...pm, active: !pm.active } : pm
    );
    await saveCompanyState(companyId, state);
    res.json({ ok: true, paymentMethods: state.paymentMethods });
  }
);

// ==================== EXCLUSIVE PLATFORM ADMIN (DEVELOPER) ROUTES ====================

app.get('/api/admin/overview', requireAuth, requirePlatformAdmin, async (_req, res) => {
  res.json(await getAdminOverview());
});

app.post('/api/admin/modules', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  const actor = req.auth!;
  const name = String(req.body?.name ?? '').trim();
  const rawSlug = String(req.body?.slug ?? name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const description = String(req.body?.description ?? '').trim();
  const icon = String(req.body?.icon ?? 'Layers').trim();
  const section = String(req.body?.section ?? 'Operação').trim();
  const rawRoute = String(req.body?.route ?? '').trim();
  const route = rawRoute
    ? rawRoute.startsWith('/')
      ? rawRoute
      : `/${rawRoute}`
    : `/modulos/${rawSlug}`;
  const isActive = req.body?.is_active !== false;
  const enabledCompanyIds: string[] = Array.isArray(req.body?.enabled_company_ids)
    ? req.body.enabled_company_ids.map(String)
    : [];

  if (!name || !rawSlug) {
    res.status(400).json({ error: 'Informe nome e identificador (slug) válidos para o módulo.' });
    return;
  }
  if (route === '/' || route === '/login' || route.startsWith('/admin')) {
    res.status(400).json({ error: 'A rota informada é reservada pelo sistema e não pode ser usada por um módulo.' });
    return;
  }

  const dup = await db
    .prepare('SELECT id FROM modules WHERE slug = ? OR route = ?')
    .get(rawSlug, route) as { id: string } | undefined;
  if (dup) {
    res.status(409).json({ error: 'Já existe um módulo com este identificador ou rota.' });
    return;
  }

  const maxOrderRow = await db
    .prepare('SELECT COALESCE(MAX(display_order), 0) as max_ord FROM modules')
    .get() as { max_ord: number };
  const displayOrder = Number(req.body?.display_order ?? maxOrderRow.max_ord + 1);
  const id = `mod-${rawSlug}-${crypto.randomUUID()}`;
  const ts = nowIso();

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO modules (id, slug, name, description, icon, route, section, display_order, is_active, is_core, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11)`,
      [id, rawSlug, name, description, icon, route, section, displayOrder, isActive ? 1 : 0, ts, ts]
    );

    const companies = await client.query('SELECT id FROM companies');
    for (const comp of companies.rows as Array<{ id: string }>) {
      const enabled = enabledCompanyIds.includes(comp.id) ? 1 : 0;
      await client.query(
        `INSERT INTO company_modules (id, company_id, module_id, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [`cm-${comp.id}-${id}`, comp.id, id, enabled, ts]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (id, actor_user_id, actor_email, action, target_type, target_id, summary, new_data, created_at)
       VALUES ($1, $2, $3, 'CREATE_MODULE', 'module', $4, $5, $6, $7)`,
      [
        `aud-${crypto.randomUUID().slice(0, 12)}`,
        actor.id,
        actor.email,
        id,
        `Criou o módulo global "${name}" (${rawSlug}) na rota ${route}.`,
        JSON.stringify({ slug: rawSlug, name, route, section, isActive, enabledCompanyIds }),
        ts,
      ]
    );
  });

  res.status(201).json({ ok: true, overview: await getAdminOverview() });
});

app.patch('/api/admin/modules/:id', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  const actor = req.auth!;
  const id = String(req.params.id);
  const existing = await db.prepare('SELECT * FROM modules WHERE id = ?').get(id) as
    | {
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
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Módulo não encontrado.' });
    return;
  }

  const nextName = req.body?.name !== undefined ? String(req.body.name).trim() : existing.name;
  const nextDesc =
    req.body?.description !== undefined ? String(req.body.description).trim() : existing.description;
  const nextIcon = req.body?.icon !== undefined ? String(req.body.icon).trim() : existing.icon;
  const nextSection =
    req.body?.section !== undefined ? String(req.body.section).trim() : existing.section;
  const nextRouteRaw =
    req.body?.route !== undefined ? String(req.body.route).trim() : existing.route;
  const nextRoute = nextRouteRaw.startsWith('/') ? nextRouteRaw : `/${nextRouteRaw}`;
  const nextOrder =
    req.body?.display_order !== undefined
      ? Number(req.body.display_order)
      : existing.display_order;
  const nextActive =
    req.body?.is_active !== undefined ? Boolean(req.body.is_active) : existing.is_active === 1;

  if (!nextName) {
    res.status(400).json({ error: 'O nome do módulo não pode ficar vazio.' });
    return;
  }

  if (existing.is_core === 1 && !nextActive) {
    res.status(400).json({
      error: 'Módulos essenciais (Dashboard e Configurações) não podem ser desativados globalmente.',
    });
    return;
  }

  const routeClash = await db
    .prepare('SELECT id FROM modules WHERE route = ? AND id != ?')
    .get(nextRoute, id) as { id: string } | undefined;
  if (routeClash) {
    res.status(409).json({ error: 'Já existe outro módulo utilizando esta rota.' });
    return;
  }
  if (nextRoute === '/' || nextRoute === '/login' || nextRoute.startsWith('/admin')) {
    res.status(400).json({ error: 'A rota informada é reservada pelo sistema e não pode ser usada por um módulo.' });
    return;
  }

  const ts = nowIso();
  await db.prepare(
    `UPDATE modules
     SET name = ?, description = ?, icon = ?, route = ?, section = ?, display_order = ?, is_active = ?, updated_at = ?
     WHERE id = ?`
  ).run(nextName, nextDesc, nextIcon, nextRoute, nextSection, nextOrder, nextActive ? 1 : 0, ts, id);

  await recordAuditLog({
    actor_user_id: actor.id,
    actor_email: actor.email,
    action: 'UPDATE_MODULE',
    target_type: 'module',
    target_id: id,
    summary: `Atualizou o módulo "${nextName}" (ativo: ${nextActive ? 'Sim' : 'Não'}, ordem: ${nextOrder}).`,
    old_data: mapModuleRow(existing),
    new_data: {
      name: nextName,
      description: nextDesc,
      icon: nextIcon,
      route: nextRoute,
      section: nextSection,
      display_order: nextOrder,
      is_active: nextActive,
    },
  });

  res.json({ ok: true, overview: await getAdminOverview() });
});

app.put('/api/admin/modules/reorder', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  const actor = req.auth!;
  const orderedIds: string[] = Array.isArray(req.body?.orderedIds)
    ? req.body.orderedIds.map(String)
    : [];

  if (orderedIds.length === 0) {
    res.status(400).json({ error: 'Informe a lista ordenada de módulos.' });
    return;
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    res.status(400).json({ error: 'A lista de módulos contém identificadores duplicados.' });
    return;
  }
  const existingRows = await db.prepare('SELECT id FROM modules').all() as Array<{ id: string }>;
  const existingIds = new Set(existingRows.map((row) => row.id));
  if (orderedIds.length !== existingRows.length || orderedIds.some((id) => !existingIds.has(id))) {
    res.status(400).json({ error: 'Envie a lista completa e atualizada de módulos para reordenar o menu.' });
    return;
  }

  const ts = nowIso();
  await withTransaction(async (client) => {
    for (const [index, modId] of orderedIds.entries()) {
      await client.query(
        'UPDATE modules SET display_order = $1, updated_at = $2 WHERE id = $3',
        [index + 1, ts, modId]
      );
    }
  });

  await recordAuditLog({
    actor_user_id: actor.id,
    actor_email: actor.email,
    action: 'REORDER_MODULES',
    target_type: 'modules',
    target_id: 'all',
    summary: `Reordenou a sequência global de exibição de ${orderedIds.length} módulos no menu lateral.`,
    new_data: { orderedIds },
  });

  res.json({ ok: true, overview: await getAdminOverview() });
});

app.delete('/api/admin/modules/:id', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  const actor = req.auth!;
  const id = String(req.params.id);
  const existing = await db.prepare('SELECT * FROM modules WHERE id = ?').get(id) as
    | { id: string; slug: string; name: string; is_core: number }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Módulo não encontrado.' });
    return;
  }

  if (existing.is_core === 1) {
    res.status(400).json({
      error: 'Módulos essenciais do sistema (Dashboard e Configurações) não podem ser removidos.',
    });
    return;
  }

  await withTransaction(async (client) => {
    await client.query('DELETE FROM modules WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO audit_logs (id, actor_user_id, actor_email, action, target_type, target_id, summary, old_data, created_at)
       VALUES ($1, $2, $3, 'DELETE_MODULE', 'module', $4, $5, $6, $7)`,
      [
        `aud-${crypto.randomUUID().slice(0, 12)}`,
        actor.id,
        actor.email,
        id,
        `Removeu o módulo "${existing.name}" (${existing.slug}) da plataforma.`,
        JSON.stringify(existing),
        nowIso(),
      ]
    );
  });

  res.json({ ok: true, overview: await getAdminOverview() });
});

app.put(
  '/api/admin/companies/:companyId/modules/:moduleId',
  requireAuth,
  requirePlatformAdmin,
  async (req: AuthenticatedRequest, res) => {
    const actor = req.auth!;
    const companyId = String(req.params.companyId);
    const moduleId = String(req.params.moduleId);
    const enabled = Boolean(req.body?.enabled);

    const company = await db
      .prepare('SELECT id, name FROM companies WHERE id = ?')
      .get(companyId) as { id: string; name: string } | undefined;
    const mod = await db
      .prepare('SELECT id, slug, name, is_core FROM modules WHERE id = ?')
      .get(moduleId) as { id: string; slug: string; name: string; is_core: number } | undefined;

    if (!company || !mod) {
      res.status(404).json({ error: 'Empresa ou módulo não encontrado.' });
      return;
    }

    if (mod.is_core === 1 && !enabled) {
      res.status(400).json({ error: `O módulo essencial "${mod.name}" não pode ser desabilitado para uma empresa.` });
      return;
    }

    const prevRow = await db
      .prepare('SELECT enabled FROM company_modules WHERE company_id = ? AND module_id = ?')
      .get(companyId, moduleId) as { enabled: number } | undefined;

    const ts = nowIso();
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO company_modules (id, company_id, module_id, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(company_id, module_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at`,
        [`cm-${companyId}-${moduleId}`, companyId, moduleId, enabled ? 1 : 0, ts]
      );
      await client.query(
        `INSERT INTO audit_logs (id, actor_user_id, actor_email, action, target_type, target_id, company_id, summary, old_data, new_data, created_at)
         VALUES ($1, $2, $3, $4, 'company_module', $5, $6, $7, $8, $9, $10)`,
        [
          `aud-${crypto.randomUUID().slice(0, 12)}`,
          actor.id,
          actor.email,
          enabled ? 'ENABLE_COMPANY_MODULE' : 'DISABLE_COMPANY_MODULE',
          `${companyId}:${moduleId}`,
          companyId,
          `${enabled ? 'Habilitou' : 'Desabilitou'} o módulo "${mod.name}" para "${company.name}".`,
          JSON.stringify({ enabled: prevRow ? prevRow.enabled === 1 : false }),
          JSON.stringify({ enabled }),
          ts,
        ]
      );
    });

    res.json({ ok: true, overview: await getAdminOverview() });
  }
);

app.get(
  '/api/admin/modules/:moduleId/companies',
  requireAuth,
  requirePlatformAdmin,
  async (req, res) => {
    const moduleId = String(req.params.moduleId);
    const rows = await db
      .prepare(
        `SELECT c.id, c.name, c.plan, c.document, COALESCE(cm.enabled, 0) as enabled
         FROM companies c
         LEFT JOIN company_modules cm ON cm.company_id = c.id AND cm.module_id = ?
         ORDER BY c.name ASC`
      )
      .all(moduleId) as Array<{
      id: string;
      name: string;
      plan: string;
      document: string;
      enabled: number;
    }>;
    res.json({
      companies: rows.map((r) => ({ ...r, enabled: r.enabled === 1 })),
    });
  }
);

app.post('/api/admin/companies', requireAuth, requirePlatformAdmin, async (req: AuthenticatedRequest, res) => {
  const actor = req.auth!;
  const name = String(req.body?.name ?? '').trim();
  const document = onlyDigits(String(req.body?.document ?? ''));
  const userName = String(req.body?.user_name ?? '').trim();
  const userEmail = String(req.body?.user_email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const plan = (req.body?.plan as 'Gratuito' | 'Profissional' | 'Empresarial') || 'Profissional';
  const enabledModuleIds: string[] = Array.isArray(req.body?.enabled_module_ids)
    ? req.body.enabled_module_ids.map(String)
    : [];

  if (!name || !userName || !userEmail || password.length < 10) {
    res.status(400).json({
      error: 'Preencha nome da empresa, responsável, e-mail e senha (mín. 10 caracteres).',
    });
    return;
  }

  const emailExists = await db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(userEmail);
  if (emailExists) {
    res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    return;
  }

  const ts = nowIso();
  const companyId = `comp-${crypto.randomUUID()}`;
  const userId = `usr-${crypto.randomUUID()}`;
  const allModules = await db.prepare('SELECT id, slug FROM modules').all() as Array<{
    id: string;
    slug: string;
  }>;
  const initialState = {
    paymentMethods: [
      { id: 'pm-pix', name: 'Pix', type: 'pix', active: true },
      { id: 'pm-dinheiro', name: 'Dinheiro', type: 'dinheiro', active: true },
      { id: 'pm-credito', name: 'Cartão de Crédito', type: 'cartao_credito', active: true },
    ],
    customers: [], products: [], services: [],
    warehouses: [{ id: `wh-${companyId}-01`, company_id: companyId, name: 'Matriz Principal', location: 'Sede' }],
    stockBalances: [], stockMovements: [], sales: [], quotes: [], serviceOrders: [],
    financialEntries: [], financialPayments: [], purchaseOrders: [],
  };

  // Empresa, usuário, permissões, estado inicial e auditoria são gravados numa única transação.
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO companies (id, name, legal_name, document, email, phone, address, city, state, plan, allow_negative_stock, status, created_at)
       VALUES ($1, $2, $3, $4, $5, '', '', '', '', $6, 0, 'ativo', $7)`,
      [companyId, name, name, document, userEmail, plan, ts]
    );
    await client.query(
      `INSERT INTO users (id, company_id, name, email, password_hash, is_platform_admin, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 0, 'ativo', $6)`,
      [userId, companyId, userName, userEmail, hashPassword(password), ts]
    );
    for (const module of allModules) {
      const enabled = module.slug === 'dashboard' || module.slug === 'configuracoes' || enabledModuleIds.includes(module.id);
      await client.query(
        `INSERT INTO company_modules (id, company_id, module_id, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [`cm-${companyId}-${module.id}`, companyId, module.id, enabled ? 1 : 0, ts]
      );
    }
    await client.query(
      `INSERT INTO company_business_state (company_id, state_json, updated_at)
       VALUES ($1, $2::jsonb, $3)`,
      [companyId, JSON.stringify(initialState), ts]
    );
    await client.query(
      `INSERT INTO audit_logs (id, actor_user_id, actor_email, action, target_type, target_id, company_id, summary, old_data, new_data, created_at)
       VALUES ($1, $2, $3, 'CREATE_COMPANY', 'company', $4, $4, $5, NULL, $6, $7)`,
      [
        `aud-${crypto.randomUUID().slice(0, 12)}`,
        actor.id,
        actor.email,
        companyId,
        `Cadastrou nova empresa cliente "${name}" (${userEmail}) com plano ${plan}.`,
        JSON.stringify({ companyId, name, userEmail, plan }),
        ts,
      ]
    );
  });

  res.status(201).json({ ok: true, overview: await getAdminOverview() });
});

// Middleware de Vite / Static SPA
async function startServer() {
  await initSchema();
  await seedDatabase();
  await ensureAccountProvisioning();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Erro não tratado na API:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gestor Fácil rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(async (error) => {
  console.error('Falha ao iniciar o Gestor Fácil:', error);
  try {
    await closeDatabase();
  } catch (closeError) {
    console.error('Falha ao encerrar a conexão com o banco:', closeError);
  }
  process.exitCode = 1;
});
