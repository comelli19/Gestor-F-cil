import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  Sun,
} from 'lucide-react';
import React, { useState } from 'react';
import { useGestor } from '../context/GestorContext';
import { validateEmail } from '../lib/formatters';

export function LoginPage() {
  const { login, theme, toggleTheme } = useGestor();
  const [mode, setMode] = useState<'login' | 'recovery'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });

  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryTouched, setRecoveryTouched] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);

  const emailValid = validateEmail(email);
  const passwordValid = password.length > 0;
  const recoveryEmailValid = validateEmail(recoveryEmail);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!emailValid || !passwordValid) return;

    setAuthError('');
    setSubmitting(true);
    try {
      const res = await login(email.trim(), password);
      if (!res.ok) {
        setAuthError(res.error || 'E-mail ou senha inválidos.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryTouched(true);
    if (!recoveryEmailValid) return;
    setRecoverySent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 font-display text-sm font-bold text-white dark:bg-teal-600">
            GF
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap dark:text-slate-100">
            Gestor Fácil
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <span>{theme === 'light' ? 'Tema escuro' : 'Tema claro'}</span>
        </button>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-12 dark:border-slate-800 dark:bg-slate-900">
          {/* Painel institucional lateral */}
          <div className="flex flex-col justify-between bg-slate-900 p-8 text-slate-100 md:col-span-5 dark:bg-slate-950/90 dark:border-r dark:border-slate-800">
            <div>
              <p className="text-xs font-medium text-teal-400">
                Plataforma de Gestão · Brasil (BRL)
              </p>
              <h1 className="mt-3 font-display text-2xl font-bold leading-snug text-white">
                Gestão simples para MEIs, serviços e pequenos comércios
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Controle clientes, estoque, vendas, orçamentos, ordens de serviço e financeiro em um único painel claro e organizado.
              </p>
            </div>

            <div className="mt-8 space-y-2.5 border-t border-slate-800 pt-6 text-xs text-slate-400">
              <p>Idioma: Português brasileiro</p>
              <p>Moeda padrão: Real (R$)</p>
              <p>Fuso horário: America/Sao_Paulo</p>
            </div>
          </div>

          {/* Formulário */}
          <div className="p-8 md:col-span-7 md:p-10">
            {mode === 'login' ? (
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  Entrar na sua conta
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Informe seu e-mail e senha para acessar o ambiente autorizado.
                </p>

                {authError && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleLoginSubmit} noValidate className="mt-6 space-y-5">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      E-mail
                    </label>
                    <div className="relative mt-1.5">
                      <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        placeholder="seu@email.com.br"
                        className={`h-11 w-full rounded-lg border bg-white pr-10 pl-10 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
                          touched.email && !emailValid
                            ? 'border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/20 dark:border-slate-700 dark:focus:border-teal-500'
                        }`}
                      />
                      {touched.email && (
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                          {emailValid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                          )}
                        </span>
                      )}
                    </div>
                    {touched.email && !emailValid && (
                      <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                        Informe um endereço de e-mail válido.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="login-password"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryEmail(email);
                          setRecoverySent(false);
                          setRecoveryTouched(false);
                          setMode('recovery');
                        }}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800 hover:underline dark:text-teal-400 dark:hover:text-teal-300"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <div className="relative mt-1.5">
                      <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                        placeholder="Digite sua senha"
                        className={`h-11 w-full rounded-lg border bg-white pr-11 pl-10 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
                          touched.password && !passwordValid
                            ? 'border-rose-500 focus:ring-rose-500/20'
                            : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/20 dark:border-slate-700 dark:focus:border-teal-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute top-1/2 right-2.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {touched.password && !passwordValid && (
                      <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                        Informe sua senha para entrar.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-500"
                  >
                    {submitting ? 'Autenticando...' : 'Entrar no sistema'}
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Voltar para o login</span>
                </button>

                <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-slate-100">
                  Recuperar senha
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  A recuperação automática ainda não está habilitada nesta versão do sistema.
                </p>

                {recoverySent ? (
                  <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/40">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
                      <div className="text-sm text-amber-900 dark:text-amber-200">
                        <p className="font-semibold">Recuperação automática indisponível</p>
                        <p className="mt-1 text-amber-800 dark:text-amber-300">
                          O envio de e-mails ainda não foi configurado. Entre em contato com o administrador da plataforma para redefinir seu acesso.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                    >
                      Retornar ao login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRecoverySubmit} noValidate className="mt-6 space-y-5">
                    <div>
                      <label
                        htmlFor="recovery-email"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        E-mail cadastrado
                      </label>
                      <div className="relative mt-1.5">
                        <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          id="recovery-email"
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          onBlur={() => setRecoveryTouched(true)}
                          placeholder="seu@email.com.br"
                          className={`h-11 w-full rounded-lg border bg-white pr-4 pl-10 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
                            recoveryTouched && !recoveryEmailValid
                              ? 'border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/20 dark:border-slate-700 dark:focus:border-teal-500'
                          }`}
                        />
                      </div>
                      {recoveryTouched && !recoveryEmailValid && (
                        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                          Informe um e-mail válido para enviar a solicitação.
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="flex h-11 w-full items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
                    >
                      Ver instruções de recuperação
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
