import {
  AlertCircle,
  ArrowRightCircle,
  Check,
  Copy,
  Eye,
  Link2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import { formatCurrency, formatDate, roundCents } from '../lib/formatters';
import { Quote, QuoteItem, QuoteStatus } from '../types/gestor';

export function OrcamentosPage() {
  const {
    quotes,
    customers,
    products,
    services,
    canAccessModule,
    createQuote,
    updateQuoteStatus,
    convertQuoteToSale,
    convertQuoteToServiceOrder,
    notify,
  } = useGestor();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | QuoteStatus>('todos');
  const [detailQuote, setDetailQuote] = useState<Quote | null>(null);
  const [convertError, setConvertError] = useState('');
  const [copiedToken, setCopiedToken] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [itemType, setItemType] = useState<'produto' | 'servico'>('produto');
  const [selectedRefId, setSelectedRefId] = useState(products[0]?.id || '');
  const [itemQty, setItemQty] = useState(1);
  const [items, setItems] = useState<Omit<QuoteItem, 'id'>[]>([]);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState('2026-11-30');
  const [paymentTerms, setPaymentTerms] = useState('Pix à vista ou 3x sem juros');
  const [notes, setNotes] = useState('');
  const [initialStatus, setInitialStatus] = useState<QuoteStatus>('aguardando_aprovacao');

  const hasServices = canAccessModule('ordens_servico');
  const canConvertToSale = canAccessModule('vendas');

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((item) => {
      if (statusFilter !== 'todos' && item.status !== statusFilter) return false;
      if (!q) return true;
      const cust = customers.find((c) => c.id === item.customer_id)?.name.toLowerCase() || '';
      return item.document_number.toLowerCase().includes(q) || cust.includes(q);
    });
  }, [quotes, customers, search, statusFilter]);

  const subtotal = useMemo(
    () => roundCents(items.reduce((acc, i) => acc + i.total, 0)),
    [items]
  );
  const total = useMemo(
    () => roundCents(Math.max(0, subtotal - discount)),
    [subtotal, discount]
  );

  const openNewQuote = () => {
    const prod = products[0];
    setCustomerId(customers.find((c) => c.status === 'ativo')?.id || customers[0]?.id || '');
    setItemType('produto');
    setSelectedRefId(prod?.id || '');
    setItemQty(1);
    setItems(
      prod
        ? [
            {
              item_type: 'produto',
              product_id: prod.id,
              description: prod.name,
              quantity: 1,
              unit_price: prod.sale_price,
              total: prod.sale_price,
            },
          ]
        : []
    );
    setDiscount(0);
    setValidUntil('2026-11-30');
    setPaymentTerms('Pix à vista ou 3x no cartão');
    setNotes('');
    setInitialStatus('aguardando_aprovacao');
    setNewOpen(true);
  };

  const handleAddItem = () => {
    if (itemQty <= 0) return;
    if (itemType === 'produto') {
      const p = products.find((x) => x.id === selectedRefId);
      if (!p) return;
      setItems((prev) => [
        ...prev,
        {
          item_type: 'produto',
          product_id: p.id,
          description: p.name,
          quantity: itemQty,
          unit_price: p.sale_price,
          total: roundCents(p.sale_price * itemQty),
        },
      ]);
    } else {
      const s = services.find((x) => x.id === selectedRefId);
      if (!s) return;
      setItems((prev) => [
        ...prev,
        {
          item_type: 'servico',
          service_id: s.id,
          description: s.name,
          quantity: itemQty,
          unit_price: s.default_price,
          total: roundCents(s.default_price * itemQty),
        },
      ]);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || items.length === 0) return;
    createQuote({
      customer_id: customerId,
      items,
      discount,
      valid_until: validUntil,
      payment_terms: paymentTerms,
      notes,
      status: initialStatus,
    });
    setNewOpen(false);
  };

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/orcamento/${token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedToken(true);
    notify('Link público de visualização copiado.', 'info');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar orçamento por número ou cliente..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'todos' | QuoteStatus)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="todos">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="enviado">Enviado</option>
            <option value="aguardando_aprovacao">Aguardando aprovação</option>
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="expirado">Expirado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openNewQuote}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Novo orçamento</span>
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          Orçamento não reserva nem baixa estoque e não gera receita até ser convertido (RN-16).
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Número · Rev.</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Validade</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredQuotes.map((quote) => {
                const customer = customers.find((c) => c.id === quote.customer_id);
                return (
                  <tr
                    key={quote.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                        {quote.document_number}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                        Rev. {quote.revision}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {customer?.name || 'Cliente'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {quote.items.length} {quote.items.length === 1 ? 'item' : 'itens'}
                        {quote.converted_to ? ` · Convertido em ${quote.converted_to}` : ''}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(quote.valid_until)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(quote.total)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailQuote(quote);
                          setConvertError('');
                          setCopiedToken(false);
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Abrir</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalhes do Orçamento */}
      <Modal
        open={Boolean(detailQuote)}
        onClose={() => setDetailQuote(null)}
        title={detailQuote ? `Orçamento ${detailQuote.document_number} (Rev. ${detailQuote.revision})` : ''}
        subtitle={
          detailQuote
            ? `Cliente: ${customers.find((c) => c.id === detailQuote.customer_id)?.name || '—'} · Validade: ${formatDate(detailQuote.valid_until)}`
            : ''
        }
        maxWidthClass="max-w-3xl"
      >
        {detailQuote && (
          <div className="space-y-4">
            {convertError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{convertError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={detailQuote.status} />
                {detailQuote.converted_at && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Convertido em {detailQuote.converted_to} (trava ativa)
                  </span>
                )}
              </div>

              <select
                value={detailQuote.status}
                onChange={(e) => {
                  const next = e.target.value as QuoteStatus;
                  updateQuoteStatus(detailQuote.id, next);
                  setDetailQuote({ ...detailQuote, status: next });
                }}
                disabled={Boolean(detailQuote.converted_at)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aguardando_aprovacao">Aguardando aprovação</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
                <option value="expirado">Expirado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Link público */}
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2 min-w-0 text-xs text-slate-600 dark:text-slate-300">
                <Link2 className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
                <span className="truncate font-mono-tabular">
                  .../orcamento/{detailQuote.share_token}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopyLink(detailQuote.share_token)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedToken ? 'Copiado' : 'Copiar link público'}</span>
              </button>
            </div>

            {/* Itens */}
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {detailQuote.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {item.description}
                    </p>
                    <p className="font-mono-tabular text-xs text-slate-500">
                      {item.item_type === 'produto' ? 'Produto' : 'Serviço'} · {item.quantity} ×{' '}
                      {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-semibold">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <p>Condição: {detailQuote.payment_terms}</p>
                {detailQuote.notes && <p className="mt-0.5">{detailQuote.notes}</p>}
              </div>
              <div className="text-right">
                {detailQuote.discount > 0 && (
                  <p className="text-xs text-slate-500">
                    Subtotal {formatCurrency(detailQuote.subtotal)} · Desconto -
                    {formatCurrency(detailQuote.discount)}
                  </p>
                )}
                <p className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(detailQuote.total)}
                </p>
              </div>
            </div>

            {/* Ações de conversão (RN-17) */}
            {!detailQuote.converted_at &&
              detailQuote.status !== 'cancelado' &&
              detailQuote.status !== 'recusado' && (
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  {canConvertToSale && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = convertQuoteToSale(detailQuote.id);
                        if (!res.ok) {
                          setConvertError(res.error || 'Não foi possível converter.');
                          return;
                        }
                        setDetailQuote(null);
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                    >
                      <ArrowRightCircle className="h-4 w-4" />
                      <span>Converter em Venda</span>
                    </button>
                  )}

                  {hasServices && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = convertQuoteToServiceOrder(detailQuote.id);
                        if (!res.ok) {
                          setConvertError(res.error || 'Não foi possível converter.');
                          return;
                        }
                        setDetailQuote(null);
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-teal-700 px-4 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950/50"
                    >
                      <ArrowRightCircle className="h-4 w-4" />
                      <span>Converter em Ordem de Serviço</span>
                    </button>
                  )}
                </div>
              )}
          </div>
        )}
      </Modal>

      {/* Modal Novo Orçamento */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Novo orçamento"
        subtitle="Inclua produtos e serviços sem comprometer estoque."
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="new-quote-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              Salvar orçamento
            </button>
          </>
        }
      >
        <form id="new-quote-form" onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Cliente *
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {customers
                  .filter((c) => c.status === 'ativo')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Status inicial
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value as QuoteStatus)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aguardando_aprovacao">Aguardando aprovação</option>
              </select>
            </div>
          </div>

          {/* Itens */}
          <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Itens do orçamento (Produtos e Serviços)
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                value={itemType}
                onChange={(e) => {
                  const t = e.target.value as 'produto' | 'servico';
                  setItemType(t);
                  setSelectedRefId(t === 'produto' ? products[0]?.id || '' : services[0]?.id || '');
                }}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="produto">Produto</option>
                <option value="servico">Serviço</option>
              </select>

              <select
                value={selectedRefId}
                onChange={(e) => setSelectedRefId(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {itemType === 'produto'
                  ? products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.sale_price)}
                      </option>
                    ))
                  : services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {formatCurrency(s.default_price)}
                      </option>
                    ))}
              </select>

              <input
                type="number"
                min="1"
                value={itemQty}
                onChange={(e) => setItemQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-10 w-20 rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />

              <button
                type="button"
                onClick={handleAddItem}
                className="h-10 rounded-lg border border-slate-200 bg-slate-100 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                Adicionar
              </button>
            </div>

            {items.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {it.quantity}× {it.description}{' '}
                      <span className="text-xs text-slate-400">({it.item_type})</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular font-medium">
                        {formatCurrency(it.total)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Validade
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Desconto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Condições de pagamento
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <span className="text-sm font-medium">Total do orçamento</span>
            <span className="font-mono-tabular text-xl font-bold text-teal-700 dark:text-teal-400">
              {formatCurrency(total)}
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
