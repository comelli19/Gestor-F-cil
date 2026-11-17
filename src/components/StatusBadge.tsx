import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  FileEdit,
  PackageCheck,
  Send,
  Timer,
  Truck,
  Wrench,
  XCircle,
} from 'lucide-react';
import React from 'react';
import {
  FinancialEntryStatus,
  QuoteStatus,
  RecordStatus,
  SaleStatus,
  ServiceOrderStatus,
} from '../types/gestor';

type AnyStatus =
  | RecordStatus
  | SaleStatus
  | QuoteStatus
  | ServiceOrderStatus
  | FinancialEntryStatus;

interface BadgeConfig {
  label: string;
  classes: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATUS_MAP: Record<string, BadgeConfig> = {
  ativo: {
    label: 'Ativo',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: CheckCircle2,
  },
  inativo: {
    label: 'Inativo',
    classes:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    icon: Ban,
  },
  rascunho: {
    label: 'Rascunho',
    classes:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: FileEdit,
  },
  confirmada: {
    label: 'Confirmada',
    classes:
      'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/70',
    icon: CheckCircle2,
  },
  aguardando_entrega: {
    label: 'Aguardando entrega',
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
    icon: Truck,
  },
  entregue: {
    label: 'Entregue',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: PackageCheck,
  },
  cancelada: {
    label: 'Cancelada',
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
    icon: XCircle,
  },
  cancelado: {
    label: 'Cancelado',
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
    icon: XCircle,
  },
  enviado: {
    label: 'Enviado',
    classes:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70',
    icon: Send,
  },
  aguardando_aprovacao: {
    label: 'Aguardando aprovação',
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
    icon: Clock,
  },
  aprovado: {
    label: 'Aprovado',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: CheckCircle2,
  },
  recusado: {
    label: 'Recusado',
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
    icon: XCircle,
  },
  expirado: {
    label: 'Expirado',
    classes:
      'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    icon: Timer,
  },
  aberta: {
    label: 'Aberta',
    classes:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70',
    icon: FileEdit,
  },
  em_analise: {
    label: 'Em análise',
    classes:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70',
    icon: Clock,
  },
  aguardando_pecas: {
    label: 'Aguardando peças',
    classes:
      'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/70',
    icon: AlertCircle,
  },
  em_execucao: {
    label: 'Em execução',
    classes:
      'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/70',
    icon: Wrench,
  },
  concluida: {
    label: 'Concluída',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: CheckCircle2,
  },
  recebida: {
    label: 'Recebida',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: PackageCheck,
  },
  pendente: {
    label: 'Pendente',
    classes:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70',
    icon: Clock,
  },
  parcial: {
    label: 'Parcial',
    classes:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/70',
    icon: Timer,
  },
  quitado: {
    label: 'Quitado',
    classes:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
    icon: CheckCircle2,
  },
  vencido: {
    label: 'Vencido',
    classes:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70',
    icon: AlertCircle,
  },
};

export function StatusBadge({ status, label }: { status: AnyStatus | string; label?: string }) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    classes:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Clock,
  };
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0 ${cfg.classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label ?? cfg.label}</span>
    </span>
  );
}
