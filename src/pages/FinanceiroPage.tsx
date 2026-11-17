import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Plus,
  Wallet,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import { formatCurrency, formatDate, roundCents } from '../lib/formatters';
import { FinancialEntry, FinancialEntryType } from '../types/gestor';

export function FinanceiroPage() {
  const {
    financialEntries,
    financialPayments,
    paymentMethods,
    createFinancialEntry,
    registerPayment,
  } = useGestor();

  const [tab, setTab] = useState<'receber' | 'pagar' | 'fluxo'>('receber');

  // Modal de baixa / pagamento parcial
  const [payEntry, setPayEntry] = useState<FinancialEntry | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState('2026-11-17');
  const [payMethodId, setPayMethodId] = useState('pm-pix');
  const [externalRef, setExternalRef] = useState('');
  const [payError, setPayError] = useState('');

  // Modal de novo lançamento
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    entry_type: 'receber' as FinancialEntryType,
    description: '',
    category: 'Vendas de Produtos',
    amount: 0,
    due_date: '2026-11-25',
    payment_method_id: 'pm-pix',
  });

  const totals = useMemo(() => {
    const receberPendente = roundCents(
      financialEntries
        .filter(
          (f) => f.entry_type === 'receber' && f.status !== 'quitado' && f.status !== 'cancelado'
        )
        .reduce((acc, f) => acc + (f.amount - f.paid_amount), 0)
    );
    const pagarPendente = roundCents(
      financialEntries
        .filter(
          (f) => f.entry_type === 'pagar' && f.status !== 'quitado' && f.status !== 'cancelado'
        )
        .reduce((acc, f) => acc + (f.amount - f.paid_amount), 0)
    );
    const entradasRealizadas = roundCents(
      financialPayments
        .filter((p) => p.entry_type === 'receber')
        .reduce((acc, p) => acc + p.amount, 0)
    );
    const saidasRealizadas = roundCents(
      financialPayments
        .filter((p) => p.entry_type === 'pagar')
        .reduce((acc, p) => acc + p.amount, 0)
    );
    return {
      receberPendente,
      pagarPendente,
      entradasRealizadas,
      saidasRealizadas,
      saldoRealizado: roundCents(entradasRealizadas - saidasRealizadas),
    };
  }, [financialEntries, financialPayments]);

  const filteredEntries = useMemo(
    () => financialEntries.filter((f) => f.entry_type === tab),
    [financialEntries, tab]
  );

  const openPayModal = (entry: FinancialEntry) => {
    const remaining = roundCents(entry.amount - entry.paid_amount);
    setPayEntry(entry);
    setPayAmount(remaining);
    setPayDate('2026-11-17');
    setPayMethodId(entry.payment_method_id || 'pm-pix');
    setExternalRef('');
    setPayError('');
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payEntry) return;
    setPayError('');
    const res = registerPayment({
      entryId: payEntry.id,
      amount: payAmount,
      payment_date: payDate,
      payment_method_id: payMethodId,
      external_ref: externalRef,
    });
    if (!res.ok) {
      setPayError(res.error || 'Erro ao registrar pagamento.');
      return;
    }
    setPayEntry(null);
  };

  const handleCreateEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.description.trim() || newForm.amount <= 0) return;
    createFinancialEntry({
      ...newForm,
      description: newForm.description.trim(),
    });
    setNewOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Resumo Financeiro: Previstos vs Realizado (RN-20) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Contas a receber (previsto em aberto)</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(totals.receberPendente)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Contas a pagar (previsto em aberto)</span>
            <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(totals.pagarPendente)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Fluxo de caixa realizado (saldo)</span>
            <Wallet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-teal-700 dark:text-teal-400">
            {formatCurrency(totals.saldoRealizado)}
          </p>
          <p className="mt-0.5 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
            Entradas {formatCurrency(totals.entradasRealizadas)} · Saídas{' '}
            {formatCurrency(totals.saidasRealizadas)}
          </p>
        </div>
      </div>

      {/* Abas separadas: Contas a Receber, Contas a Pagar e Fluxo de Caixa */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('receber')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'receber'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Contas a receber
          </button>
          <button
            type="button"
            onClick={() => setTab('pagar')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'pagar'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Contas a pagar
          </button>
          <button
            type="button"
            onClick={() => setTab('fluxo')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'fluxo'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            Fluxo de caixa realizado
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewForm({
              entry_type: tab === 'pagar' ? 'pagar' : 'receber',
              description: '',
              category: tab === 'pagar' ? 'Despesas Fixas' : 'Outras Receitas',
              amount: 0,
              due_date: '2026-11-25',
              payment_method_id: 'pm-pix',
            });
            setNewOpen(true);
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0 dark:bg-teal-600 dark:hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          <span>Novo lançamento</span>
        </button>
      </div>

      {/* Conteúdo das abas */}
      {tab !== 'fluxo' ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            Projeção de compromissos e recebimentos futuros (separados do fluxo de caixa realizado). Pagamentos parciais são permitidos.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Descrição / Origem</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3 text-right">Valor total</th>
                  <th className="px-5 py-3 text-right">Saldo aberto</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredEntries.map((entry) => {
                  const remaining = roundCents(entry.amount - entry.paid_amount);
                  const pm = paymentMethods.find((p) => p.id === entry.payment_method_id);
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {entry.description}
                        </p>
                        <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          {entry.origin_id} · {pm?.name || 'Pix'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {entry.category}
                      </td>
                      <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(entry.due_date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular text-slate-600 dark:text-slate-300">
                        {formatCurrency(entry.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {remaining > 0 && entry.status !== 'cancelado' ? (
                          <button
                            type="button"
                            onClick={() => openPayModal(entry)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-teal-600 px-2.5 text-xs font-medium text-teal-700 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-950/50"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            <span>{entry.entry_type === 'receber' ? 'Receber' : 'Pagar'}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Fluxo de Caixa Realizado */
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
            Somente movimentações efetivamente pagas ou recebidas (escopo gerencial M09).
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Data do pagamento</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">Forma</th>
                  <th className="px-5 py-3 text-right">Valor realizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {financialPayments.map((pay) => {
                  const pm = paymentMethods.find((p) => p.id === pay.payment_method_id);
                  return (
                    <tr
                      key={pay.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3.5 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(pay.payment_date)}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-medium">
                        {pay.entry_type === 'receber' ? (
                          <span className="text-emerald-700 dark:text-emerald-400">Entrada</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">Saída</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {pay.description}
                        </p>
                        {pay.external_ref && (
                          <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                            Ref.: {pay.external_ref}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                        {pm?.name || 'Pix'}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-mono-tabular font-semibold ${
                          pay.entry_type === 'receber'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {pay.entry_type === 'receber' ? '+' : '-'}
                        {formatCurrency(pay.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Baixa / Pagamento */}
      <Modal
        open={Boolean(payEntry)}
        onClose={() => setPayEntry(null)}
        title={payEntry?.entry_type === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento'}
        subtitle={payEntry?.description}
        maxWidthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPayEntry(null)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pay-entry-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              Confirmar baixa
            </button>
          </>
        }
      >
        {payEntry && (
          <form id="pay-entry-form" onSubmit={handlePaySubmit} className="space-y-4">
            {payError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              Saldo restante em aberto:{' '}
              <strong className="font-mono-tabular text-slate-900 dark:text-slate-100">
                {formatCurrency(roundCents(payEntry.amount - payEntry.paid_amount))}
              </strong>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Valor pago (aceita parcial) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Data efetiva *
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Forma de pagamento
                </label>
                <select
                  value={payMethodId}
                  onChange={(e) => setPayMethodId(e.target.value)}
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
                  Referência externa (opcional)
                </label>
                <input
                  type="text"
                  value={externalRef}
                  onChange={(e) => setExternalRef(e.target.value)}
                  placeholder="ID Pix / NSU"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Novo Lançamento */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Novo lançamento financeiro"
        maxWidthClass="max-w-lg"
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
              form="new-fin-form"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              Criar lançamento
            </button>
          </>
        }
      >
        <form id="new-fin-form" onSubmit={handleCreateEntry} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Tipo
              </label>
              <select
                value={newForm.entry_type}
                onChange={(e) =>
                  setNewForm({ ...newForm, entry_type: e.target.value as FinancialEntryType })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="receber">Conta a receber</option>
                <option value="pagar">Conta a pagar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Categoria
              </label>
              <input
                type="text"
                value={newForm.category}
                onChange={(e) => setNewForm({ ...newForm, category: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Descrição *
              </label>
              <input
                type="text"
                required
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                placeholder="Ex.: Conta de energia elétrica Nov/2026"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={newForm.amount}
                onChange={(e) =>
                  setNewForm({ ...newForm, amount: Number(e.target.value) || 0 })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Vencimento *
              </label>
              <input
                type="date"
                required
                value={newForm.due_date}
                onChange={(e) => setNewForm({ ...newForm, due_date: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
