import {
  AlertCircle,
  Building2,
  CheckCircle2,
  History,
  Info,
  Layers,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useGestor } from '../context/GestorContext';
import { getModuleIcon } from '../lib/moduleIcons';

export function AppShell({
  children,
  adminTab,
  onAdminTabChange,
}: {
  children: React.ReactNode;
  adminTab?: 'empresas' | 'modulos' | 'auditoria';
  onAdminTabChange?: (tab: 'empresas' | 'modulos' | 'auditoria') => void;
}) {
  const {
    theme,
    toggleTheme,
    authUser,
    authorizedModules,
    adminCompanies,
    adminPreviewCompanyId,
    adminEnabledModuleIds,
    selectAdminPreviewCompany,
    currentPath,
    navigateToPath,
    companySettings,
    userName,
    logout,
    toasts,
    dismissToast,
  } = useGestor();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPlatformAdmin = Boolean(authUser?.is_platform_admin);
  const isAdminConfigRoute = isPlatformAdmin && currentPath.startsWith('/admin');

  const groupedSections = useMemo(() => {
    const ordered: Array<{ section: string; items: typeof authorizedModules }> = [];
    const seen = new Map<string, number>();

    for (const mod of authorizedModules) {
      // Clientes só veem módulos ativos; Admin vê todos os módulos para visualizar/testar
      if (!isPlatformAdmin && !mod.is_active) continue;
      const existingIndex = seen.get(mod.section);
      if (existingIndex === undefined) {
        seen.set(mod.section, ordered.length);
        ordered.push({ section: mod.section, items: [mod] });
      } else {
        ordered[existingIndex].items.push(mod);
      }
    }
    return ordered;
  }, [authorizedModules, isPlatformAdmin]);

  const currentTitle = useMemo(() => {
    if (isAdminConfigRoute) {
      if (adminTab === 'modulos') return 'Catálogo Global de Módulos';
      if (adminTab === 'auditoria') return 'Auditoria da Plataforma';
      return 'Administração de Empresas e Módulos';
    }
    const found = authorizedModules.find((m) => m.route === currentPath);
    return found?.name ?? 'Gestor Fácil';
  }, [isAdminConfigRoute, adminTab, authorizedModules, currentPath]);

  const handleSelectRoute = (route: string) => {
    navigateToPath(route);
    setMobileMenuOpen(false);
  };

  const handleSelectAdminTab = (tab: 'empresas' | 'modulos' | 'auditoria') => {
    onAdminTabChange?.(tab);
    navigateToPath('/admin/modulos');
    setMobileMenuOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-700 font-display text-xs font-bold text-white dark:bg-teal-600">
              GF
            </div>
            <span className="truncate font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Gestor Fácil
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800/80">
          {isPlatformAdmin ? (
            <>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Administrador Principal</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                Console exclusivo do desenvolvedor
              </p>
            </>
          ) : (
            <>
              <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                {companySettings.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                Plano {companySettings.plan} · BRL
              </p>
            </>
          )}
        </div>

        <nav className="space-y-5 px-3 py-4" aria-label="Menu principal">
          {isPlatformAdmin && (
            <div>
              <p className="px-3 text-xs font-semibold text-teal-700 dark:text-teal-400">
                Configurações da Plataforma
              </p>
              <div className="mt-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectAdminTab('empresas')}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    isAdminConfigRoute && adminTab === 'empresas'
                      ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Empresas e Liberações</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAdminTab('modulos')}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    isAdminConfigRoute && adminTab === 'modulos'
                      ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                  }`}
                >
                  <Layers className="h-4 w-4 shrink-0" />
                  <span className="truncate">Catálogo de Módulos</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAdminTab('auditoria')}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    isAdminConfigRoute && adminTab === 'auditoria'
                      ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                  }`}
                >
                  <History className="h-4 w-4 shrink-0" />
                  <span className="truncate">Auditoria</span>
                </button>
              </div>
            </div>
          )}

          {isPlatformAdmin && adminCompanies.length > 0 && (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <label
                htmlFor="admin-preview-company"
                className="block px-3 text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                Testar telas na empresa
              </label>
              <div className="mt-1.5 px-2">
                <select
                  id="admin-preview-company"
                  value={adminPreviewCompanyId}
                  onChange={(e) => selectAdminPreviewCompany(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {adminCompanies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {groupedSections.map(({ section, items }) => (
            <div key={section}>
              <p className="px-3 text-xs font-medium text-slate-400 dark:text-slate-500">
                {section}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {items.map((mod) => {
                  const Icon = getModuleIcon(mod.icon);
                  const isActive = currentPath === mod.route;
                  const isDisabledForPreviewCompany =
                    isPlatformAdmin &&
                    (!mod.is_active || !adminEnabledModuleIds.includes(mod.id));

                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => handleSelectRoute(mod.route)}
                      className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive
                              ? 'text-teal-700 dark:text-teal-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                        <span className="truncate">{mod.name}</span>
                      </span>
                      {isDisabledForPreviewCompany && (
                        <span className="shrink-0 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                          {!mod.is_active ? 'Inativo' : 'Oculto'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
              {userName}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {authUser?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sair para tela de login"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap shrink-0 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 lg:block dark:border-slate-800">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebarContent}</div>
      </aside>

      {/* Drawer Mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Área Principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu lateral"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-slate-400 sm:inline dark:text-slate-500">
                Gestor Fácil
              </span>
              <span className="hidden text-slate-300 sm:inline dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <h1 className="truncate font-display text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">
                {currentTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Mudar para tema escuro' : 'Mudar para tema claro'}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <span className="hidden sm:inline">
                {theme === 'light' ? 'Escuro' : 'Claro'}
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {isPlatformAdmin && !isAdminConfigRoute && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm dark:border-teal-900/60 dark:bg-teal-950/30">
                <div className="flex items-center gap-2.5 text-teal-900 dark:text-teal-200">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
                  <span>
                    Modo Administrador (Visualização e Teste) · Empresa ativa:{' '}
                    <strong>{companySettings.name}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {adminCompanies.length > 0 && (
                    <select
                      aria-label="Empresa em visualização"
                      value={adminPreviewCompanyId}
                      onChange={(e) => selectAdminPreviewCompany(e.target.value)}
                      className="h-9 rounded-lg border border-teal-300 bg-white px-2.5 text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none dark:border-teal-800 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {adminCompanies.map((comp) => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSelectAdminTab('empresas')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 text-xs font-semibold text-teal-800 hover:bg-teal-100/70 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-300 dark:hover:bg-teal-950"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Configurações da Plataforma</span>
                  </button>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      {/* Notificações (Toast) */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              {t.type === 'success' && (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              {t.type === 'error' && (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              {t.type === 'info' && (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
              )}
              <p className="flex-1 text-sm text-slate-800 dark:text-slate-100">{t.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dispensar aviso"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
