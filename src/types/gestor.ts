export type ModuleId = string;

type SegmentFeature = 'comercio' | 'servicos';

export type RecordStatus = 'ativo' | 'inativo';

export interface PlatformModule {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  section: string;
  display_order: number;
  is_active: boolean;
  is_core: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  company_id: string | null;
  name: string;
  email: string;
  is_platform_admin: boolean;
  status: RecordStatus;
}

export interface CompanySummary {
  id: string;
  name: string;
  legal_name: string;
  document: string;
  email: string;
  phone: string;
  plan: 'Gratuito' | 'Profissional' | 'Empresarial';
  status: RecordStatus;
  created_at: string;
}

export interface CompanyModuleBinding {
  company_id: string;
  module_id: string;
  enabled: boolean;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_user_id: string;
  actor_email: string;
  action: string;
  target_type: string;
  target_id: string;
  company_id: string | null;
  summary: string;
  old_data: string | null;
  new_data: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  cep: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  status: RecordStatus;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  unit: string;
  cost_price: number;
  sale_price: number;
  min_stock: number;
  tracks_stock: boolean;
  status: RecordStatus;
}

export interface Service {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  default_price: number;
  estimated_cost: number;
  estimated_time: string;
  status: RecordStatus;
}

export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  location: string;
}

export interface StockBalance {
  product_id: string;
  warehouse_id: string;
  physical_qty: number;
  reserved_qty: number;
}

export type StockMovementType =
  | 'entrada_compra'
  | 'saida_manual'
  | 'saida_venda'
  | 'saida_os'
  | 'devolucao_cliente'
  | 'devolucao_fornecedor'
  | 'ajuste_inventario'
  | 'transferencia_saida'
  | 'transferencia_entrada'
  | 'estorno';

export interface StockMovement {
  id: string;
  company_id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: StockMovementType;
  quantity: number;
  unit_cost: number;
  source_type: string;
  source_id: string;
  reason?: string;
  created_by: string;
  created_at: string;
}

export type SaleStatus =
  | 'rascunho'
  | 'confirmada'
  | 'aguardando_entrega'
  | 'entregue'
  | 'cancelada';

export interface SaleItem {
  id: string;
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total: number;
}

export interface Sale {
  id: string;
  company_id: string;
  document_number: string;
  customer_id: string | null;
  status: SaleStatus;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  addition: number;
  total: number;
  payment_method_id: string;
  payment_condition: 'a_vista' | 'a_prazo' | 'parcial';
  paid_amount: number;
  sale_date: string;
  notes?: string;
}

export type QuoteStatus =
  | 'rascunho'
  | 'enviado'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'recusado'
  | 'expirado'
  | 'cancelado';

export interface QuoteItem {
  id: string;
  item_type: 'produto' | 'servico';
  product_id?: string;
  service_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: string;
  company_id: string;
  document_number: string;
  customer_id: string;
  status: QuoteStatus;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  valid_until: string;
  payment_terms: string;
  notes: string;
  share_token: string;
  revision: number;
  converted_at?: string;
  converted_to?: string;
  created_at: string;
}

export type ServiceOrderStatus =
  | 'aberta'
  | 'em_analise'
  | 'aguardando_aprovacao'
  | 'aguardando_pecas'
  | 'em_execucao'
  | 'concluida'
  | 'entregue'
  | 'cancelada';

export interface ServiceOrderItem {
  id: string;
  item_type: 'produto' | 'servico';
  product_id?: string;
  service_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total: number;
}

export interface ServiceOrder {
  id: string;
  company_id: string;
  document_number: string;
  customer_id: string;
  quote_id?: string;
  requested_service: string;
  equipment: string;
  problem_description: string;
  diagnosis: string;
  technician: string;
  status: ServiceOrderStatus;
  items: ServiceOrderItem[];
  labor_cost: number;
  total: number;
  opened_at: string;
  expected_at: string;
  completed_at?: string;
  notes: string;
}

export type FinancialEntryType = 'receber' | 'pagar';
export type FinancialEntryStatus = 'pendente' | 'parcial' | 'quitado' | 'vencido' | 'cancelado';

export interface FinancialEntry {
  id: string;
  company_id: string;
  entry_type: FinancialEntryType;
  origin_type: 'venda' | 'os' | 'compra' | 'manual';
  origin_id: string;
  customer_id?: string;
  description: string;
  category: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  payment_method_id: string;
  status: FinancialEntryStatus;
}

export interface FinancialPayment {
  id: string;
  company_id: string;
  financial_entry_id: string;
  entry_type: FinancialEntryType;
  description: string;
  amount: number;
  payment_date: string;
  payment_method_id: string;
  external_ref?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'transferencia';
  active: boolean;
}

export interface PurchaseOrder {
  id: string;
  company_id: string;
  document_number: string;
  supplier_name: string;
  supplier_document: string;
  items_summary: string;
  total: number;
  status: 'pendente' | 'recebida' | 'cancelada';
  order_date: string;
  expected_date: string;
}

export interface CompanySettings {
  id: string;
  name: string;
  legal_name: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  currency: 'BRL';
  timezone: 'America/Sao_Paulo';
  allow_negative_stock: boolean;
  segment_features: SegmentFeature[];
  enabled_modules: ModuleId[];
  plan: 'Gratuito' | 'Profissional' | 'Empresarial';
}
