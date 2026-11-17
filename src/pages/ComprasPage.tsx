import { Plus, Truck } from 'lucide-react';
import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import { formatCurrency, formatDate, formatDocument } from '../lib/formatters';

export function ComprasPage() {
  const { purchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus } = useGestor();
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierDocument, setSupplierDocument] = useState('');
  const [itemsSummary, setItemsSummary] = useState('');
  const [total, setTotal] = useState('0');
  const [expectedDate, setExpectedDate] = useState('2026-11-25');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await createPurchaseOrder({
      supplier_name: supplierName,
      supplier_document: supplierDocument,
      items_summary: itemsSummary,
      total: Number(total) || 0,
      status: 'pendente',
      expected_date: expectedDate,
    });
    if (ok) {
      setSupplierName('');
      setSupplierDocument('');
      setItemsSummary('');
      setTotal('0');
      setModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
            Compras e fornecedores
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pedidos de compra, reposição de mercadorias e previsão de recebimento.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Nova compra</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {purchaseOrders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Truck className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              Nenhuma ordem de compra registrada
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Registre um pedido para acompanhar entregas de fornecedores.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Pedido</th>
                  <th className="px-5 py-3 font-medium">Fornecedor</th>
                  <th className="px-5 py-3 font-medium">Itens</th>
                  <th className="px-5 py-3 font-medium">Previsão</th>
                  <th className="px-5 py-3 text-right font-medium">Valor total</th>
                  <th className="px-5 py-3 font-medium">Situação</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {po.document_number}
                      <p className="text-xs font-normal text-slate-500">
                        {formatDate(po.order_date)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {po.supplier_name}
                      </p>
                      {po.supplier_document && (
                        <p className="font-mono-tabular text-xs text-slate-500">
                          {formatDocument(po.supplier_document)}
                        </p>
                      )}
                    </td>
                    <td className="max-w-xs px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {po.items_summary}
                    </td>
                    <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(po.expected_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(po.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={po.status}
                        label={po.status === 'pendente' ? 'Aguardando entrega' : undefined}
                      />
                    </td>
                      <td className="px-5 py-3.5 text-right">
                        {po.status === 'pendente' && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updatePurchaseOrderStatus(po.id, 'recebida')}
                              className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                            >
                              Receber
                            </button>
                            <button
                              type="button"
                              onClick={() => updatePurchaseOrderStatus(po.id, 'cancelada')}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo pedido de compra"
        subtitle="Registre uma solicitação de reposição junto ao fornecedor."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Fornecedor *
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ex.: Distribuidora TechSul Ltda"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                CNPJ / CPF do fornecedor
              </label>
              <input
                type="text"
                value={supplierDocument}
                onChange={(e) => setSupplierDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Resumo dos itens *
            </label>
            <input
              type="text"
              required
              value={itemsSummary}
              onChange={(e) => setItemsSummary(e.target.value)}
              placeholder="Ex.: 10x SSD NVMe + 5x Cabos HDMI"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Valor total (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Previsão de entrega
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
            >
              Registrar compra
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
