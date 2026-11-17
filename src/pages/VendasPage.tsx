import { AlertCircle, Eye, Plus, Search, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import { formatCurrency, formatDate, roundCents } from '../lib/formatters';
import { Sale, SaleItem, SaleStatus } from '../types/gestor';

export function VendasPage() {
  const {
    sales,
    customers,
    products,
    paymentMethods,
    createSale,
    updateSaleStatus,
  } = useGestor();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | SaleStatus>('todos');
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [newSaleOpen, setNewSaleOpen] = useState(false);

  // Estado do formulário de nova venda
  const [customerId, setCustomerId] = useState<string>('');
  const [selectedProdId, setSelectedProdId] = useState<string>(products[0]?.id || '');
  const [itemQty, setItemQty] = useState<number>(1);
  const [items, setItems] = useState<Omit<SaleItem, 'id'>[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [addition, setAddition] = useState<number>(0);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(
    paymentMethods.find((p) => p.active)?.id || 'pm-pix'
  );
  const [paymentCondition, setPaymentCondition] = useState<Sale['payment_condition']>('a_vista');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [initialStatus, setInitialStatus] = useState<SaleStatus>('confirmada');
  const [notes, setNotes] = useState('');
  const [saleError, setSaleError] = useState('');

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (statusFilter !== 'todos' && s.status !== statusFilter) return false;
      if (!q) return true;
      const custName =
        customers.find((c) => c.id === s.customer_id)?.name.toLowerCase() || 'consumidor';
      return s.document_number.toLowerCase().includes(q) || custName.includes(q);
    });
  }, [sales, customers, search, statusFilter]);

  const subtotal = useMemo(
    () => roundCents(items.reduce((acc, i) => acc + i.total, 0)),
    [items]
  );
  const finalTotal = useMemo(
    () => roundCents(Math.max(0, subtotal - discount + addition)),
    [subtotal, discount, addition]
  );

  const openNewSaleModal = () => {
    const firstProd = products.find((p) => p.status === 'ativo') || products[0];
    setCustomerId('');
    setSelectedProdId(firstProd?.id || '');
    setItemQty(1);
    setItems(
      firstProd
        ? [
            {
              product_id: firstProd.id,
              description: firstProd.name,
              quantity: 1,
              unit_price: firstProd.sale_price,
              unit_cost: firstProd.cost_price,
              total: firstProd.sale_price,
            },
          ]
        : []
    );
    setDiscount(0);
    setAddition(0);
    setPaymentCondition('a_vista');
    setPaidAmount(firstProd?.sale_price || 0);
    setInitialStatus('confirmada');
    setNotes('');
    setSaleError('');
    setNewSaleOpen(true);
  };

  const handleAddItem = () => {
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod || itemQty <= 0) return;
    const total = roundCents(prod.sale_price * itemQty);
    setItems((prev) => [
      ...prev,
      {
        product_id: prod.id,
        description: prod.name,
        quantity: itemQty,
        unit_price: prod.sale_price,
        unit_cost: prod.cost_price,
        total,
      },
    ]);
  };

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError('');
    if (items.length === 0) {
      setSaleError('Adicione pelo menos um produto à venda.');
      return;
    }
    const effectivePaid =
      paymentCondition === 'a_vista'
        ? finalTotal
        : paymentCondition === 'a_prazo'
          ? 0
          : paidAmount;

    const res = createSale({
      customer_id: customerId || null,
      items,
      discount,
      addition,
      payment_method_id: paymentMethodId,
      payment_condition: paymentCondition,
      paid_amount: effectivePaid,
      status: initialStatus,
      notes,
    });
    if (!res.ok) {
      setSaleError(res.error || 'Erro ao registrar venda.');
      return;
    }
    setNewSaleOpen(false);
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
              placeholder="Buscar por número ou cliente..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'todos' | SaleStatus)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="todos">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="confirmada">Confirmada</option>
            <option value="aguardando_entrega">Aguardando entrega</option>
            <option value="entregue">Entregue</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openNewSaleModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Nova venda</span>
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Número</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Pagamento</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSales.map((sale) => {
                const customer = customers.find((c) => c.id === sale.customer_id);
                const pm = paymentMethods.find((p) => p.id === sale.payment_method_id);
                return (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3.5 font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {sale.document_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {customer?.name || 'Consumidor final'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(sale.sale_date)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {pm?.name || 'Pix'} ·{' '}
                      {sale.payment_condition === 'a_vista'
                        ? 'À vista'
                        : sale.payment_condition === 'a_prazo'
                          ? 'A prazo'
                          : 'Parcial'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={sale.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailSale(sale)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Detalhes</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalhes da Venda */}
      <Modal
        open={Boolean(detailSale)}
        onClose={() => setDetailSale(null)}
        title={detailSale ? `Venda ${detailSale.document_number}` : ''}
        subtitle={
          detailSale
            ? `Data: ${formatDate(detailSale.sale_date)} · Cliente: ${customers.find((c) => c.id === detailSale.customer_id)?.name || 'Consumidor final'}`
            : ''
        }
        maxWidthClass="max-w-2xl"
        footer={
          detailSale && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {detailSale.status === 'aguardando_entrega' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateSaleStatus(detailSale.id, 'entregue');
                      setDetailSale(null);
                    }}
                    className="h-9 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    Marcar como entregue
                  </button>
                )}
                {detailSale.status !== 'cancelada' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateSaleStatus(detailSale.id, 'cancelada');
                      setDetailSale(null);
                    }}
                    className="h-9 rounded-lg border border-rose-300 bg-rose-50 px-3.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                  >
                    Cancelar venda (estornar)
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Fechar
              </button>
            </div>
          )
        }
      >
        {detailSale && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={detailSale.status} />
              <span className="font-mono-tabular text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(detailSale.total)}
              </span>
            </div>

            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {detailSale.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{item.description}</p>
                    <p className="font-mono-tabular text-xs text-slate-500">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <span className="font-mono-tabular font-semibold">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-right text-xs text-slate-500 dark:text-slate-400">
              <p>Subtotal: {formatCurrency(detailSale.subtotal)}</p>
              {detailSale.discount > 0 && (
                <p>Desconto: -{formatCurrency(detailSale.discount)}</p>
              )}
              {detailSale.addition > 0 && (
                <p>Acréscimo: +{formatCurrency(detailSale.addition)}</p>
              )}
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Total: {formatCurrency(detailSale.total)} · Pago: {formatCurrency(detailSale.paid_amount)}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Nova Venda */}
      <Modal
        open={newSaleOpen}
        onClose={() => setNewSaleOpen(false)}
        title="Nova venda"
        subtitle="Selecione os itens, desconto, forma de pagamento e status da venda."
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewSaleOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="new-sale-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              Finalizar venda
            </button>
          </>
        }
      >
        <form id="new-sale-form" onSubmit={handleCreateSale} className="space-y-4">
          {saleError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saleError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Cliente (opcional)
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">Consumidor final (sem vínculo)</option>
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
                onChange={(e) => setInitialStatus(e.target.value as SaleStatus)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="confirmada">Confirmada (baixa estoque)</option>
                <option value="aguardando_entrega">Aguardando entrega (reserva estoque)</option>
                <option value="rascunho">Rascunho</option>
              </select>
            </div>
          </div>

          {/* Adicionar item */}
          <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Itens da venda
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {products
                  .filter((p) => p.status === 'ativo')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.sale_price)}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="1"
                value={itemQty}
                onChange={(e) => setItemQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
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
                  <div
                    key={`${it.product_id}-${idx}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-slate-800 dark:text-slate-200">
                      {it.quantity}× {it.description}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular font-medium">
                        {formatCurrency(it.total)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
                Acréscimo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addition}
                onChange={(e) => setAddition(Number(e.target.value) || 0)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Forma de pagamento
              </label>
              <select
                value={paymentMethodId}
                onChange={(e) => setPaymentMethodId(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {paymentMethods
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Condição
              </label>
              <select
                value={paymentCondition}
                onChange={(e) =>
                  setPaymentCondition(e.target.value as Sale['payment_condition'])
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="a_vista">À vista</option>
                <option value="a_prazo">A prazo</option>
                <option value="parcial">Pagamento parcial</option>
              </select>
            </div>
          </div>

          {paymentCondition === 'parcial' && (
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Valor pago agora (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={finalTotal}
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Total da venda
            </span>
            <span className="font-mono-tabular text-xl font-bold text-teal-700 dark:text-teal-400">
              {formatCurrency(finalTotal)}
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
