import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  History,
  Plus,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { useGestor } from '../context/GestorContext';
import { formatCurrency, formatDateTime } from '../lib/formatters';

const MOVEMENT_LABELS: Record<string, string> = {
  entrada_compra: 'Entrada por compra',
  saida_manual: 'Saída manual',
  saida_venda: 'Saída por venda',
  saida_os: 'Saída por OS',
  devolucao_cliente: 'Devolução de cliente',
  devolucao_fornecedor: 'Devolução a fornecedor',
  ajuste_inventario: 'Ajuste de inventário',
  transferencia_saida: 'Transferência (saída)',
  transferencia_entrada: 'Transferência (entrada)',
  estorno: 'Estorno',
};

export function EstoquePage() {
  const {
    products,
    warehouses,
    stockBalances,
    stockMovements,
    registerStockMovement,
    companySettings,
    userName,
  } = useGestor();

  const [tab, setTab] = useState<'posicao' | 'historico'>('posicao');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('todos');
  const [alertOnly, setAlertOnly] = useState(false);

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [moveForm, setMoveForm] = useState({
    product_id: products[0]?.id || '',
    warehouse_id: warehouses[0]?.id || '',
    target_warehouse_id: warehouses[1]?.id || '',
    movement_type: 'entrada_compra' as
      | 'entrada_compra'
      | 'saida_manual'
      | 'ajuste_inventario'
      | 'transferencia'
      | 'devolucao_cliente',
    quantity: 1,
    unit_cost: products[0]?.cost_price || 0,
    reason: '',
    responsible: userName,
  });

  const rows = useMemo(() => {
    const tracked = products.filter((p) => p.tracks_stock);
    const result: Array<{
      productId: string;
      sku: string;
      name: string;
      unit: string;
      minStock: number;
      warehouseId: string;
      warehouseName: string;
      physical: number;
      reserved: number;
      available: number;
      isBelowMin: boolean;
    }> = [];

    for (const prod of tracked) {
      for (const wh of warehouses) {
        if (warehouseFilter !== 'todos' && wh.id !== warehouseFilter) continue;
        const bal = stockBalances.find(
          (b) => b.product_id === prod.id && b.warehouse_id === wh.id
        );
        if (!bal && wh.id !== warehouses[0].id) continue;

        const physical = bal?.physical_qty ?? 0;
        const reserved = bal?.reserved_qty ?? 0;
        const available = physical - reserved;
        const isBelowMin = available < prod.min_stock;

        if (alertOnly && !isBelowMin) continue;

        result.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unit: prod.unit,
          minStock: prod.min_stock,
          warehouseId: wh.id,
          warehouseName: wh.name,
          physical,
          reserved,
          available,
          isBelowMin,
        });
      }
    }

    return result;
  }, [products, warehouses, stockBalances, warehouseFilter, alertOnly]);

  const openMovementFor = (productId?: string, warehouseId?: string) => {
    const prod = products.find((p) => p.id === (productId || products[0]?.id));
    setMoveForm({
      product_id: prod?.id || '',
      warehouse_id: warehouseId || warehouses[0]?.id || '',
      target_warehouse_id: warehouses[1]?.id || warehouses[0]?.id || '',
      movement_type: 'entrada_compra',
      quantity: 1,
      unit_cost: prod?.cost_price || 0,
      reason: '',
      responsible: userName,
    });
    setMoveError('');
    setMoveModalOpen(true);
  };

  const handleMoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMoveError('');
    const res = registerStockMovement({
      product_id: moveForm.product_id,
      warehouse_id: moveForm.warehouse_id,
      target_warehouse_id: moveForm.target_warehouse_id,
      movement_type: moveForm.movement_type,
      quantity: Number(moveForm.quantity),
      unit_cost: Number(moveForm.unit_cost),
      reason: moveForm.reason,
      responsible: moveForm.responsible || userName,
    });
    if (!res.ok) {
      setMoveError(res.error || 'Erro ao movimentar estoque.');
      return;
    }
    setMoveModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Barra superior */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setTab('posicao')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'posicao'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Posição atual</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('historico')}
              className={`inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                tab === 'historico'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Movimentações ({stockMovements.length})</span>
            </button>
          </div>

          {tab === 'posicao' && (
            <>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="todos">Todos os locais</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setAlertOnly((v) => !v)}
                className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  alertOnly
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Abaixo do mínimo</span>
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => openMovementFor()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Movimentar estoque</span>
        </button>
      </div>

      {/* Posição Atual */}
      {tab === 'posicao' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            <span>Disponível = Saldo físico menos saldo reservado</span>
            <span>
              Estoque negativo:{' '}
              <strong className="text-slate-700 dark:text-slate-200">
                {companySettings.allow_negative_stock ? 'Permitido' : 'Bloqueado (RN-08)'}
              </strong>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Local</th>
                  <th className="px-5 py-3 text-right">Saldo físico</th>
                  <th className="px-5 py-3 text-right">Reservado</th>
                  <th className="px-5 py-3 text-right">Disponível</th>
                  <th className="px-5 py-3 text-right">Mínimo</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr
                    key={`${r.productId}-${r.warehouseId}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{r.name}</p>
                      <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                        {r.sku}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {r.warehouseName}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular text-slate-700 dark:text-slate-300">
                      {r.physical} {r.unit}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular text-amber-700 dark:text-amber-400">
                      {r.reserved} {r.unit}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold">
                      <span
                        className={
                          r.isBelowMin
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }
                      >
                        {r.available} {r.unit}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                      {r.minStock} {r.unit}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openMovementFor(r.productId, r.warehouseId)}
                        className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Movimentar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Histórico de Movimentações */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Data / Hora</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Local</th>
                  <th className="px-5 py-3">Tipo / Origem</th>
                  <th className="px-5 py-3 text-right">Qtd.</th>
                  <th className="px-5 py-3 text-right">Custo unit.</th>
                  <th className="px-5 py-3">Responsável / Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stockMovements.map((mov) => {
                  const prod = products.find((p) => p.id === mov.product_id);
                  const wh = warehouses.find((w) => w.id === mov.warehouse_id);
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                        {formatDateTime(mov.created_at)}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {prod?.name || mov.product_id}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {wh?.name || mov.warehouse_id}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {MOVEMENT_LABELS[mov.movement_type] || mov.movement_type}
                        </p>
                        <p className="font-mono-tabular text-slate-500 dark:text-slate-400">
                          {mov.source_type} · {mov.source_id}
                        </p>
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-mono-tabular font-semibold ${
                          mov.quantity > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                      </td>
                      <td className="px-5 py-3 text-right font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                        {formatCurrency(mov.unit_cost)}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <p className="font-medium">{mov.created_by}</p>
                        {mov.reason && (
                          <p className="text-slate-500 dark:text-slate-400">{mov.reason}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Movimentação */}
      <Modal
        open={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title="Movimentar estoque"
        subtitle="Toda movimentação gera registro rastreável com responsável e custo unitário (RN-09)."
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setMoveModalOpen(false)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="stock-move-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              Confirmar movimentação
            </button>
          </>
        }
      >
        <form id="stock-move-form" onSubmit={handleMoveSubmit} className="space-y-4">
          {moveError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{moveError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Tipo de movimentação *
            </label>
            <select
              value={moveForm.movement_type}
              onChange={(e) =>
                setMoveForm({
                  ...moveForm,
                  movement_type: e.target.value as typeof moveForm.movement_type,
                })
              }
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="entrada_compra">Entrada por compra</option>
              <option value="saida_manual">Saída manual</option>
              <option value="ajuste_inventario">Ajuste de inventário (+/-)</option>
              <option value="devolucao_cliente">Devolução de cliente</option>
              <option value="transferencia">Transferência entre locais</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Produto *
            </label>
            <select
              value={moveForm.product_id}
              onChange={(e) => {
                const prod = products.find((p) => p.id === e.target.value);
                setMoveForm({
                  ...moveForm,
                  product_id: e.target.value,
                  unit_cost: prod?.cost_price || 0,
                });
              }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {products
                .filter((p) => p.tracks_stock)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                {moveForm.movement_type === 'transferencia' ? 'Local de origem *' : 'Local de estoque *'}
              </label>
              <select
                value={moveForm.warehouse_id}
                onChange={(e) => setMoveForm({ ...moveForm, warehouse_id: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {moveForm.movement_type === 'transferencia' ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Local de destino *
                </label>
                <select
                  value={moveForm.target_warehouse_id}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, target_warehouse_id: e.target.value })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Custo unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={moveForm.unit_cost}
                  onChange={(e) =>
                    setMoveForm({ ...moveForm, unit_cost: Number(e.target.value) || 0 })
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Quantidade{' '}
                {moveForm.movement_type === 'ajuste_inventario'
                  ? '(use negativo para baixar)'
                  : '*'}
              </label>
              <input
                type="number"
                step="1"
                required
                value={moveForm.quantity}
                onChange={(e) =>
                  setMoveForm({ ...moveForm, quantity: Number(e.target.value) })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Responsável *
              </label>
              <input
                type="text"
                required
                value={moveForm.responsible}
                onChange={(e) => setMoveForm({ ...moveForm, responsible: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Justificativa / Observação{' '}
              {moveForm.movement_type === 'ajuste_inventario' ? '*' : '(opcional)'}
            </label>
            <textarea
              rows={2}
              value={moveForm.reason}
              onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}
              placeholder="Ex.: Conferência física mensal, nota de compra, ajuste de avaria..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
