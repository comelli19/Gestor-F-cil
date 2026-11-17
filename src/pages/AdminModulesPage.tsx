import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Building2,
  CheckCircle2,
  Eye,
  History,
  Layers,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { useGestor } from '../context/GestorContext';
import { apiRequest } from '../lib/api';
import { formatDateTime, formatDocument } from '../lib/formatters';
import { AVAILABLE_MODULE_ICONS, getModuleIcon } from '../lib/moduleIcons';
import {
  AuditLogEntry,
  CompanyModuleBinding,
  CompanySummary,
  PlatformModule,
} from '../types/gestor';

interface AdminOverviewResponse {
  companies: CompanySummary[];
  modules: PlatformModule[];
  companyModules: CompanyModuleBinding[];
  auditLogs: AuditLogEntry[];
  userEmailsByCompany: Record<string, string>;
}

const SECTION_OPTIONS = ['Visão geral', 'Cadastros', 'Operação', 'Gestão', 'Outros'];

export function AdminModulesPage({
  activeTab,
  onTabChange,
}: {
  activeTab: 'empresas' | 'modulos' | 'auditoria';
  onTabChange: (tab: 'empresas' | 'modulos' | 'auditoria') => void;
}) {
  const { notify, refreshWorkspace } = useGestor();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal Criar / Editar Módulo
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<PlatformModule | null>(null);
  const [modForm, setModForm] = useState({
    name: '',
    slug: '',
    description: '',
    icon: 'Layers',
    route: '',
    section: 'Operação',
    is_active: true,
    enabled_company_ids: [] as string[],
  });

  // Modal Empresas usando este módulo
  const [inspectModule, setInspectModule] = useState<PlatformModule | null>(null);
  const [inspectCompanies, setInspectCompanies] = useState<
    Array<{ id: string; name: string; plan: string; document: string; enabled: boolean }>
  >([]);

  // Modal Nova Empresa Cliente
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [compForm, setCompForm] = useState({
    name: '',
    document: '',
    plan: 'Profissional' as CompanySummary['plan'],
    user_name: '',
    user_email: '',
    password: '',
    enabled_module_ids: [] as string[],
  });

  const loadOverview = useCallback(async () => {
    try {
      setErrorMsg('');
      const data = await apiRequest<AdminOverviewResponse>('/api/admin/overview');
      setOverview(data);
      setSelectedCompanyId((prev) =>
        prev && data.companies.some((c) => c.id === prev)
          ? prev
          : data.companies[0]?.id ?? ''
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar painel administrativo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const companies = overview?.companies ?? [];
  const modules = overview?.modules ?? [];
  const companyModules = overview?.companyModules ?? [];
  const auditLogs = overview?.auditLogs ?? [];
  const userEmailsByCompany = overview?.userEmailsByCompany ?? {};

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const isModuleEnabledForCompany = (companyId: string, moduleId: string): boolean => {
    const binding = companyModules.find(
      (cm) => cm.company_id === companyId && cm.module_id === moduleId
    );
    return binding?.enabled ?? false;
  };

  const countEnabledForCompany = (companyId: string): number => {
    return modules.filter(
      (m) => m.is_active && isModuleEnabledForCompany(companyId, m.id)
    ).length;
  };

  const countCompaniesUsingModule = (moduleId: string): number => {
    return companies.filter((c) => isModuleEnabledForCompany(c.id, moduleId)).length;
  };

  const handleToggleCompanyModule = async (companyId: string, moduleId: string, nextVal: boolean) => {
    try {
      const res = await apiRequest<{ ok: boolean; overview: AdminOverviewResponse }>(
        `/api/admin/companies/${companyId}/modules/${moduleId}`,
        { method: 'PUT', body: { enabled: nextVal } }
      );
      setOverview(res.overview);
      void refreshWorkspace();
      notify(nextVal ? 'Módulo habilitado para a empresa.' : 'Módulo desabilitado para a empresa.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao atualizar vínculo.', 'error');
    }
  };

  const handleToggleModuleGlobal = async (mod: PlatformModule) => {
    try {
      const res = await apiRequest<{ ok: boolean; overview: AdminOverviewResponse }>(
        `/api/admin/modules/${mod.id}`,
        { method: 'PATCH', body: { is_active: !mod.is_active } }
      );
      setOverview(res.overview);
      void refreshWorkspace();
      notify(
        !mod.is_active
          ? `Módulo "${mod.name}" ativado globalmente.`
          : `Módulo "${mod.name}" desativado globalmente.`,
        'info'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao alterar status global.', 'error');
    }
  };

  const handleMoveModule = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    const reordered = [...modules];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    const orderedIds = reordered.map((m) => m.id);

    try {
      const res = await apiRequest<{ ok: boolean; overview: AdminOverviewResponse }>(
        '/api/admin/modules/reorder',
        { method: 'PUT', body: { orderedIds } }
      );
      setOverview(res.overview);
      void refreshWorkspace();
      notify('Ordem de exibição no menu atualizada.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao reordenar.', 'error');
    }
  };

  const openCreateModule = () => {
    setEditingModule(null);
    setModForm({
      name: '',
      slug: '',
      description: '',
      icon: 'BarChart3',
      route: '',
      section: 'Operação',
      is_active: true,
      enabled_company_ids: [],
    });
    setModuleModalOpen(true);
  };

  const openEditModule = (mod: PlatformModule) => {
    setEditingModule(mod);
    setModForm({
      name: mod.name,
      slug: mod.slug,
      description: mod.description,
      icon: mod.icon,
      route: mod.route,
      section: mod.section,
      is_active: mod.is_active,
      enabled_company_ids: [],
    });
    setModuleModalOpen(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingModule) {
        const res = await apiRequest<{ ok: boolean; overview: AdminOverviewResponse }>(
          `/api/admin/modules/${editingModule.id}`,
          {
            method: 'PATCH',
            body: {
              name: modForm.name,
              description: modForm.description,
              icon: modForm.icon,
              route: modForm.route,
              section: modForm.section,
              is_active: modForm.is_active,
            },
          }
        );
        setOverview(res.overview);
        void refreshWorkspace();
        notify(`Módulo "${modForm.name}" atualizado.`);
      } else {
        const res = await apiRequest<{ ok: boolean; overview: AdminOverviewResponse }>(
          '/api/admin/modules',
          {
            method: 'POST',
            body: {
              name: modForm.name,
              slug: modForm.slug || undefined,
              description: modForm.description,
              icon: modForm.icon,
              route: modForm.route || undefined,
              section: modForm.section,
              is_active: modForm.is_active,
              enabled_company_ids: modForm.enabled_company_ids,
            },
          }
        );
        setOverview(res.overview);
        void refreshWorkspace();
        notify(`Novo módulo "${modForm.name}" criado na plataforma.`);
      }
      setModuleModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao salvar módulo.', 'error');
    }
  };

  const handleDeleteModule = async (mod: PlatformModule) => {
    try {
      const res = await apiRequest<{ ok: boolean; overview: AdminOverviewResponse }>(
        `/api/admin/modules/${mod.id}`,
        { method: 'DELETE' }
      );
      setOverview(res.overview);
      void refreshWorkspace();
      notify(`Módulo "${mod.name}" removido da plataforma.`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Não foi possível remover o módulo.', 'error');
    }
  };

  const handleInspectModuleCompanies = async (mod: PlatformModule) => {
    try {
      const res = await apiRequest<{
        companies: Array<{
          id: string;
          name: string;
          plan: string;
          document: string;
          enabled: boolean;
        }>;
      }>(`/api/admin/modules/${mod.id}/companies`);
      setInspectModule(mod);
      setInspectCompanies(res.companies);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao consultar empresas.', 'error');
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ ok: boolean; overview: AdminOverviewResponse }>(
        '/api/admin/companies',
        { method: 'POST', body: compForm }
      );
      setOverview(res.overview);
      void refreshWorkspace();
      setCompanyModalOpen(false);
      setCompForm({
        name: '',
        document: '',
        plan: 'Profissional',
        user_name: '',
        user_email: '',
        password: '',
        enabled_module_ids: [],
      });
      notify('Nova empresa cliente cadastrada com sucesso.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao cadastrar empresa.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Carregando console do administrador da plataforma...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-200">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Erro ao carregar administração</p>
          <p className="mt-1">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho exclusivo do administrador */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Administração Central de Módulos
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Controle exclusivo do desenvolvedor: gerencie o catálogo global e libere módulos por empresa cliente.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onTabChange('empresas')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'empresas'
                ? 'bg-teal-700 text-white dark:bg-teal-600'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Empresas ({companies.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('modulos')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'modulos'
                ? 'bg-teal-700 text-white dark:bg-teal-600'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Módulos ({modules.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('auditoria')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'auditoria'
                ? 'bg-teal-700 text-white dark:bg-teal-600'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Auditoria ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* ABA 1: EMPRESAS & LIBERAÇÃO INDIVIDUAL */}
      {activeTab === 'empresas' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Empresas cadastradas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selecione uma empresa para liberar ou ocultar módulos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompanyModalOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-700 px-2.5 text-xs font-semibold text-white hover:bg-teal-800 whitespace-nowrap dark:bg-teal-600"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Nova empresa</span>
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {companies.map((comp) => {
                const isSelected = comp.id === selectedCompanyId;
                const activeCount = countEnabledForCompany(comp.id);
                const loginEmail = userEmailsByCompany[comp.id];
                return (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => setSelectedCompanyId(comp.id)}
                    className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/60 dark:border-teal-500 dark:bg-teal-950/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {comp.name}
                        </p>
                        <p className="mt-0.5 font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          {formatDocument(comp.document)} · Plano {comp.plan}
                        </p>
                        {loginEmail && (
                          <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">
                            Login: {loginEmail}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono-tabular text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {activeCount}/{modules.filter((m) => m.is_active).length}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            {selectedCompany ? (
              <div>
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      Módulos liberados — {selectedCompany.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Alterações entram em vigor imediatamente no menu lateral e bloqueiam/liberam as rotas e APIs desta empresa.
                    </p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {modules.map((mod) => {
                    const Icon = getModuleIcon(mod.icon);
                    const enabled = isModuleEnabledForCompany(selectedCompany.id, mod.id);
                    const lockedDashboard = mod.slug === 'dashboard';
                    return (
                      <div
                        key={mod.id}
                        className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              enabled && mod.is_active
                                ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {mod.name}
                              </p>
                              <span className="font-mono-tabular text-xs text-slate-400">
                                {mod.route}
                              </span>
                              {!mod.is_active && (
                                <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                                  Desativado globalmente
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {mod.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span
                            className={`text-xs font-medium ${
                              enabled && mod.is_active
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {!mod.is_active ? 'Bloqueado global' : enabled ? 'Habilitado' : 'Oculto'}
                          </span>
                          <button
                            type="button"
                            disabled={lockedDashboard}
                            onClick={() =>
                              handleToggleCompanyModule(selectedCompany.id, mod.id, !enabled)
                            }
                            className={`h-8 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                              lockedDashboard
                                ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800'
                                : enabled
                                  ? 'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800/70 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40'
                                  : 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500'
                            }`}
                          >
                            {lockedDashboard
                              ? 'Obrigatório'
                              : enabled
                                ? 'Desabilitar'
                                : 'Habilitar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Nenhuma empresa selecionada.</p>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: CATÁLOGO GLOBAL DE MÓDULOS */}
      {activeTab === 'modulos' && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                Módulos da plataforma e ordem no menu lateral
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adicione novos módulos, edite nomes/ícones, reordene a exibição ou desative globalmente.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModule}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 whitespace-nowrap dark:bg-teal-600"
            >
              <Plus className="h-4 w-4" />
              <span>Novo módulo</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Ordem</th>
                  <th className="px-4 py-3 font-medium">Módulo</th>
                  <th className="px-4 py-3 font-medium">Seção / Rota</th>
                  <th className="px-4 py-3 font-medium">Empresas</th>
                  <th className="px-4 py-3 font-medium">Status global</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {modules.map((mod, idx) => {
                  const Icon = getModuleIcon(mod.icon);
                  const compCount = countCompaniesUsingModule(mod.id);
                  return (
                    <tr key={mod.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="w-6 font-mono-tabular text-xs font-semibold text-slate-600 dark:text-slate-300">
                            #{mod.display_order}
                          </span>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveModule(idx, -1)}
                            title="Subir no menu"
                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === modules.length - 1}
                            onClick={() => handleMoveModule(idx, 1)}
                            title="Descer no menu"
                            className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {mod.name}
                            </p>
                            <p className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                              {mod.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {mod.section}
                        </p>
                        <p className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                          {mod.route}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleInspectModuleCompanies(mod)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 font-mono-tabular text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {compCount}/{companies.length}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={mod.is_core}
                          onClick={() => handleToggleModuleGlobal(mod)}
                          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                            mod.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-300'
                          } ${mod.is_core ? 'cursor-default opacity-80' : 'hover:opacity-90'}`}
                        >
                          {mod.is_core
                            ? 'Essencial ativo'
                            : mod.is_active
                              ? 'Ativo global'
                              : 'Desativado global'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModule(mod)}
                            title="Editar nome, ícone ou seção"
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>
                          {!mod.is_core && (
                            <button
                              type="button"
                              onClick={() => handleDeleteModule(mod)}
                              title="Remover módulo da plataforma"
                              className="inline-flex h-8 items-center justify-center rounded-md border border-rose-200 px-2 text-rose-600 hover:bg-rose-50 dark:border-rose-800/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: AUDITORIA DE ALTERAÇÕES */}
      {activeTab === 'auditoria' && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              Registro de auditoria (audit_logs)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Histórico imutável de criação, alteração, reordenação e liberação de módulos realizada pelo administrador principal.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Data / Hora</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="px-4 py-3 font-medium">Administrador</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono-tabular text-xs text-slate-500 whitespace-nowrap dark:text-slate-400">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {log.actor_email}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
                      {log.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR MÓDULO */}
      <Modal
        open={moduleModalOpen}
        onClose={() => setModuleModalOpen(false)}
        title={editingModule ? `Editar módulo — ${editingModule.name}` : 'Criar novo módulo na plataforma'}
        subtitle="Apenas o administrador principal define nomes, ícones, rotas e seções do menu lateral."
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveModule} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Nome exibido no menu *
              </label>
              <input
                type="text"
                required
                value={modForm.name}
                onChange={(e) => setModForm({ ...modForm, name: e.target.value })}
                placeholder="Ex.: Relatórios Gerenciais"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Identificador (slug) {editingModule ? '(fixo)' : '*'}
              </label>
              <input
                type="text"
                disabled={Boolean(editingModule)}
                value={modForm.slug}
                onChange={(e) => setModForm({ ...modForm, slug: e.target.value })}
                placeholder="Ex.: relatorios"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Descrição funcional
            </label>
            <input
              type="text"
              value={modForm.description}
              onChange={(e) => setModForm({ ...modForm, description: e.target.value })}
              placeholder="Resumo do que este módulo oferece ao cliente"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Ícone
              </label>
              <select
                value={modForm.icon}
                onChange={(e) => setModForm({ ...modForm, icon: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {AVAILABLE_MODULE_ICONS.map((ic) => (
                  <option key={ic.id} value={ic.id}>
                    {ic.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Seção do menu
              </label>
              <select
                value={modForm.section}
                onChange={(e) => setModForm({ ...modForm, section: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {SECTION_OPTIONS.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Rota
              </label>
              <input
                type="text"
                value={modForm.route}
                onChange={(e) => setModForm({ ...modForm, route: e.target.value })}
                placeholder="/modulos/relatorios"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Módulo ativo globalmente
              </p>
              <p className="text-xs text-slate-500">
                Se desativado, fica oculto e bloqueado para todas as empresas.
              </p>
            </div>
            <input
              type="checkbox"
              disabled={editingModule?.is_core}
              checked={modForm.is_active}
              onChange={(e) => setModForm({ ...modForm, is_active: e.target.checked })}
              className="h-4 w-4 accent-teal-700"
            />
          </label>

          {!editingModule && companies.length > 0 && (
            <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                Liberar imediatamente para as empresas selecionadas:
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {companies.map((c) => {
                  const checked = modForm.enabled_company_ids.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                    >
                      <span className="truncate font-medium">{c.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setModForm((prev) => ({
                            ...prev,
                            enabled_company_ids: checked
                              ? prev.enabled_company_ids.filter((id) => id !== c.id)
                              : [...prev.enabled_company_ids, c.id],
                          }))
                        }
                        className="h-4 w-4 accent-teal-700"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModuleModalOpen(false)}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{editingModule ? 'Salvar alterações' : 'Criar módulo'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: EMPRESAS COM ESTE MÓDULO */}
      <Modal
        open={Boolean(inspectModule)}
        onClose={() => setInspectModule(null)}
        title={`Empresas com "${inspectModule?.name ?? ''}"`}
        subtitle="Consulte quais empresas clientes possuem acesso habilitado a este módulo."
        maxWidthClass="max-w-md"
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {inspectCompanies.map((comp) => (
            <div key={comp.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {comp.name}
                </p>
                <p className="text-xs text-slate-500">Plano {comp.plan}</p>
              </div>
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                  comp.enabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {comp.enabled ? 'Habilitado' : 'Não contratado'}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      {/* MODAL: NOVA EMPRESA CLIENTE */}
      <Modal
        open={companyModalOpen}
        onClose={() => setCompanyModalOpen(false)}
        title="Cadastrar nova empresa cliente"
        subtitle="Crie uma empresa isolada com login próprio e defina seus módulos iniciais."
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleCreateCompany} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Nome da empresa *
              </label>
              <input
                type="text"
                required
                value={compForm.name}
                onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
                placeholder="Ex.: Oficina Modelo Ltda"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                CNPJ / CPF
              </label>
              <input
                type="text"
                value={compForm.document}
                onChange={(e) => setCompForm({ ...compForm, document: e.target.value })}
                placeholder="00.000.000/0001-91"
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
                value={compForm.user_name}
                onChange={(e) => setCompForm({ ...compForm, user_name: e.target.value })}
                placeholder="Nome do usuário"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Plano
              </label>
              <select
                value={compForm.plan}
                onChange={(e) =>
                  setCompForm({ ...compForm, plan: e.target.value as CompanySummary['plan'] })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="Gratuito">Gratuito</option>
                <option value="Profissional">Profissional</option>
                <option value="Empresarial">Empresarial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                E-mail de acesso *
              </label>
              <input
                type="email"
                required
                value={compForm.user_email}
                onChange={(e) => setCompForm({ ...compForm, user_email: e.target.value })}
                placeholder="acesso@empresa.com.br"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Senha inicial (mín. 10) *
              </label>
              <input
                type="password"
                required
                minLength={10}
                value={compForm.password}
                onChange={(e) => setCompForm({ ...compForm, password: e.target.value })}
                placeholder="Mínimo 10 caracteres"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              Módulos iniciais liberados (Dashboard e Configurações incluídos):
            </p>
            <div className="grid grid-cols-2 gap-2">
              {modules
                .filter((m) => m.slug !== 'dashboard' && m.slug !== 'configuracoes')
                .map((m) => {
                  const checked = compForm.enabled_module_ids.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                    >
                      <span className="truncate font-medium">{m.name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setCompForm((prev) => ({
                            ...prev,
                            enabled_module_ids: checked
                              ? prev.enabled_module_ids.filter((id) => id !== m.id)
                              : [...prev.enabled_module_ids, m.id],
                          }))
                        }
                        className="h-4 w-4 accent-teal-700"
                      />
                    </label>
                  );
                })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCompanyModalOpen(false)}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
            >
              Cadastrar empresa
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
