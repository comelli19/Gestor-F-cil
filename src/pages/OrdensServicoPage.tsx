import { AlertCircle, Eye, Plus, Search, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import { formatCurrency, formatDate, roundCents } from '../lib/formatters';
import { ServiceOrder, ServiceOrderItem, ServiceOrderStatus } from '../types/gestor';

export function OrdensServicoPage() {
  const {
    serviceOrders,
    customers,
    products,
    createServiceOrder,
    updateServiceOrderStatus,
  } = useGestor();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ServiceOrderStatus>('todos');
  const [detailOs, setDetailOs] = useState<ServiceOrder | null>(null);
  const [newOsOpen, setNewOsOpen] = useState(false);

  // Form Nova OS
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [requestedService, setRequestedService] = useState('');
  const [equipment, setEquipment] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [technician, setTechnician] = useState('Carlos Eduardo (Técnico)');
  const [expectedAt, setExpectedAt] = useState('2026-11-22');
  const [laborCost, setLaborCost] = useState(140);
  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id || '');
  const [prodQty, setProdQty] = useState(1);
  const [items, setItems] = useState<Omit<ServiceOrderItem, 'id'>[]>([]);
  const [notes, setNotes] = useState('');
  const [osError, setOsError] = useState('');

  const filteredOs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return serviceOrders.filter((os) => {
      if (statusFilter !== 'todos' && os.status !== statusFilter) return false;
      if (!q) return true;
      const cust = customers.find((c) => c.id === os.customer_id)?.name.toLowerCase() || '';
      return (
        os.document_number.toLowerCase().includes(q) ||
        cust.includes(q) ||
        os.equipment.toLowerCase().includes(q) ||
        os.requested_service.toLowerCase().includes(q)
      );
    });
  }, [serviceOrders, customers, search, statusFilter]);

  const itemsTotal = useMemo(
    () => roundCents(items.reduce((acc, i) => acc + i.total, 0)),
    [items]
  );
  const osTotal = roundCents(itemsTotal + laborCost);

  const openNewOsModal = () => {
    setCustomerId(customers.find((c) => c.status === 'ativo')?.id || customers[0]?.id || '');
    setRequestedService('');
    setEquipment('');
    setProblemDescription('');
    setDiagnosis('');
    setTechnician('Carlos Eduardo (Técnico)');
    setExpectedAt('2026-11-22');
    setLaborCost(140);
    setItems([]);
    setNotes('');
    setOsError('');
    setNewOsOpen(true);
  };

  const handleAddProduct = () => {
    const prod = products.find((p) => p.id === selectedProdId);
    if (!prod || prodQty <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        item_type: 'produto',
        product_id: prod.id,
        description: prod.name,
        quantity: prodQty,
        unit_price: prod.sale_price,
        unit_cost: prod.cost_price,
        total: roundCents(prod.sale_price * prodQty),
      },
    ]);
  };

  const handleCreateOs = (e: React.FormEvent) => {
    e.preventDefault();
    setOsError('');
    if (!customerId || !requestedService.trim() || !equipment.trim()) {
      setOsError('Informe cliente, serviço solicitado e equipamento.');
      return;
    }

    const res = createServiceOrder({
      customer_id: customerId,
      requested_service: requestedService.trim(),
      equipment: equipment.trim(),
      problem_description: problemDescription.trim(),
      diagnosis: diagnosis.trim(),
      technician: technician.trim(),
      items,
      labor_cost: laborCost,
      expected_at: expectedAt,
      notes: notes.trim(),
    });
    if (!res.ok) {
      setOsError(res.error || 'Erro ao abrir ordem de serviço.');
      return;
    }
    setNewOsOpen(false);
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
              placeholder="Buscar por OS, cliente ou equipamento..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'todos' | ServiceOrderStatus)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="todos">Todos os status</option>
            <option value="aberta">Aberta</option>
            <option value="em_analise">Em análise</option>
            <option value="aguardando_aprovacao">Aguardando aprovação</option>
            <option value="aguardando_pecas">Aguardando peças</option>
            <option value="em_execucao">Em execução</option>
            <option value="concluida">Concluída</option>
            <option value="entregue">Entregue</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <button
          type="button"
          onClick={openNewOsModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Nova OS</span>
        </button>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          Produtos previstos geram reserva ao abrir a OS e saída física ao concluí-la.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3">Número</th>
                <th className="px-5 py-3">Cliente · Equipamento</th>
                <th className="px-5 py-3">Responsável</th>
                <th className="px-5 py-3">Previsão</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Valor total</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredOs.map((os) => {
                const customer = customers.find((c) => c.id === os.customer_id);
                return (
                  <tr key={os.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {os.document_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {customer?.name || 'Cliente'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {os.equipment} · {os.requested_service}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {os.technician}
                    </td>
                    <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(os.expected_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={os.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(os.total)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailOs(os)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Gerenciar</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalhes OS */}
      <Modal
        open={Boolean(detailOs)}
        onClose={() => setDetailOs(null)}
        title={detailOs ? `${detailOs.document_number} — ${detailOs.equipment}` : ''}
        subtitle={
          detailOs
            ? `Cliente: ${customers.find((c) => c.id === detailOs.customer_id)?.name || '—'} · Abertura: ${formatDate(detailOs.opened_at)}`
            : ''
        }
        maxWidthClass="max-w-3xl"
      >
        {detailOs && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={detailOs.status} />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Alterar status:</label>
                <select
                  value={detailOs.status}
                  onChange={(e) => {
                    const next = e.target.value as ServiceOrderStatus;
                    updateServiceOrderStatus(detailOs.id, next, true);
                    setDetailOs({ ...detailOs, status: next });
                  }}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="aberta">Aberta</option>
                  <option value="em_analise">Em análise</option>
                  <option value="aguardando_aprovacao">Aguardando aprovação</option>
                  <option value="aguardando_pecas">Aguardando peças</option>
                  <option value="em_execucao">Em execução</option>
                  <option value="concluida">Concluída (baixa estoque e gera cobrança)</option>
                  <option value="entregue">Entregue</option>
                  <option value="cancelada">Cancelada (libera reserva)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 text-sm sm:grid-cols-2 dark:border-slate-800">
              <div>
                <p className="text-xs text-slate-500">Serviço solicitado</p>
                <p className="font-medium">{detailOs.requested_service}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Responsável técnico</p>
                <p className="font-medium">{detailOs.technician}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">Descrição do problema</p>
                <p className="text-slate-700 dark:text-slate-300">{detailOs.problem_description}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">Diagnóstico técnico</p>
                <p className="text-slate-700 dark:text-slate-300">{detailOs.diagnosis || '—'}</p>
              </div>
            </div>

            {detailOs.items.length > 0 && (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {detailOs.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>
                      {it.quantity}× {it.description}{' '}
                      <span className="text-xs text-slate-400">({it.item_type})</span>
                    </span>
                    <span className="font-mono-tabular font-semibold">
                      {formatCurrency(it.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
              <span>Mão de obra: {formatCurrency(detailOs.labor_cost)}</span>
              <span className="font-mono-tabular text-lg font-bold text-slate-900 dark:text-slate-100">
                Total: {formatCurrency(detailOs.total)}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Nova OS */}
      <Modal
        open={newOsOpen}
        onClose={() => setNewOsOpen(false)}
        title="Nova ordem de serviço"
        subtitle="Produtos previstos reservam o saldo disponível imediatamente ao abrir a OS."
        maxWidthClass="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewOsOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="new-os-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              Abrir ordem de serviço
            </button>
          </>
        }
      >
        <form id="new-os-form" onSubmit={handleCreateOs} className="space-y-4">
          {osError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{osError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
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
                Equipamento *
              </label>
              <input
                type="text"
                required
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="Ex.: Notebook Dell Vostro 3510"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Serviço solicitado *
              </label>
              <input
                type="text"
                required
                value={requestedService}
                onChange={(e) => setRequestedService(e.target.value)}
                placeholder="Ex.: Troca de SSD e formatação"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Responsável técnico
              </label>
              <input
                type="text"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Descrição do problema
              </label>
              <textarea
                rows={2}
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Produtos utilizados / previstos (opcional)
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.sale_price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={prodQty}
                onChange={(e) => setProdQty(Math.max(1, Number(e.target.value) || 1))}
                className="h-10 w-24 rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={handleAddProduct}
                className="h-10 rounded-lg border border-slate-200 bg-slate-100 px-3.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                Reservar peça
              </button>
            </div>
            {items.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-sm">
                    <span>
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
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Mão de obra (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={laborCost}
                onChange={(e) => setLaborCost(Number(e.target.value) || 0)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Previsão de conclusão
              </label>
              <input
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
            <span className="text-sm font-medium">Valor total estimado</span>
            <span className="font-mono-tabular text-xl font-bold text-teal-700 dark:text-teal-400">
              {formatCurrency(osTotal)}
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
