import { useGestor } from '../context/GestorContext';
import { getModuleIcon } from '../lib/moduleIcons';
import { PlatformModule } from '../types/gestor';

export function CustomModulePage({ module }: { module: PlatformModule }) {
  const { companySettings } = useGestor();
  const Icon = getModuleIcon(module.icon);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
              {module.section} · {module.route}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
              {module.name}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              {module.description || 'Módulo habilitado exclusivamente pelo administrador da plataforma para a sua empresa.'}
            </p>
          </div>
        </div>

        <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 whitespace-nowrap dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300">
          Liberado para {companySettings.name}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3 dark:border-slate-800">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Identificador</p>
          <p className="mt-1 font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100">
            {module.slug}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ordem no menu</p>
          <p className="mt-1 font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100">
            #{module.display_order}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Proteção de rota</p>
          <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Validada no servidor
          </p>
        </div>
      </div>
    </div>
  );
}
