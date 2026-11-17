import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  COMPANY_ID,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_PAYMENT_METHODS,
  INITIAL_WAREHOUSES,
} from '../data/mockData';
import {
  ApiError,
  apiRequest,
  getAdminPreviewCompanyId,
  getStoredToken,
  setAdminPreviewCompanyId as storeAdminPreviewCompanyId,
  setStoredToken,
} from '../lib/api';
import { generateShareToken, onlyDigits, roundCents } from '../lib/formatters';
import {
  AuthUser,
  CompanySettings,
  CompanySummary,
  Customer,
  FinancialEntry,
  FinancialPayment,
  ModuleId,
  PaymentMethod,
  PlatformModule,
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
  Warehouse,
} from '../types/gestor';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface StockMoveInput {
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
}

interface BootstrapResponse {
  company: CompanySettings | null;
  modules: PlatformModule[];
  enabledModuleIdsForCompany?: string[];
  adminCompanies?: CompanySummary[];
  data: {
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
  };
}

interface GestorContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  authLoading: boolean;
  isAuthenticated: boolean;
  authUser: AuthUser | null;
  userName: string;
  authorizedModules: PlatformModule[];
  adminCompanies: CompanySummary[];
  adminPreviewCompanyId: string;
  adminEnabledModuleIds: string[];
  selectAdminPreviewCompany: (companyId: string) => Promise<void>;
  currentPath: string;
  navigateToPath: (path: string) => void;
  accessDeniedMessage: string | null;
  clearAccessDenied: () => void;

  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;

  setActiveModule: (module: ModuleId) => void;
  canAccessModule: (module: ModuleId) => boolean;
  isZeroSimulation: boolean;
  setIsZeroSimulation: (value: boolean) => void;
  resetDemoData: () => void;

  toasts: ToastItem[];
  notify: (message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: string) => void;

  companySettings: CompanySettings;
  updateCompanySettings: (partial: Partial<CompanySettings>) => void;
  paymentMethods: PaymentMethod[];
  togglePaymentMethod: (id: string) => void;
  addPaymentMethod: (name: string, type: PaymentMethod['type']) => void;

  customers: Customer[];
  saveCustomer: (
    data: Omit<Customer, 'id' | 'company_id' | 'created_at'>,
    editingId?: string
  ) => { ok: boolean; error?: string };
  toggleCustomerStatus: (id: string) => void;

  products: Product[];
  saveProduct: (data: Omit<Product, 'id' | 'company_id'>, editingId?: string) => void;
  toggleProductStatus: (id: string) => void;

  services: Service[];
  saveService: (data: Omit<Service, 'id' | 'company_id'>, editingId?: string) => void;
  toggleServiceStatus: (id: string) => void;

  warehouses: Warehouse[];
  stockBalances: StockBalance[];
  stockMovements: StockMovement[];
  registerStockMovement: (input: StockMoveInput) => { ok: boolean; error?: string };

  sales: Sale[];
  createSale: (payload: {
    customer_id: string | null;
    items: Omit<SaleItem, 'id'>[];
    discount: number;
    addition: number;
    payment_method_id: string;
    payment_condition: Sale['payment_condition'];
    paid_amount: number;
    status: SaleStatus;
    notes?: string;
  }) => { ok: boolean; error?: string };
  updateSaleStatus: (saleId: string, nextStatus: SaleStatus) => void;

  quotes: Quote[];
  createQuote: (payload: {
    customer_id: string;
    items: Omit<QuoteItem, 'id'>[];
    discount: number;
    valid_until: string;
    payment_terms: string;
    notes: string;
    status: QuoteStatus;
  }) => void;
  updateQuoteStatus: (quoteId: string, nextStatus: QuoteStatus) => void;
  convertQuoteToSale: (quoteId: string) => { ok: boolean; error?: string };
  convertQuoteToServiceOrder: (quoteId: string) => { ok: boolean; error?: string };

  serviceOrders: ServiceOrder[];
  createServiceOrder: (payload: {
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
  }) => { ok: boolean; error?: string };
  updateServiceOrderStatus: (
    osId: string,
    nextStatus: ServiceOrderStatus,
    generateReceivable?: boolean
  ) => void;

  purchaseOrders: PurchaseOrder[];
  createPurchaseOrder: (
    payload: Omit<PurchaseOrder, 'id' | 'company_id' | 'document_number' | 'order_date'>
  ) => Promise<boolean>;
  updatePurchaseOrderStatus: (id: string, status: PurchaseOrder['status']) => void;

  financialEntries: FinancialEntry[];
  financialPayments: FinancialPayment[];
  createFinancialEntry: (payload: {
    entry_type: FinancialEntry['entry_type'];
    description: string;
    category: string;
    amount: number;
    due_date: string;
    payment_method_id: string;
    customer_id?: string;
  }) => void;
  registerPayment: (payload: {
    entryId: string;
    amount: number;
    payment_date: string;
    payment_method_id: string;
    external_ref?: string;
  }) => { ok: boolean; error?: string };
}

const GestorContext = createContext<GestorContextValue | null>(null);

export function GestorProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authorizedModules, setAuthorizedModules] = useState<PlatformModule[]>([]);
  const [adminCompanies, setAdminCompanies] = useState<CompanySummary[]>([]);
  const [adminPreviewCompanyId, setAdminPreviewCompanyIdState] = useState<string>(
    () => getAdminPreviewCompanyId() || ''
  );
  const [adminEnabledModuleIds, setAdminEnabledModuleIds] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const [isZeroSimulation, setIsZeroSimulation] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [companySettings, setCompanySettings] = useState<CompanySettings>(INITIAL_COMPANY_SETTINGS);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(INITIAL_PAYMENT_METHODS);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [financialPayments, setFinancialPayments] = useState<FinancialPayment[]>([]);

  const isAuthenticated = Boolean(authUser);
  const userName = authUser?.name ?? '';

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const notify = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const clearAccessDenied = useCallback(() => setAccessDeniedMessage(null), []);

  const applyBootstrapData = useCallback((boot: BootstrapResponse) => {
    setCompanySettings(boot.company ?? INITIAL_COMPANY_SETTINGS);
    setAdminPreviewCompanyIdState(boot.company?.id ?? '');
    setAuthorizedModules(boot.modules);
    if (boot.adminCompanies) {
      setAdminCompanies(boot.adminCompanies);
    }
    if (boot.enabledModuleIdsForCompany) {
      setAdminEnabledModuleIds(boot.enabledModuleIdsForCompany);
    }
    setPaymentMethods(boot.data.paymentMethods);
    setCustomers(boot.data.customers);
    setProducts(boot.data.products);
    setServices(boot.data.services);
    setWarehouses(boot.data.warehouses.length ? boot.data.warehouses : INITIAL_WAREHOUSES);
    setStockBalances(boot.data.stockBalances);
    setStockMovements(boot.data.stockMovements);
    setSales(boot.data.sales);
    setQuotes(boot.data.quotes);
    setServiceOrders(boot.data.serviceOrders);
    setFinancialEntries(boot.data.financialEntries);
    setFinancialPayments(boot.data.financialPayments);
    setPurchaseOrders(boot.data.purchaseOrders ?? []);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const me = await apiRequest<{
        user: AuthUser;
        company: CompanySettings | null;
        modules: PlatformModule[];
      }>('/api/auth/me');
      setAuthUser(me.user);
      const boot = await apiRequest<BootstrapResponse>('/api/workspace/bootstrap');
      applyBootstrapData(boot);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setStoredToken(null);
        storeAdminPreviewCompanyId(null);
        setAuthUser(null);
        setAuthorizedModules([]);
      }
    }
  }, [applyBootstrapData]);

  const selectAdminPreviewCompany = useCallback(
    async (companyId: string) => {
      storeAdminPreviewCompanyId(companyId);
      setAdminPreviewCompanyIdState(companyId);
      try {
        const boot = await apiRequest<BootstrapResponse>('/api/workspace/bootstrap', {
          adminCompanyId: companyId,
        });
        applyBootstrapData(boot);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : 'Erro ao alternar empresa para visualização.',
          'error'
        );
      }
    },
    [applyBootstrapData, notify]
  );

  // Verifica rota diretamente no backend sempre que a URL muda ou módulos mudam
  const verifyCurrentRoute = useCallback(
    async (pathToCheck: string, user: AuthUser | null) => {
      if (!user) return;
      if (pathToCheck === '/' || pathToCheck === '/login') {
        const target = user.is_platform_admin ? '/admin/modulos' : '/dashboard';
        window.history.replaceState({}, '', target);
        setCurrentPath(target);
        setAccessDeniedMessage(null);
        return;
      }

      try {
        await apiRequest<{ allowed: boolean }>(
          `/api/modules/check-access?route=${encodeURIComponent(pathToCheck)}`
        );
        setAccessDeniedMessage(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setAccessDeniedMessage(err.message);
        }
      }
    },
    []
  );

  useEffect(() => {
    const onPopState = () => {
      const next = window.location.pathname || '/';
      setCurrentPath(next);
      verifyCurrentRoute(next, authUser);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [authUser, verifyCurrentRoute]);

  // Boot inicial da sessão
  useEffect(() => {
    let active = true;
    (async () => {
      const token = getStoredToken();
      if (!token) {
        if (active) setAuthLoading(false);
        return;
      }
      try {
        const me = await apiRequest<{
          user: AuthUser;
          company: CompanySettings | null;
          modules: PlatformModule[];
        }>('/api/auth/me');
        if (!active) return;
        setAuthUser(me.user);
        const boot = await apiRequest<BootstrapResponse>('/api/workspace/bootstrap');
        if (!active) return;
        applyBootstrapData(boot);
        if (me.user.is_platform_admin && boot.company?.id) {
          storeAdminPreviewCompanyId(boot.company.id);
        }
        await verifyCurrentRoute(window.location.pathname || '/', me.user);
      } catch {
        setStoredToken(null);
        if (active) setAuthUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyBootstrapData, verifyCurrentRoute]);

  // Atualização automática do menu quando o administrador altera a configuração
  useEffect(() => {
    if (!authUser || authUser.is_platform_admin) return;
    const interval = setInterval(() => {
      refreshWorkspace();
    }, 8000);
    const onFocus = () => refreshWorkspace();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [authUser, refreshWorkspace]);

  // Revalida rota atual sempre que a lista de módulos autorizados mudar
  useEffect(() => {
    if (authUser && currentPath && currentPath !== '/' && currentPath !== '/login') {
      verifyCurrentRoute(currentPath, authUser);
    }
  }, [authorizedModules, authUser, currentPath, verifyCurrentRoute]);

  const navigateToPath = useCallback(
    (nextPath: string) => {
      const normalized = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
      if (window.location.pathname !== normalized) {
        window.history.pushState({}, '', normalized);
      }
      setCurrentPath(normalized);
      verifyCurrentRoute(normalized, authUser);
    },
    [authUser, verifyCurrentRoute]
  );

  const setActiveModule = useCallback(
    (moduleSlug: ModuleId) => {
      const found = authorizedModules.find((m) => m.slug === moduleSlug);
      if (found) {
        navigateToPath(found.route);
      } else {
        // Ainda assim tenta navegar para disparar verificação de segurança 403 no backend
        const fallbackRoutes: Record<string, string> = {
          dashboard: '/dashboard',
          clientes: '/clientes',
          produtos: '/produtos-servicos',
          estoque: '/estoque',
          vendas: '/vendas',
          orcamentos: '/orcamentos',
          ordens_servico: '/ordens-servico',
          compras: '/compras',
          financeiro: '/financeiro',
          configuracoes: '/configuracoes',
        };
        navigateToPath(fallbackRoutes[moduleSlug] ?? `/modulos/${moduleSlug}`);
      }
    },
    [authorizedModules, navigateToPath]
  );

  const canAccessModule = useCallback(
    (moduleSlug: ModuleId): boolean => {
      if (authUser?.is_platform_admin) return true;
      return authorizedModules.some((m) => m.slug === moduleSlug && m.is_active);
    },
    [authUser?.is_platform_admin, authorizedModules]
  );

  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      storeAdminPreviewCompanyId(null);
      const res = await apiRequest<{
        token: string;
        user: AuthUser;
        company: CompanySettings | null;
        modules: PlatformModule[];
      }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        token: null,
        adminCompanyId: null,
      });

      setStoredToken(res.token);
      setAuthUser(res.user);
      setAccessDeniedMessage(null);

      const boot = await apiRequest<BootstrapResponse>('/api/workspace/bootstrap', {
        token: res.token,
        adminCompanyId: null,
      });
      applyBootstrapData(boot);
      if (res.user.is_platform_admin && boot.company?.id) {
        storeAdminPreviewCompanyId(boot.company.id);
      }

      const targetPath = res.user.is_platform_admin ? '/admin/modulos' : '/dashboard';
      window.history.pushState({}, '', targetPath);
      setCurrentPath(targetPath);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Falha ao autenticar.',
      };
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignora erro de rede ao sair
    }
    setStoredToken(null);
    storeAdminPreviewCompanyId(null);
    setAdminPreviewCompanyIdState('');
    setAdminCompanies([]);
    setAdminEnabledModuleIds([]);
    setAuthUser(null);
    setAuthorizedModules([]);
    setAccessDeniedMessage(null);
    window.history.replaceState({}, '', '/');
    setCurrentPath('/');
  };

  const resetDemoData = () => {
    setIsZeroSimulation(false);
    refreshWorkspace();
    notify('Visão do painel sincronizada com os dados da empresa.', 'info');
  };

  const handleBackendError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Erro ao processar operação no servidor.';
    notify(msg, 'error');
    if (err instanceof ApiError && err.status === 403) {
      refreshWorkspace();
    }
  };

  // ==================== MUTAÇÕES DE NEGÓCIO COM VALIDAÇÃO NO BACKEND ====================

  const updateCompanySettings = (partial: Partial<CompanySettings>) => {
    setCompanySettings((prev) => ({ ...prev, ...partial }));
    apiRequest<{ ok: boolean; company: CompanySettings }>(
      '/api/modules/configuracoes/company',
      { method: 'PATCH', body: partial }
    )
      .then((res) => {
        if (res.company) setCompanySettings(res.company);
        notify('Configurações da empresa atualizadas.');
      })
      .catch(handleBackendError);
  };

  const togglePaymentMethod = (id: string) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => (pm.id === id ? { ...pm, active: !pm.active } : pm))
    );
    apiRequest<{ ok: boolean; paymentMethods: PaymentMethod[] }>(
      `/api/modules/configuracoes/payment-methods/${id}/toggle`,
      { method: 'PATCH' }
    )
      .then((res) => setPaymentMethods(res.paymentMethods))
      .catch(handleBackendError);
  };

  const addPaymentMethod = (name: string, type: PaymentMethod['type']) => {
    apiRequest<{ ok: boolean; paymentMethods: PaymentMethod[] }>(
      '/api/modules/configuracoes/payment-methods',
      { method: 'POST', body: { name, type } }
    )
      .then((res) => {
        setPaymentMethods(res.paymentMethods);
        notify(`Forma de pagamento "${name.trim()}" adicionada.`);
      })
      .catch(handleBackendError);
  };

  const saveCustomer: GestorContextValue['saveCustomer'] = (data, editingId) => {
    const cleanDoc = onlyDigits(data.document);
    if (cleanDoc) {
      const duplicate = customers.find(
        (c) => onlyDigits(c.document) === cleanDoc && c.id !== editingId
      );
      if (duplicate) {
        return {
          ok: false,
          error: `Já existe um cliente cadastrado com este documento (${duplicate.name}).`,
        };
      }
    }

    const companyId = companySettings.id || COMPANY_ID;
    if (editingId) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === editingId ? { ...c, ...data, document: cleanDoc } : c))
      );
    } else {
      const created: Customer = {
        ...data,
        document: cleanDoc,
        id: `cli-${Date.now()}`,
        company_id: companyId,
        created_at: new Date().toISOString().slice(0, 10),
      };
      setCustomers((prev) => [created, ...prev]);
    }

    apiRequest<{ ok: boolean; customers: Customer[] }>('/api/modules/clientes/save', {
      method: 'POST',
      body: { data, editingId },
    })
      .then((res) => {
        setCustomers(res.customers);
        notify(editingId ? 'Cadastro de cliente atualizado.' : 'Cliente cadastrado com sucesso.');
      })
      .catch(handleBackendError);

    return { ok: true };
  };

  const toggleCustomerStatus = (id: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === 'ativo' ? 'inativo' : 'ativo' } : c
      )
    );
    apiRequest<{ ok: boolean; customers: Customer[] }>(
      `/api/modules/clientes/${id}/toggle`,
      { method: 'PATCH' }
    )
      .then((res) => {
        setCustomers(res.customers);
        notify('Situação do cliente atualizada.', 'info');
      })
      .catch(handleBackendError);
  };

  const saveProduct: GestorContextValue['saveProduct'] = (data, editingId) => {
    const companyId = companySettings.id || COMPANY_ID;
    if (editingId) {
      setProducts((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...data } : p)));
    } else {
      const created: Product = {
        ...data,
        id: `prod-${Date.now()}`,
        company_id: companyId,
      };
      setProducts((prev) => [created, ...prev]);
      if (created.tracks_stock && warehouses[0]) {
        setStockBalances((prev) => [
          ...prev,
          { product_id: created.id, warehouse_id: warehouses[0].id, physical_qty: 0, reserved_qty: 0 },
        ]);
      }
    }

    apiRequest<{ ok: boolean; products: Product[]; stockBalances?: StockBalance[] }>(
      '/api/modules/produtos/products/save',
      { method: 'POST', body: { data, editingId } }
    )
      .then((res) => {
        setProducts(res.products);
        if (res.stockBalances) setStockBalances(res.stockBalances);
        notify(editingId ? 'Produto atualizado.' : 'Produto cadastrado.');
      })
      .catch(handleBackendError);
  };

  const toggleProductStatus = (id: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === 'ativo' ? 'inativo' : 'ativo' } : p
      )
    );
    apiRequest<{ ok: boolean; products: Product[] }>(
      `/api/modules/produtos/products/${id}/toggle`,
      { method: 'PATCH' }
    )
      .then((res) => {
        setProducts(res.products);
        notify('Situação do produto atualizada.', 'info');
      })
      .catch(handleBackendError);
  };

  const saveService: GestorContextValue['saveService'] = (data, editingId) => {
    const companyId = companySettings.id || COMPANY_ID;
    if (editingId) {
      setServices((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...data } : s)));
    } else {
      const created: Service = {
        ...data,
        id: `serv-${Date.now()}`,
        company_id: companyId,
      };
      setServices((prev) => [created, ...prev]);
    }

    apiRequest<{ ok: boolean; services: Service[] }>('/api/modules/produtos/services/save', {
      method: 'POST',
      body: { data, editingId },
    })
      .then((res) => {
        setServices(res.services);
        notify(editingId ? 'Serviço atualizado.' : 'Serviço cadastrado.');
      })
      .catch(handleBackendError);
  };

  const toggleServiceStatus = (id: string) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'ativo' ? 'inativo' : 'ativo' } : s
      )
    );
    apiRequest<{ ok: boolean; services: Service[] }>(
      `/api/modules/produtos/services/${id}/toggle`,
      { method: 'PATCH' }
    )
      .then((res) => {
        setServices(res.services);
        notify('Situação do serviço atualizada.', 'info');
      })
      .catch(handleBackendError);
  };

  const updateBalanceQty = (
    balances: StockBalance[],
    productId: string,
    warehouseId: string,
    physicalDelta: number,
    reservedDelta = 0
  ): StockBalance[] => {
    const exists = balances.find(
      (b) => b.product_id === productId && b.warehouse_id === warehouseId
    );
    if (!exists) {
      return [
        ...balances,
        {
          product_id: productId,
          warehouse_id: warehouseId,
          physical_qty: physicalDelta,
          reserved_qty: Math.max(0, reservedDelta),
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
  };

  const registerStockMovement: GestorContextValue['registerStockMovement'] = (input) => {
    const product = products.find((p) => p.id === input.product_id);
    if (!product) return { ok: false, error: 'Produto não encontrado.' };

    const currentBalance = stockBalances.find(
      (b) => b.product_id === input.product_id && b.warehouse_id === input.warehouse_id
    ) ?? {
      product_id: input.product_id,
      warehouse_id: input.warehouse_id,
      physical_qty: 0,
      reserved_qty: 0,
    };

    const available = currentBalance.physical_qty - currentBalance.reserved_qty;

    if (input.movement_type === 'ajuste_inventario' && !input.reason?.trim()) {
      return { ok: false, error: 'Ajuste de inventário exige justificativa (RN-13).' };
    }

    if (input.movement_type === 'transferencia') {
      if (!input.target_warehouse_id || input.target_warehouse_id === input.warehouse_id) {
        return { ok: false, error: 'Selecione um local de destino diferente da origem.' };
      }
      if (input.quantity <= 0) {
        return { ok: false, error: 'A quantidade deve ser maior que zero.' };
      }
      if (!companySettings.allow_negative_stock && available - input.quantity < 0) {
        return {
          ok: false,
          error: `Saldo disponível insuficiente no local de origem (${available} ${product.unit}).`,
        };
      }
    } else {
      let delta = input.quantity;
      if (input.movement_type === 'saida_manual') delta = -Math.abs(input.quantity);
      if (input.movement_type === 'entrada_compra' || input.movement_type === 'devolucao_cliente') {
        delta = Math.abs(input.quantity);
      }
      if (delta === 0) {
        return { ok: false, error: 'Informe uma quantidade diferente de zero.' };
      }
      if (delta < 0 && !companySettings.allow_negative_stock && available + delta < 0) {
        return {
          ok: false,
          error: `Saldo disponível insuficiente (${available} ${product.unit}). Estoque negativo está bloqueado.`,
        };
      }
    }

    apiRequest<{ ok: boolean; stockBalances: StockBalance[]; stockMovements: StockMovement[] }>(
      '/api/modules/estoque/movement',
      { method: 'POST', body: input }
    )
      .then((res) => {
        setStockBalances(res.stockBalances);
        setStockMovements(res.stockMovements);
        notify('Movimentação de estoque registrada.');
      })
      .catch(handleBackendError);

    // Atualização otimista
    if (input.movement_type === 'transferencia') {
      setStockBalances((prev) => {
        const afterOut = updateBalanceQty(prev, input.product_id, input.warehouse_id, -input.quantity);
        return updateBalanceQty(afterOut, input.product_id, input.target_warehouse_id!, input.quantity);
      });
    } else {
      let delta = input.quantity;
      if (input.movement_type === 'saida_manual') delta = -Math.abs(input.quantity);
      if (input.movement_type === 'entrada_compra' || input.movement_type === 'devolucao_cliente') {
        delta = Math.abs(input.quantity);
      }
      setStockBalances((prev) => updateBalanceQty(prev, input.product_id, input.warehouse_id, delta));
    }

    return { ok: true };
  };

  const createSale: GestorContextValue['createSale'] = (payload) => {
    const subtotal = roundCents(payload.items.reduce((acc, i) => acc + i.total, 0));
    const total = roundCents(Math.max(0, subtotal - payload.discount + payload.addition));
    const docNum = `VND-${String(108 + sales.length).padStart(4, '0')}`;
    const today = new Date().toISOString().slice(0, 10);
    const defaultWh = warehouses[0]?.id ?? 'wh-01';

    if (payload.status !== 'rascunho' && !companySettings.allow_negative_stock) {
      for (const item of payload.items) {
        const prod = products.find((p) => p.id === item.product_id);
        if (prod?.tracks_stock) {
          const bal = stockBalances.find(
            (b) => b.product_id === item.product_id && b.warehouse_id === defaultWh
          );
          const avail = (bal?.physical_qty ?? 0) - (bal?.reserved_qty ?? 0);
          if (avail < item.quantity) {
            return {
              ok: false,
              error: `Estoque disponível insuficiente para "${prod.name}" (disp: ${avail}).`,
            };
          }
        }
      }
    }

    const optimisticSale: Sale = {
      id: `sale-${Date.now()}`,
      company_id: companySettings.id || COMPANY_ID,
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
    setSales((prev) => [optimisticSale, ...prev]);

    apiRequest<{
      ok: boolean;
      sales: Sale[];
      stockBalances: StockBalance[];
      stockMovements: StockMovement[];
      financialEntries: FinancialEntry[];
      financialPayments: FinancialPayment[];
    }>('/api/modules/vendas/create', { method: 'POST', body: payload })
      .then((res) => {
        setSales(res.sales);
        setStockBalances(res.stockBalances);
        setStockMovements(res.stockMovements);
        setFinancialEntries(res.financialEntries);
        setFinancialPayments(res.financialPayments);
        notify(`Venda ${res.sales[0]?.document_number ?? docNum} registrada.`);
      })
      .catch(handleBackendError);

    return { ok: true };
  };

  const updateSaleStatus = (saleId: string, nextStatus: SaleStatus) => {
    setSales((prev) => prev.map((s) => (s.id === saleId ? { ...s, status: nextStatus } : s)));
    apiRequest<{
      ok: boolean;
      sales: Sale[];
      stockBalances: StockBalance[];
      stockMovements: StockMovement[];
      financialEntries: FinancialEntry[];
    }>(`/api/modules/vendas/${saleId}/status`, {
      method: 'PATCH',
      body: { status: nextStatus },
    })
      .then((res) => {
        setSales(res.sales);
        if (res.stockBalances) setStockBalances(res.stockBalances);
        if (res.stockMovements) setStockMovements(res.stockMovements);
        if (res.financialEntries) setFinancialEntries(res.financialEntries);
        notify('Status da venda atualizado.', 'info');
      })
      .catch(handleBackendError);
  };

  const createQuote: GestorContextValue['createQuote'] = (payload) => {
    const subtotal = roundCents(payload.items.reduce((acc, i) => acc + i.total, 0));
    const total = roundCents(Math.max(0, subtotal - payload.discount));
    const docNum = `ORC-${String(90 + quotes.length).padStart(4, '0')}`;
    const optimisticQuote: Quote = {
      id: `orc-${Date.now()}`,
      company_id: companySettings.id || COMPANY_ID,
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
    setQuotes((prev) => [optimisticQuote, ...prev]);

    apiRequest<{ ok: boolean; quotes: Quote[]; quote: Quote }>('/api/modules/orcamentos/create', {
      method: 'POST',
      body: payload,
    })
      .then((res) => {
        setQuotes(res.quotes);
        notify(`Orçamento ${res.quote.document_number} criado.`);
      })
      .catch(handleBackendError);
  };

  const updateQuoteStatus = (quoteId: string, nextStatus: QuoteStatus) => {
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: nextStatus } : q))
    );
    apiRequest<{ ok: boolean; quotes: Quote[] }>(`/api/modules/orcamentos/${quoteId}/status`, {
      method: 'PATCH',
      body: { status: nextStatus },
    })
      .then((res) => {
        setQuotes(res.quotes);
        notify('Status do orçamento atualizado.', 'info');
      })
      .catch(handleBackendError);
  };

  const convertQuoteToSale: GestorContextValue['convertQuoteToSale'] = (quoteId) => {
    if (!canAccessModule('vendas')) {
      return { ok: false, error: 'O módulo de Vendas não está habilitado para a sua empresa.' };
    }
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return { ok: false, error: 'Orçamento não encontrado.' };
    if (quote.converted_at) {
      return { ok: false, error: 'Este orçamento já foi convertido anteriormente (RN-17).' };
    }
    const productItems = quote.items.filter((i) => i.item_type === 'produto' && i.product_id);
    if (productItems.length === 0) {
      return {
        ok: false,
        error: 'Este orçamento contém apenas serviços. Converta para Ordem de Serviço.',
      };
    }

    apiRequest<{
      ok: boolean;
      quotes: Quote[];
      sales: Sale[];
      stockBalances: StockBalance[];
      stockMovements: StockMovement[];
      financialEntries: FinancialEntry[];
    }>(`/api/modules/orcamentos/${quoteId}/convert`, {
      method: 'POST',
      body: { target: 'sale' },
    })
      .then((res) => {
        setQuotes(res.quotes);
        setSales(res.sales);
        setStockBalances(res.stockBalances);
        setStockMovements(res.stockMovements);
        setFinancialEntries(res.financialEntries);
        notify('Orçamento convertido em venda.');
      })
      .catch(handleBackendError);

    return { ok: true };
  };

  const convertQuoteToServiceOrder: GestorContextValue['convertQuoteToServiceOrder'] = (
    quoteId
  ) => {
    if (!canAccessModule('ordens_servico')) {
      return {
        ok: false,
        error: 'O módulo de Ordens de Serviço não está habilitado para a sua empresa.',
      };
    }
    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote) return { ok: false, error: 'Orçamento não encontrado.' };
    if (quote.converted_at) {
      return { ok: false, error: 'Este orçamento já foi convertido anteriormente (RN-17).' };
    }

    apiRequest<{
      ok: boolean;
      quotes: Quote[];
      serviceOrders: ServiceOrder[];
      stockBalances: StockBalance[];
    }>(`/api/modules/orcamentos/${quoteId}/convert`, {
      method: 'POST',
      body: { target: 'os' },
    })
      .then((res) => {
        setQuotes(res.quotes);
        setServiceOrders(res.serviceOrders);
        setStockBalances(res.stockBalances);
        notify('Orçamento convertido em Ordem de Serviço.');
      })
      .catch(handleBackendError);

    return { ok: true };
  };

  const createServiceOrder: GestorContextValue['createServiceOrder'] = (payload) => {
    const defaultWh = warehouses[0]?.id ?? 'wh-01';
    const productItems = payload.items.filter((i) => i.item_type === 'produto' && i.product_id);

    if (!companySettings.allow_negative_stock) {
      for (const item of productItems) {
        const prod = products.find((p) => p.id === item.product_id);
        if (prod?.tracks_stock) {
          const bal = stockBalances.find(
            (b) => b.product_id === item.product_id && b.warehouse_id === defaultWh
          );
          const avail = (bal?.physical_qty ?? 0) - (bal?.reserved_qty ?? 0);
          if (avail < item.quantity) {
            return {
              ok: false,
              error: `Estoque disponível insuficiente para reservar "${prod.name}".`,
            };
          }
        }
      }
    }

    const itemsTotal = roundCents(payload.items.reduce((acc, i) => acc + i.total, 0));
    const total = roundCents(itemsTotal + payload.labor_cost);
    const docNum = `OS-${String(46 + serviceOrders.length).padStart(4, '0')}`;

    const optimisticOs: ServiceOrder = {
      id: `os-${Date.now()}`,
      company_id: companySettings.id || COMPANY_ID,
      document_number: docNum,
      customer_id: payload.customer_id,
      requested_service: payload.requested_service,
      equipment: payload.equipment,
      problem_description: payload.problem_description,
      diagnosis: payload.diagnosis,
      technician: payload.technician,
      status: 'aberta',
      items: payload.items.map((item, idx) => ({ ...item, id: `osi-${Date.now()}-${idx}` })),
      labor_cost: roundCents(payload.labor_cost),
      total,
      opened_at: new Date().toISOString().slice(0, 10),
      expected_at: payload.expected_at,
      notes: payload.notes,
    };
    setServiceOrders((prev) => [optimisticOs, ...prev]);

    apiRequest<{
      ok: boolean;
      serviceOrders: ServiceOrder[];
      stockBalances: StockBalance[];
    }>('/api/modules/ordens_servico/create', { method: 'POST', body: payload })
      .then((res) => {
        setServiceOrders(res.serviceOrders);
        setStockBalances(res.stockBalances);
        notify(`Ordem de serviço ${res.serviceOrders[0]?.document_number ?? docNum} aberta.`);
      })
      .catch(handleBackendError);

    return { ok: true };
  };

  const updateServiceOrderStatus = (
    osId: string,
    nextStatus: ServiceOrderStatus,
    generateReceivable = true
  ) => {
    setServiceOrders((prev) =>
      prev.map((o) => (o.id === osId ? { ...o, status: nextStatus } : o))
    );
    apiRequest<{
      ok: boolean;
      serviceOrders: ServiceOrder[];
      stockBalances: StockBalance[];
      stockMovements: StockMovement[];
      financialEntries: FinancialEntry[];
    }>(`/api/modules/ordens_servico/${osId}/status`, {
      method: 'PATCH',
      body: { status: nextStatus, generateReceivable },
    })
      .then((res) => {
        setServiceOrders(res.serviceOrders);
        if (res.stockBalances) setStockBalances(res.stockBalances);
        if (res.stockMovements) setStockMovements(res.stockMovements);
        if (res.financialEntries) setFinancialEntries(res.financialEntries);
        notify('Ordem de serviço atualizada.', 'info');
      })
      .catch(handleBackendError);
  };

  const createPurchaseOrder: GestorContextValue['createPurchaseOrder'] = async (payload) => {
    try {
      const res = await apiRequest<{ ok: boolean; purchaseOrders: PurchaseOrder[] }>(
        '/api/modules/compras/create',
        { method: 'POST', body: payload }
      );
      setPurchaseOrders(res.purchaseOrders);
      notify('Pedido de compra registrado.');
      return true;
    } catch (err) {
      handleBackendError(err);
      return false;
    }
  };

  const updatePurchaseOrderStatus = (id: string, status: PurchaseOrder['status']) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === id ? { ...po, status } : po))
    );
    apiRequest<{ ok: boolean; purchaseOrders: PurchaseOrder[] }>(
      `/api/modules/compras/${id}/status`,
      { method: 'PATCH', body: { status } }
    )
      .then((res) => {
        setPurchaseOrders(res.purchaseOrders);
        notify('Situação do pedido de compra atualizada.', 'info');
      })
      .catch(handleBackendError);
  };

  const createFinancialEntry: GestorContextValue['createFinancialEntry'] = (payload) => {
    const newEntry: FinancialEntry = {
      id: `fin-${Date.now()}`,
      company_id: companySettings.id || COMPANY_ID,
      entry_type: payload.entry_type,
      origin_type: 'manual',
      origin_id: `LAN-${String(financialEntries.length + 101).padStart(4, '0')}`,
      customer_id: payload.customer_id,
      description: payload.description,
      category: payload.category,
      amount: roundCents(payload.amount),
      paid_amount: 0,
      due_date: payload.due_date,
      payment_method_id: payload.payment_method_id,
      status: 'pendente',
    };
    setFinancialEntries((prev) => [newEntry, ...prev]);

    apiRequest<{ ok: boolean; financialEntries: FinancialEntry[] }>(
      '/api/modules/financeiro/entries',
      { method: 'POST', body: payload }
    )
      .then((res) => {
        setFinancialEntries(res.financialEntries);
        notify(
          payload.entry_type === 'receber'
            ? 'Conta a receber cadastrada.'
            : 'Conta a pagar cadastrada.'
        );
      })
      .catch(handleBackendError);
  };

  const registerPayment: GestorContextValue['registerPayment'] = (payload) => {
    const entry = financialEntries.find((f) => f.id === payload.entryId);
    if (!entry) return { ok: false, error: 'Lançamento não encontrado.' };

    const remaining = roundCents(entry.amount - entry.paid_amount);
    const val = roundCents(payload.amount);
    if (val <= 0 || val > remaining) {
      return {
        ok: false,
        error: `Informe um valor entre R$ 0,01 e o saldo restante (R$ ${remaining.toFixed(2).replace('.', ',')}).`,
      };
    }

    if (payload.external_ref?.trim()) {
      const dup = financialPayments.find(
        (p) => p.external_ref && p.external_ref === payload.external_ref?.trim()
      );
      if (dup) {
        return { ok: false, error: 'Esta referência de pagamento já foi registrada (RN-22).' };
      }
    }

    const newPaid = roundCents(entry.paid_amount + val);
    const newStatus: FinancialEntry['status'] = newPaid >= entry.amount ? 'quitado' : 'parcial';

    setFinancialEntries((prev) =>
      prev.map((f) =>
        f.id === payload.entryId ? { ...f, paid_amount: newPaid, status: newStatus } : f
      )
    );

    apiRequest<{
      ok: boolean;
      financialEntries: FinancialEntry[];
      financialPayments: FinancialPayment[];
    }>('/api/modules/financeiro/payments', { method: 'POST', body: payload })
      .then((res) => {
        setFinancialEntries(res.financialEntries);
        setFinancialPayments(res.financialPayments);
        notify('Movimentação financeira registrada no fluxo de caixa.');
      })
      .catch(handleBackendError);

    return { ok: true };
  };

  return (
    <GestorContext.Provider
      value={{
        theme,
        toggleTheme,
        authLoading,
        isAuthenticated,
        authUser,
        userName,
        authorizedModules,
        adminCompanies,
        adminPreviewCompanyId,
        adminEnabledModuleIds,
        selectAdminPreviewCompany,
        currentPath,
        navigateToPath,
        accessDeniedMessage,
        clearAccessDenied,
        login,
        logout,
        refreshWorkspace,
        setActiveModule,
        canAccessModule,
        isZeroSimulation,
        setIsZeroSimulation,
        resetDemoData,
        toasts,
        notify,
        dismissToast,
        companySettings,
        updateCompanySettings,
        paymentMethods,
        togglePaymentMethod,
        addPaymentMethod,
        customers,
        saveCustomer,
        toggleCustomerStatus,
        products,
        saveProduct,
        toggleProductStatus,
        services,
        saveService,
        toggleServiceStatus,
        warehouses,
        stockBalances,
        stockMovements,
        registerStockMovement,
        sales,
        createSale,
        updateSaleStatus,
        quotes,
        createQuote,
        updateQuoteStatus,
        convertQuoteToSale,
        convertQuoteToServiceOrder,
        serviceOrders,
        createServiceOrder,
        updateServiceOrderStatus,
        purchaseOrders,
        createPurchaseOrder,
        updatePurchaseOrderStatus,
        financialEntries,
        financialPayments,
        createFinancialEntry,
        registerPayment,
      }}
    >
      {children}
    </GestorContext.Provider>
  );
}

export function useGestor() {
  const ctx = useContext(GestorContext);
  if (!ctx) throw new Error('useGestor deve ser usado dentro de GestorProvider');
  return ctx;
}
