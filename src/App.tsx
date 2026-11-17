import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { AppShell } from './components/AppShell';
import { GestorProvider, useGestor } from './context/GestorContext';
import { AdminModulesPage } from './pages/AdminModulesPage';
import { ClientesPage } from './pages/ClientesPage';
import { ComprasPage } from './pages/ComprasPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { CustomModulePage } from './pages/CustomModulePage';
import { DashboardPage } from './pages/DashboardPage';
import { EstoquePage } from './pages/EstoquePage';
import { FinanceiroPage } from './pages/FinanceiroPage';
import { LoginPage } from './pages/LoginPage';
import { OrcamentosPage } from './pages/OrcamentosPage';
import { OrdensServicoPage } from './pages/OrdensServicoPage';
import { ProdutosServicosPage } from './pages/ProdutosServicosPage';
import { VendasPage } from './pages/VendasPage';

function AccessDeniedScreen({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center dark:border-rose-900/60 dark:bg-slate-900">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-slate-100">
        Acesso não autorizado (403)
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        A liberação de módulos é controlada exclusivamente pelo administrador da plataforma.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar ao início autorizado</span>
      </button>
    </div>
  );
}

function GestorRouter() {
  const {
    authLoading,
    isAuthenticated,
    authUser,
    authorizedModules,
    currentPath,
    navigateToPath,
    accessDeniedMessage,
    clearAccessDenied,
  } = useGestor();

  const [adminTab, setAdminTab] = useState<'empresas' | 'modulos' | 'auditoria'>('empresas');

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Validando sessão e módulos autorizados...
      </div>
    );
  }

  if (!isAuthenticated || !authUser) {
    return <LoginPage />;
  }

  const currentModule = authorizedModules.find((m) => m.route === currentPath);

  const renderModulePage = (mod: typeof currentModule) => {
    if (!mod) return null;
    switch (mod.slug) {
      case 'dashboard':
        return <DashboardPage />;
      case 'clientes':
        return <ClientesPage />;
      case 'produtos':
        return <ProdutosServicosPage />;
      case 'estoque':
        return <EstoquePage />;
      case 'vendas':
        return <VendasPage />;
      case 'orcamentos':
        return <OrcamentosPage />;
      case 'ordens_servico':
        return <OrdensServicoPage />;
      case 'compras':
        return <ComprasPage />;
      case 'financeiro':
        return <FinanceiroPage />;
      case 'configuracoes':
        return <ConfiguracoesPage />;
      default:
        return <CustomModulePage module={mod} />;
    }
  };

  // Administrador Principal (Desenvolvedor): acessa Configurações da Plataforma E todas as telas para visualização e teste
  if (authUser.is_platform_admin) {
    return (
      <AppShell adminTab={adminTab} onAdminTabChange={setAdminTab}>
        {currentPath.startsWith('/admin') || !currentModule ? (
          <AdminModulesPage activeTab={adminTab} onTabChange={setAdminTab} />
        ) : (
          renderModulePage(currentModule)
        )}
      </AppShell>
    );
  }

  // Bloqueio explícito (403) ao tentar acessar rota não autorizada / módulo desabilitado / área admin
  if (accessDeniedMessage || !currentModule || !currentModule.is_active) {
    return (
      <AppShell>
        <AccessDeniedScreen
          message={
            accessDeniedMessage ||
            'Este módulo não está habilitado para a sua empresa ou encontra-se desativado.'
          }
          onBack={() => {
            clearAccessDenied();
            navigateToPath('/dashboard');
          }}
        />
      </AppShell>
    );
  }

  return <AppShell>{renderModulePage(currentModule)}</AppShell>;
}

export default function App() {
  return (
    <GestorProvider>
      <GestorRouter />
    </GestorProvider>
  );
}
