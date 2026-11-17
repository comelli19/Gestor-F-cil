import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Package,
  RotateCcw,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import { formatCurrency, formatDate, roundCents } from '../lib/formatters';

type PeriodOption = 'este_mes' | 'mes_anterior' | 'ultimos_3_meses' | 'sem_movimento';

export function DashboardPage() {
  const {
    theme,
    companySettings,
    sales,
    quotes,
    serviceOrders,
    products,
    stockBalances,
    financialEntries,
    financialPayments,
    isZeroSimulation,
    setIsZeroSimulation,
    setActiveModule,
    canAccessModule,
    resetDemoData,
  } = useGestor();

  const [period, setPeriod] = useState<PeriodOption>('este_mes');

  const isEmptyState = isZeroSimulation || period === 'sem_movimento';
  const hasServicesSegment = canAccessModule('ordens_servico');
  const canEstoque = canAccessModule('estoque');
  const canOrcamentos = canAccessModule('orcamentos');
  const canProdutos = canAccessModule('produtos');
  const canFinanceiro = canAccessModule('financeiro');

  // Cálculo dos indicadores reais a partir dos dados em memória
  const metrics = useMemo(() => {
    if (isEmptyState) {
      return {
        faturamentoMes: 0,
        totalVendas: 0,
        servicosRealizados: 0,
        contasAReceber: 0,
        contasAPagar: 0,
        saldoFinanceiro: 0,
        produtosEstoqueBaixo: 0,
        orcamentosAguardando: 0,
        valorOrcamentosAguardando: 0,
        osEmAndamento: 0,
      };
    }

    const now = new Date();
    const monthKey = (offset: number) => {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };
    const selectedMonthKeys = period === 'este_mes'
      ? [monthKey(0)]
      : period === 'mes_anterior'
        ? [monthKey(-1)]
        : [monthKey(0), monthKey(-1), monthKey(-2)];

    const activeSales = sales.filter(
      (sale) => sale.status !== 'cancelada' && sale.status !== 'rascunho' && selectedMonthKeys.includes(sale.sale_date.slice(0, 7))
    );
    const concludedOs = serviceOrders.filter((order) => {
      const conclusionDate = order.completed_at || order.opened_at;
      return (order.status === 'concluida' || order.status === 'entregue') && selectedMonthKeys.includes(conclusionDate.slice(0, 7));
    });

    const faturamentoBase = roundCents(
      activeSales.reduce((acc, sale) => acc + sale.total, 0) +
      concludedOs.reduce((acc, order) => acc + order.total, 0)
    );
    const totalVendasCount = activeSales.length;
    const servicosCount = concludedOs.length;

    const contasAReceber = roundCents(
      financialEntries
        .filter(
          (f) =>
            f.entry_type === 'receber' &&
            f.status !== 'quitado' &&
            f.status !== 'cancelado'
        )
        .reduce((acc, f) => acc + (f.amount - f.paid_amount), 0)
    );

    const contasAPagar = roundCents(
      financialEntries
        .filter(
          (f) =>
            f.entry_type === 'pagar' &&
            f.status !== 'quitado' &&
            f.status !== 'cancelado'
        )
        .reduce((acc, f) => acc + (f.amount - f.paid_amount), 0)
    );

    const entradasRealizadas = financialPayments
      .filter((p) => p.entry_type === 'receber')
      .reduce((acc, p) => acc + p.amount, 0);
    const saidasRealizadas = financialPayments
      .filter((p) => p.entry_type === 'pagar')
      .reduce((acc, p) => acc + p.amount, 0);
    const saldoFinanceiro = roundCents(entradasRealizadas - saidasRealizadas);

    const lowStockProducts = products.filter((prod) => {
      if (!prod.tracks_stock || prod.status !== 'ativo') return false;
      const totalAvailable = stockBalances
        .filter((b) => b.product_id === prod.id)
        .reduce((acc, b) => acc + (b.physical_qty - b.reserved_qty), 0);
      return totalAvailable < prod.min_stock;
    });

    const pendingQuotes = quotes.filter((q) => q.status === 'aguardando_aprovacao');
    const osAndamento = serviceOrders.filter((o) =>
      ['aberta', 'em_analise', 'aguardando_aprovacao', 'aguardando_pecas', 'em_execucao'].includes(
        o.status
      )
    );

    return {
      faturamentoMes: faturamentoBase,
      totalVendas: totalVendasCount,
      servicosRealizados: servicosCount,
      contasAReceber,
      contasAPagar,
      saldoFinanceiro,
      produtosEstoqueBaixo: lowStockProducts.length,
      orcamentosAguardando: pendingQuotes.length,
      valorOrcamentosAguardando: roundCents(
        pendingQuotes.reduce((acc, q) => acc + q.total, 0)
      ),
      osEmAndamento: osAndamento.length,
    };
  }, [
    isEmptyState,
    period,
    sales,
    serviceOrders,
    financialEntries,
    financialPayments,
    products,
    stockBalances,
    quotes,
  ]);

  const chartData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
      const monthLabel = `${monthName}/${String(date.getFullYear()).slice(-2)}`;
      const monthSales = sales
        .filter((sale) => sale.status !== 'cancelada' && sale.status !== 'rascunho' && sale.sale_date.slice(0, 7) === key)
        .reduce((sum, sale) => sum + sale.total, 0);
      const monthOrders = serviceOrders
        .filter((order) => {
          const conclusionDate = order.completed_at || order.opened_at;
          return (order.status === 'concluida' || order.status === 'entregue') && conclusionDate.slice(0, 7) === key;
        })
        .reduce((sum, order) => sum + order.total, 0);
      const receitas = financialPayments
        .filter((payment) => payment.entry_type === 'receber' && payment.payment_date.slice(0, 7) === key)
        .reduce((sum, payment) => sum + payment.amount, 0);
      const despesas = financialPayments
        .filter((payment) => payment.entry_type === 'pagar' && payment.payment_date.slice(0, 7) === key)
        .reduce((sum, payment) => sum + payment.amount, 0);

      return {
        month: monthLabel,
        faturamento: isEmptyState ? 0 : roundCents(monthSales + monthOrders),
        receitas: isEmptyState ? 0 : roundCents(receitas),
        despesas: isEmptyState ? 0 : roundCents(despesas),
      };
    });
    return months;
  }, [isEmptyState, sales, serviceOrders, financialPayments]);

  const lowStockList = useMemo(() => {
    if (isEmptyState) return [];
    return products
      .filter((p) => p.tracks_stock && p.status === 'ativo')
      .map((p) => {
        const available = stockBalances
          .filter((b) => b.product_id === p.id)
          .reduce((acc, b) => acc + (b.physical_qty - b.reserved_qty), 0);
        return { product: p, available };
      })
      .filter((row) => row.available < row.product.min_stock);
  }, [isEmptyState, products, stockBalances]);

  const axisColor = theme === 'dark' ? '#94A3B8' : '#64748B';
  const gridColor = theme === 'dark' ? '#1E293B' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#0F172A' : '#FFFFFF',
    borderColor: theme === 'dark' ? '#334155' : '#E2E8F0',
    borderRadius: '0.5rem',
    color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* Filtros e atualização do painel */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Resumo gerencial da operação
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {companySettings.name} · Fuso America/Sao_Paulo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { id: 'este_mes', label: 'Este mês' },
              { id: 'mes_anterior', label: 'Mês anterior' },
              { id: 'ultimos_3_meses', label: '3 meses' },
              { id: 'sem_movimento', label: 'Sem movimento' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setPeriod(opt.id as PeriodOption);
                  if (opt.id !== 'sem_movimento' && isZeroSimulation) {
                    setIsZeroSimulation(false);
                  }
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  period === opt.id && !isZeroSimulation
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsZeroSimulation(!isZeroSimulation)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isZeroSimulation
                ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>{isZeroSimulation ? 'Modo zerado ativo' : 'Testar empresa zerada'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPeriod('este_mes');
              resetDemoData();
            }}
            title="Atualizar dados da empresa"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Grade de Indicadores Principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Faturamento do período</span>
            <ArrowUpRight className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(metrics.faturamentoMes)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {metrics.totalVendas} vendas · {metrics.servicosRealizados} serviços concluídos
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Contas a receber</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(metrics.contasAReceber)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Valores previstos em aberto
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Contas a pagar</span>
            <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatCurrency(metrics.contasAPagar)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Compromissos pendentes
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Saldo financeiro realizado</span>
            <Wallet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <p
            className={`mt-2 font-mono-tabular text-2xl font-bold ${
              metrics.saldoFinanceiro < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {formatCurrency(metrics.saldoFinanceiro)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Fluxo de caixa efetivado
          </p>
        </div>
      </div>

      {/* Linha secundária de indicadores operacionais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          disabled={!canEstoque}
          onClick={() => canEstoque && setActiveModule('estoque')}
          className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors dark:border-slate-800 dark:bg-slate-900 ${
            canEstoque ? 'hover:border-teal-300 dark:hover:border-teal-700' : 'cursor-default opacity-75'
          }`}
        >
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Produtos com estoque baixo
            </p>
            <p className="mt-1 font-mono-tabular text-xl font-bold text-slate-900 dark:text-slate-100">
              {metrics.produtosEstoqueBaixo}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {!canEstoque
                ? 'Módulo de estoque não habilitado'
                : metrics.produtosEstoqueBaixo > 0
                  ? 'Abaixo do estoque mínimo configurado'
                  : 'Nenhum alerta no momento'}
            </p>
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              metrics.produtosEstoqueBaixo > 0
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
        </button>

        <button
          type="button"
          disabled={!canOrcamentos}
          onClick={() => canOrcamentos && setActiveModule('orcamentos')}
          className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors dark:border-slate-800 dark:bg-slate-900 ${
            canOrcamentos ? 'hover:border-teal-300 dark:hover:border-teal-700' : 'cursor-default opacity-75'
          }`}
        >
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Orçamentos aguardando aprovação
            </p>
            <p className="mt-1 font-mono-tabular text-xl font-bold text-slate-900 dark:text-slate-100">
              {metrics.orcamentosAguardando}
            </p>
            <p className="mt-0.5 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
              {canOrcamentos
                ? `Total em análise: ${formatCurrency(metrics.valorOrcamentosAguardando)}`
                : 'Módulo de orçamentos não habilitado'}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            <FileText className="h-5 w-5" />
          </div>
        </button>

        {hasServicesSegment ? (
          <button
            type="button"
            onClick={() => setActiveModule('ordens_servico')}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
          >
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Ordens de serviço em andamento
              </p>
              <p className="mt-1 font-mono-tabular text-xl font-bold text-slate-900 dark:text-slate-100">
                {metrics.osEmAndamento}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Abertas, em análise ou em execução
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
              <Wrench className="h-5 w-5" />
            </div>
          </button>
        ) : (
          <button
            type="button"
            disabled={!canProdutos}
            onClick={() => canProdutos && setActiveModule('produtos')}
            className={`flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors dark:border-slate-800 dark:bg-slate-900 ${
              canProdutos ? 'hover:border-teal-300 dark:hover:border-teal-700' : 'cursor-default opacity-75'
            }`}
          >
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Produtos ativos no catálogo
              </p>
              <p className="mt-1 font-mono-tabular text-xl font-bold text-slate-900 dark:text-slate-100">
                {isEmptyState ? 0 : products.filter((p) => p.status === 'ativo').length}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {canProdutos ? 'Catálogo liberado para a empresa' : 'Catálogo de produtos não habilitado'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Package className="h-5 w-5" />
            </div>
          </button>
        )}
      </div>

      {/* Gráficos: Faturamento Mensal e Receitas versus Despesas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Faturamento mensal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vendas confirmadas e serviços concluídos nos últimos 6 meses
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${v}`}
                  width={68}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Faturamento']}
                />
                <Bar
                  dataKey="faturamento"
                  name="Faturamento"
                  fill={theme === 'dark' ? '#14B8A6' : '#0F766E'}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Receitas versus despesas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparativo mensal de entradas e saídas realizadas
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$ ${v}`}
                  width={68}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => [
                    formatCurrency(Number(value ?? 0)),
                    String(name ?? ''),
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="receitas"
                  name="Receitas"
                  fill="#16A34A"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="despesas"
                  name="Despesas"
                  fill="#E11D48"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabelas rápidas de acompanhamento */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Alertas de estoque mínimo
            </h3>
            {canEstoque && (
              <button
                type="button"
                onClick={() => setActiveModule('estoque')}
                className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
              >
                Ver estoque
              </button>
            )}
          </div>
          {lowStockList.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {isEmptyState
                ? 'Sem movimentação de estoque no período selecionado.'
                : 'Todos os produtos estão acima do estoque mínimo.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Produto</th>
                    <th className="px-5 py-2.5 text-right font-medium">Disponível</th>
                    <th className="px-5 py-2.5 text-right font-medium">Mínimo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lowStockList.map(({ product, available }) => (
                    <tr key={product.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {product.name}
                        </p>
                        <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          {product.sku}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-amber-700 dark:text-amber-400">
                        {available} {product.unit}
                      </td>
                      <td className="px-5 py-3 text-right font-mono-tabular text-slate-500 dark:text-slate-400">
                        {product.min_stock} {product.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Vencimentos próximos
            </h3>
            {canFinanceiro && (
              <button
                type="button"
                onClick={() => setActiveModule('financeiro')}
                className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
              >
                Ir para financeiro
              </button>
            )}
          </div>
          {isEmptyState ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum lançamento financeiro pendente no período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Descrição</th>
                    <th className="px-5 py-2.5 font-medium">Vencimento</th>
                    <th className="px-5 py-2.5 text-right font-medium">Restante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {financialEntries
                    .filter((f) => f.status !== 'quitado' && f.status !== 'cancelado')
                    .slice(0, 4)
                    .map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3">
                          <p className="max-w-[220px] truncate font-medium text-slate-900 dark:text-slate-100">
                            {entry.description}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {entry.entry_type === 'receber' ? 'A receber' : 'A pagar'}
                            </span>
                            <StatusBadge status={entry.status} />
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                          {formatDate(entry.due_date)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-mono-tabular font-semibold ${
                            entry.entry_type === 'receber'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatCurrency(entry.amount - entry.paid_amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
