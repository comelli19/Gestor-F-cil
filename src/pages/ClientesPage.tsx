import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  Search,
  UserCheck,
  UserX,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import {
  formatCep,
  formatCurrency,
  formatDate,
  formatDocument,
  formatPhone,
  onlyDigits,
  roundCents,
  validateCpfOrCnpj,
  validateEmail,
} from '../lib/formatters';
import { Customer, RecordStatus } from '../types/gestor';

const UF_LIST = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const EMPTY_FORM = {
  name: '',
  document: '',
  phone: '',
  whatsapp: '',
  email: '',
  cep: '',
  address: '',
  city: '',
  state: 'SP',
  notes: '',
  status: 'ativo' as RecordStatus,
};

export function ClientesPage() {
  const {
    customers,
    saveCustomer,
    toggleCustomerStatus,
    sales,
    serviceOrders,
    quotes,
    financialEntries,
    financialPayments,
    notify,
  } = useGestor();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | RecordStatus>('todos');

  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [historyTab, setHistoryTab] = useState<
    'compras' | 'servicos' | 'orcamentos' | 'receber' | 'pagamentos'
  >('compras');

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = onlyDigits(q);

    return customers.filter((c) => {
      if (statusFilter !== 'todos' && c.status !== statusFilter) return false;
      if (!q) return true;

      const matchName = c.name.toLowerCase().includes(q);
      const matchDoc = qDigits ? onlyDigits(c.document).includes(qDigits) : false;
      const matchPhone = qDigits
        ? onlyDigits(c.phone).includes(qDigits) || onlyDigits(c.whatsapp).includes(qDigits)
        : false;
      return matchName || matchDoc || matchPhone;
    });
  }, [customers, search, statusFilter]);

  const docCheck = useMemo(() => validateCpfOrCnpj(formData.document), [formData.document]);

  const openNewForm = () => {
    setEditingCustomer(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      document: formatDocument(customer.document),
      phone: formatPhone(customer.phone),
      whatsapp: formatPhone(customer.whatsapp),
      email: customer.email,
      cep: formatCep(customer.cep),
      address: customer.address,
      city: customer.city,
      state: customer.state,
      notes: customer.notes,
      status: customer.status,
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Informe o nome completo ou razão social do cliente.');
      return;
    }

    if (!docCheck.valid) {
      setFormError(docCheck.message || 'Documento CPF/CNPJ inválido.');
      return;
    }

    if (formData.email.trim() && !validateEmail(formData.email)) {
      setFormError('O e-mail informado não possui um formato válido.');
      return;
    }

    const res = saveCustomer(
      {
        ...formData,
        name: formData.name.trim(),
        document: onlyDigits(formData.document),
        phone: onlyDigits(formData.phone),
        whatsapp: onlyDigits(formData.whatsapp),
        cep: onlyDigits(formData.cep),
        email: formData.email.trim(),
      },
      editingCustomer?.id
    );

    if (!res.ok) {
      setFormError(res.error || 'Não foi possível salvar o cliente.');
      return;
    }
    setFormOpen(false);
  };

  const customerHistory = useMemo(() => {
    if (!detailCustomer) return null;
    const custSales = sales.filter((s) => s.customer_id === detailCustomer.id);
    const custOs = serviceOrders.filter((o) => o.customer_id === detailCustomer.id);
    const custQuotes = quotes.filter((q) => q.customer_id === detailCustomer.id);
    const custReceivables = financialEntries.filter(
      (f) => f.entry_type === 'receber' && f.customer_id === detailCustomer.id
    );
    const entryIds = new Set(custReceivables.map((e) => e.id));
    const custPayments = financialPayments.filter((p) => entryIds.has(p.financial_entry_id));

    const totalComprado = roundCents(
      custSales
        .filter((s) => s.status !== 'cancelada' && s.status !== 'rascunho')
        .reduce((acc, s) => acc + s.total, 0) +
        custOs
          .filter((o) => o.status === 'concluida' || o.status === 'entregue')
          .reduce((acc, o) => acc + o.total, 0)
    );

    return {
      custSales,
      custOs,
      custQuotes,
      custReceivables,
      custPayments,
      totalComprado,
    };
  }, [detailCustomer, sales, serviceOrders, quotes, financialEntries, financialPayments]);

  const hasCustomerMovements = (customerId: string) =>
    sales.some((s) => s.customer_id === customerId) ||
    serviceOrders.some((o) => o.customer_id === customerId) ||
    quotes.some((q) => q.customer_id === customerId);

  return (
    <div className="space-y-5">
      {/* Cabeçalho e Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start sm:self-auto dark:bg-slate-800">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'ativo', label: 'Ativos' },
              { id: 'inativo', label: 'Inativos' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id as 'todos' | RecordStatus)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
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
          onClick={openNewForm}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Novo cliente</span>
        </button>
      </div>

      {/* Lista de Clientes */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {filteredCustomers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Nenhum cliente encontrado
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ajuste os filtros de busca ou cadastre um novo cliente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Nome / Razão social</th>
                  <th className="px-5 py-3">CPF / CNPJ</th>
                  <th className="px-5 py-3">Telefone / WhatsApp</th>
                  <th className="px-5 py-3">Cidade / UF</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailCustomer(customer);
                          setHistoryTab('compras');
                        }}
                        className="text-left font-medium text-slate-900 hover:text-teal-700 dark:text-slate-100 dark:hover:text-teal-400"
                      >
                        {customer.name}
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {customer.email || 'Sem e-mail'} · Cadastro {formatDate(customer.created_at)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-700 dark:text-slate-300">
                      {customer.document ? formatDocument(customer.document) : 'Não informado'}
                    </td>
                    <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-700 dark:text-slate-300">
                      <div>{customer.phone ? formatPhone(customer.phone) : '—'}</div>
                      {customer.whatsapp && customer.whatsapp !== customer.phone && (
                        <div className="text-slate-500 dark:text-slate-400">
                          Whats: {formatPhone(customer.whatsapp)}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {customer.city ? `${customer.city}/${customer.state}` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailCustomer(customer);
                            setHistoryTab('compras');
                          }}
                          title="Histórico do cliente"
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Histórico</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditForm(customer)}
                          title="Editar cadastro"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              customer.status === 'ativo' &&
                              hasCustomerMovements(customer.id)
                            ) {
                              notify(
                                'Cliente com histórico foi inativado (RN-06: histórico preservado).',
                                'info'
                              );
                            }
                            toggleCustomerStatus(customer.id);
                          }}
                          title={customer.status === 'ativo' ? 'Inativar cliente' : 'Reativar cliente'}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {customer.status === 'ativo' ? (
                            <UserX className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro / Edição */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCustomer ? 'Editar cliente' : 'Novo cliente'}
        subtitle="Validação de CPF e CNPJ com dígitos verificadores (RN-04)."
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="customer-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              {editingCustomer ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Nome completo ou Razão social *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex.: Mariana Costa Oliveira ou Empresa Ltda"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                CPF ou CNPJ (opcional)
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={formData.document}
                  onChange={(e) =>
                    setFormData({ ...formData, document: formatDocument(e.target.value) })
                  }
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className={`h-10 w-full rounded-lg border bg-white pr-9 pl-3 font-mono-tabular text-sm text-slate-900 focus:outline-none dark:bg-slate-950 dark:text-slate-100 ${
                    onlyDigits(formData.document).length > 0 && !docCheck.valid
                      ? 'border-rose-500 focus:border-rose-500'
                      : onlyDigits(formData.document).length > 0 && docCheck.valid
                        ? 'border-emerald-500 focus:border-emerald-500'
                        : 'border-slate-300 focus:border-teal-600 dark:border-slate-700'
                  }`}
                />
                {onlyDigits(formData.document).length > 0 && (
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                    {docCheck.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    )}
                  </span>
                )}
              </div>
              {onlyDigits(formData.document).length > 0 && (
                <p
                  className={`mt-1 text-xs ${
                    docCheck.valid
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {docCheck.valid
                    ? `${docCheck.type} válido pelos dígitos verificadores`
                    : docCheck.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Situação
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as RecordStatus })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Telefone
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: formatPhone(e.target.value) })
                }
                placeholder="(11) 3000-0000"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                WhatsApp
              </label>
              <input
                type="text"
                value={formData.whatsapp}
                onChange={(e) =>
                  setFormData({ ...formData, whatsapp: formatPhone(e.target.value) })
                }
                placeholder="(11) 99999-0000"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                E-mail
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@dominio.com.br"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                CEP
              </label>
              <input
                type="text"
                value={formData.cep}
                onChange={(e) =>
                  setFormData({ ...formData, cep: formatCep(e.target.value) })
                }
                placeholder="00000-000"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Endereço
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, complemento"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Cidade
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="São Paulo"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                UF
              </label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {UF_LIST.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Observações
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Preferências de atendimento, condições combinadas..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal de Histórico do Cliente */}
      <Modal
        open={Boolean(detailCustomer)}
        onClose={() => setDetailCustomer(null)}
        title={detailCustomer?.name || 'Histórico do cliente'}
        subtitle={
          detailCustomer
            ? `${detailCustomer.document ? formatDocument(detailCustomer.document) : 'Sem documento'} · Cadastrado em ${formatDate(detailCustomer.created_at)}`
            : ''
        }
        maxWidthClass="max-w-4xl"
      >
        {detailCustomer && customerHistory && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total comprado pelo cliente
                </p>
                <p className="mt-1 font-mono-tabular text-lg font-bold text-teal-700 dark:text-teal-400">
                  {formatCurrency(customerHistory.totalComprado)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Contato</p>
                <p className="mt-1 font-mono-tabular text-sm font-medium text-slate-900 dark:text-slate-100">
                  {detailCustomer.whatsapp
                    ? formatPhone(detailCustomer.whatsapp)
                    : formatPhone(detailCustomer.phone) || '—'}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {detailCustomer.email || 'Sem e-mail'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Localização</p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {detailCustomer.city ? `${detailCustomer.city}/${detailCustomer.state}` : '—'}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {detailCustomer.address || 'Endereço não informado'}
                </p>
              </div>
            </div>

            {/* Abas de histórico (M02) */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800">
              {[
                { id: 'compras', label: `Compras (${customerHistory.custSales.length})` },
                { id: 'servicos', label: `Serviços (${customerHistory.custOs.length})` },
                { id: 'orcamentos', label: `Orçamentos (${customerHistory.custQuotes.length})` },
                { id: 'receber', label: `Contas a receber (${customerHistory.custReceivables.length})` },
                { id: 'pagamentos', label: `Pagamentos (${customerHistory.custPayments.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setHistoryTab(
                      tab.id as 'compras' | 'servicos' | 'orcamentos' | 'receber' | 'pagamentos'
                    )
                  }
                  className={`border-b-2 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    historyTab === tab.id
                      ? 'border-teal-700 text-teal-700 dark:border-teal-400 dark:text-teal-400'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[160px]">
              {historyTab === 'compras' && (
                customerHistory.custSales.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhuma compra registrada.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customerHistory.custSales.map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <span className="font-mono-tabular font-semibold">{s.document_number}</span>
                          <span className="mx-2 text-slate-400">·</span>
                          <span className="text-xs text-slate-500">{formatDate(s.sale_date)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={s.status} />
                          <span className="font-mono-tabular font-semibold">
                            {formatCurrency(s.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {historyTab === 'servicos' && (
                customerHistory.custOs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhuma ordem de serviço registrada.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customerHistory.custOs.map((o) => (
                      <div key={o.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <span className="font-mono-tabular font-semibold">{o.document_number}</span>
                          <span className="mx-2 text-slate-400">·</span>
                          <span>{o.requested_service}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={o.status} />
                          <span className="font-mono-tabular font-semibold">
                            {formatCurrency(o.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {historyTab === 'orcamentos' && (
                customerHistory.custQuotes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhum orçamento registrado.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customerHistory.custQuotes.map((q) => (
                      <div key={q.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <span className="font-mono-tabular font-semibold">{q.document_number}</span>
                          <span className="mx-2 text-slate-400">·</span>
                          <span className="text-xs text-slate-500">
                            Validade {formatDate(q.valid_until)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={q.status} />
                          <span className="font-mono-tabular font-semibold">
                            {formatCurrency(q.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {historyTab === 'receber' && (
                customerHistory.custReceivables.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhuma conta a receber vinculada.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customerHistory.custReceivables.map((f) => (
                      <div key={f.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{f.description}</p>
                          <p className="text-xs text-slate-500">
                            Vencimento {formatDate(f.due_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={f.status} />
                          <span className="font-mono-tabular font-semibold">
                            {formatCurrency(f.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {historyTab === 'pagamentos' && (
                customerHistory.custPayments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">Nenhum pagamento recebido.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customerHistory.custPayments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{p.description}</p>
                          <p className="text-xs text-slate-500">
                            Pago em {formatDate(p.payment_date)}
                          </p>
                        </div>
                        <span className="font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
