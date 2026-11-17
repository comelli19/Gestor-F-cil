import type { CompanySettings, PaymentMethod, Warehouse } from '../types/gestor';

// Valores de inicialização da interface. Nenhum cliente, produto, venda ou dado fictício é criado.
export const COMPANY_ID = '';

export const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  id: '',
  name: '',
  legal_name: '',
  document: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  currency: 'BRL',
  timezone: 'America/Sao_Paulo',
  allow_negative_stock: false,
  segment_features: [],
  enabled_modules: [],
  plan: 'Gratuito',
};

export const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm-pix', name: 'Pix', type: 'pix', active: true },
  { id: 'pm-dinheiro', name: 'Dinheiro', type: 'dinheiro', active: true },
  { id: 'pm-credito', name: 'Cartão de Crédito', type: 'cartao_credito', active: true },
];

export const INITIAL_WAREHOUSES: Warehouse[] = [];
