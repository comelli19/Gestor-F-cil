import {
  Ban,
  CheckCircle2,
  Package,
  Pencil,
  Plus,
  Search,
  Wrench,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import { calculateMargin, formatCurrency } from '../lib/formatters';
import { Product, RecordStatus, Service } from '../types/gestor';

const EMPTY_PRODUCT = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: 'Hardware',
  brand: '',
  unit: 'UN',
  cost_price: 0,
  sale_price: 0,
  min_stock: 5,
  tracks_stock: true,
  status: 'ativo' as RecordStatus,
};

const EMPTY_SERVICE = {
  code: '',
  name: '',
  description: '',
  category: 'Manutenção',
  default_price: 0,
  estimated_cost: 0,
  estimated_time: '2 horas',
  status: 'ativo' as RecordStatus,
};

export function ProdutosServicosPage() {
  const {
    products,
    services,
    saveProduct,
    toggleProductStatus,
    saveService,
    toggleServiceStatus,
    companySettings,
  } = useGestor();

  const [activeTab, setActiveTab] = useState<'produtos' | 'servicos'>('produtos');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | RecordStatus>('todos');

  // Modais de Produto
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState(EMPTY_PRODUCT);

  // Modais de Serviço
  const [servModalOpen, setServModalOpen] = useState(false);
  const [editingServ, setEditingServ] = useState<Service | null>(null);
  const [servForm, setServForm] = useState(EMPTY_SERVICE);

  const hasServicesSegment = companySettings.segment_features.includes('servicos');

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, search, statusFilter]);

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (statusFilter !== 'todos' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [services, search, statusFilter]);

  const liveMargin = useMemo(
    () => calculateMargin(prodForm.cost_price, prodForm.sale_price),
    [prodForm.cost_price, prodForm.sale_price]
  );

  const openNewProduct = () => {
    setEditingProd(null);
    setProdForm({
      ...EMPTY_PRODUCT,
      sku: `PRD-${String(products.length + 1).padStart(3, '0')}`,
    });
    setProdModalOpen(true);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProd(prod);
    setProdForm({
      sku: prod.sku,
      barcode: prod.barcode,
      name: prod.name,
      description: prod.description,
      category: prod.category,
      brand: prod.brand,
      unit: prod.unit,
      cost_price: prod.cost_price,
      sale_price: prod.sale_price,
      min_stock: prod.min_stock,
      tracks_stock: prod.tracks_stock,
      status: prod.status,
    });
    setProdModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name.trim() || !prodForm.sku.trim()) return;
    saveProduct(
      {
        ...prodForm,
        name: prodForm.name.trim(),
        sku: prodForm.sku.trim().toUpperCase(),
      },
      editingProd?.id
    );
    setProdModalOpen(false);
  };

  const openNewService = () => {
    setEditingServ(null);
    setServForm({
      ...EMPTY_SERVICE,
      code: `SRV-${String(services.length + 1).padStart(3, '0')}`,
    });
    setServModalOpen(true);
  };

  const openEditService = (serv: Service) => {
    setEditingServ(serv);
    setServForm({
      code: serv.code,
      name: serv.name,
      description: serv.description,
      category: serv.category,
      default_price: serv.default_price,
      estimated_cost: serv.estimated_cost,
      estimated_time: serv.estimated_time,
      status: serv.status,
    });
    setServModalOpen(true);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!servForm.name.trim() || !servForm.code.trim()) return;
    saveService(
      {
        ...servForm,
        name: servForm.name.trim(),
        code: servForm.code.trim().toUpperCase(),
      },
      editingServ?.id
    );
    setServModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Barra superior com separação Produtos / Serviços */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('produtos')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'produtos'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Produtos ({products.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('servicos')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'servicos'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>Serviços ({services.length})</span>
            </button>
          </div>

          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                activeTab === 'produtos'
                  ? 'Buscar por código, barras ou nome...'
                  : 'Buscar serviço por código ou nome...'
              }
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'ativo', label: 'Ativos' },
              { id: 'inativo', label: 'Inativos' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id as 'todos' | RecordStatus)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === item.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={activeTab === 'produtos' ? openNewProduct : openNewService}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>{activeTab === 'produtos' ? 'Novo produto' : 'Novo serviço'}</span>
        </button>
      </div>

      {activeTab === 'servicos' && !hasServicesSegment && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
          O segmento de Serviços está desativado nas Configurações da empresa. Serviços cadastrados aqui nunca movimentam estoque.
        </div>
      )}

      {/* Tabela de Produtos */}
      {activeTab === 'produtos' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Código / Produto</th>
                  <th className="px-5 py-3">Categoria · Marca</th>
                  <th className="px-5 py-3 text-right">Custo</th>
                  <th className="px-5 py-3 text-right">Preço de venda</th>
                  <th className="px-5 py-3 text-right">Margem est.</th>
                  <th className="px-5 py-3 text-right">Est. mínimo</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((prod) => {
                  const margin = calculateMargin(prod.cost_price, prod.sale_price);
                  return (
                    <tr
                      key={prod.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {prod.name}
                        </p>
                        <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          {prod.sku} · {prod.barcode || 'Sem código de barras'} · {prod.unit}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {prod.category} {prod.brand ? `· ${prod.brand}` : ''}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular text-slate-600 dark:text-slate-300">
                        {formatCurrency(prod.cost_price)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(prod.sale_price)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular">
                        <span
                          className={
                            margin >= 25
                              ? 'font-medium text-emerald-700 dark:text-emerald-400'
                              : margin > 0
                                ? 'font-medium text-amber-700 dark:text-amber-400'
                                : 'font-medium text-rose-600 dark:text-rose-400'
                          }
                        >
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                        {prod.tracks_stock ? `${prod.min_stock} ${prod.unit}` : 'Não controla'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={prod.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditProduct(prod)}
                            title="Editar produto"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleProductStatus(prod.id)}
                            title={prod.status === 'ativo' ? 'Inativar' : 'Ativar'}
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {prod.status === 'ativo' ? (
                              <Ban className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tabela de Serviços */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            Tabela independente de serviços (M03) · Serviços nunca movimentam estoque.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Código / Serviço</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Tempo estimado</th>
                  <th className="px-5 py-3 text-right">Custo estimado</th>
                  <th className="px-5 py-3 text-right">Preço padrão</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredServices.map((serv) => (
                  <tr
                    key={serv.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {serv.name}
                      </p>
                      <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                        {serv.code} · {serv.description}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {serv.category}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {serv.estimated_time}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular text-slate-600 dark:text-slate-300">
                      {formatCurrency(serv.estimated_cost)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(serv.default_price)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={serv.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditService(serv)}
                          title="Editar serviço"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleServiceStatus(serv.id)}
                          title={serv.status === 'ativo' ? 'Inativar' : 'Ativar'}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {serv.status === 'ativo' ? (
                            <Ban className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Produto */}
      <Modal
        open={prodModalOpen}
        onClose={() => setProdModalOpen(false)}
        title={editingProd ? 'Editar produto' : 'Novo produto'}
        subtitle="A margem estimada é calculada automaticamente a partir do custo e preço de venda."
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setProdModalOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="product-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {editingProd ? 'Salvar produto' : 'Cadastrar produto'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Código interno (SKU) *
              </label>
              <input
                type="text"
                required
                value={prodForm.sku}
                onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm uppercase dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Código de barras (EAN)
              </label>
              <input
                type="text"
                value={prodForm.barcode}
                onChange={(e) => setProdForm({ ...prodForm, barcode: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Unidade
              </label>
              <select
                value={prodForm.unit}
                onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="UN">UN (Unidade)</option>
                <option value="CX">CX (Caixa)</option>
                <option value="PCT">PCT (Pacote)</option>
                <option value="MT">MT (Metro)</option>
                <option value="KG">KG (Quilo)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Nome do produto *
              </label>
              <input
                type="text"
                required
                value={prodForm.name}
                onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Categoria
              </label>
              <input
                type="text"
                value={prodForm.category}
                onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Marca
              </label>
              <input
                type="text"
                value={prodForm.brand}
                onChange={(e) => setProdForm({ ...prodForm, brand: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Situação
              </label>
              <select
                value={prodForm.status}
                onChange={(e) =>
                  setProdForm({ ...prodForm, status: e.target.value as RecordStatus })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Custo de aquisição (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={prodForm.cost_price}
                onChange={(e) =>
                  setProdForm({ ...prodForm, cost_price: Number(e.target.value) || 0 })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Preço de venda (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={prodForm.sale_price}
                onChange={(e) =>
                  setProdForm({ ...prodForm, sale_price: Number(e.target.value) || 0 })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Margem estimada (calculada)
              </p>
              <p
                className={`mt-0.5 font-mono-tabular text-lg font-bold ${
                  liveMargin >= 25
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : liveMargin > 0
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {liveMargin.toFixed(1)}%
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Controle de estoque
              </label>
              <select
                value={prodForm.tracks_stock ? 'sim' : 'nao'}
                onChange={(e) =>
                  setProdForm({ ...prodForm, tracks_stock: e.target.value === 'sim' })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="sim">Sim (controlar saldo)</option>
                <option value="nao">Não</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Estoque mínimo
              </label>
              <input
                type="number"
                min="0"
                disabled={!prodForm.tracks_stock}
                value={prodForm.min_stock}
                onChange={(e) =>
                  setProdForm({ ...prodForm, min_stock: Number(e.target.value) || 0 })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Descrição
              </label>
              <textarea
                rows={2}
                value={prodForm.description}
                onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Serviço */}
      <Modal
        open={servModalOpen}
        onClose={() => setServModalOpen(false)}
        title={editingServ ? 'Editar serviço' : 'Novo serviço'}
        subtitle="Serviços são cadastrados separadamente e não movimentam estoque."
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setServModalOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="service-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {editingServ ? 'Salvar serviço' : 'Cadastrar serviço'}
            </button>
          </>
        }
      >
        <form id="service-form" onSubmit={handleSaveService} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Código *
              </label>
              <input
                type="text"
                required
                value={servForm.code}
                onChange={(e) => setServForm({ ...servForm, code: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm uppercase dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Categoria
              </label>
              <input
                type="text"
                value={servForm.category}
                onChange={(e) => setServForm({ ...servForm, category: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Nome do serviço *
              </label>
              <input
                type="text"
                required
                value={servForm.name}
                onChange={(e) => setServForm({ ...servForm, name: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Preço padrão (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={servForm.default_price}
                onChange={(e) =>
                  setServForm({ ...servForm, default_price: Number(e.target.value) || 0 })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Custo estimado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={servForm.estimated_cost}
                onChange={(e) =>
                  setServForm({ ...servForm, estimated_cost: Number(e.target.value) || 0 })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Tempo estimado
              </label>
              <input
                type="text"
                value={servForm.estimated_time}
                onChange={(e) => setServForm({ ...servForm, estimated_time: e.target.value })}
                placeholder="Ex.: 2 horas"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Situação
              </label>
              <select
                value={servForm.status}
                onChange={(e) =>
                  setServForm({ ...servForm, status: e.target.value as RecordStatus })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Descrição
              </label>
              <textarea
                rows={2}
                value={servForm.description}
                onChange={(e) => setServForm({ ...servForm, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
