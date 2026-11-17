import { AlertCircle, Building2, CheckCircle2, CreditCard, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { useGestor } from '../context/GestorContext';
import {
  formatDocument,
  formatPhone,
  onlyDigits,
  validateCpfOrCnpj,
} from '../lib/formatters';
import { PaymentMethod } from '../types/gestor';

export function ConfiguracoesPage() {
  const {
    companySettings,
    updateCompanySettings,
    paymentMethods,
    togglePaymentMethod,
    addPaymentMethod,
  } = useGestor();

  const [form, setForm] = useState({
    name: companySettings.name,
    legal_name: companySettings.legal_name,
    document: formatDocument(companySettings.document),
    email: companySettings.email,
    phone: formatPhone(companySettings.phone),
    address: companySettings.address,
    city: companySettings.city,
    state: companySettings.state,
  });
  const [docError, setDocError] = useState('');

  useEffect(() => {
    setForm({
      name: companySettings.name,
      legal_name: companySettings.legal_name,
      document: formatDocument(companySettings.document),
      email: companySettings.email,
      phone: formatPhone(companySettings.phone),
      address: companySettings.address,
      city: companySettings.city,
      state: companySettings.state,
    });
  }, [companySettings]);

  const [newPmName, setNewPmName] = useState('');
  const [newPmType, setNewPmType] = useState<PaymentMethod['type']>('pix');

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setDocError('');
    const check = validateCpfOrCnpj(form.document);
    if (!check.valid) {
      setDocError(check.message || 'CNPJ/CPF inválido.');
      return;
    }
    updateCompanySettings({
      ...form,
      document: onlyDigits(form.document),
      phone: onlyDigits(form.phone),
    });
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPmName.trim()) return;
    addPaymentMethod(newPmName, newPmType);
    setNewPmName('');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Dados da Empresa */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4 dark:border-slate-800">
          <Building2 className="h-5 w-5 text-teal-700 dark:text-teal-400" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Dados da empresa
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informações exibidas nos seus documentos comerciais e cadastros.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCompany} className="mt-5 space-y-4">
          {docError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{docError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Nome fantasia *
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Razão social
              </label>
              <input
                type="text"
                value={form.legal_name}
                onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                CNPJ / CPF
              </label>
              <input
                type="text"
                value={form.document}
                onChange={(e) =>
                  setForm({ ...form, document: formatDocument(e.target.value) })
                }
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                E-mail comercial
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Endereço
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Cidade
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                UF
              </label>
              <input
                type="text"
                maxLength={2}
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono-tabular text-sm uppercase dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Moeda: Real (BRL) · Fuso: America/Sao_Paulo</span>
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Salvar dados da empresa</span>
            </button>
          </div>
        </form>
      </div>

      {/* Regras operacionais e Formas de pagamento (sem qualquer controle de módulos na interface do cliente) */}
      <div className="space-y-6 lg:col-span-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Regras operacionais
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ajustes gerais de comportamento da operação da empresa.
          </p>

          <div className="mt-4 space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Permitir estoque negativo (RN-08)
                </p>
                <p className="text-xs text-slate-500">
                  Por padrão o sistema bloqueia saídas sem saldo disponível
                </p>
              </div>
              <input
                type="checkbox"
                checked={companySettings.allow_negative_stock}
                onChange={(e) =>
                  updateCompanySettings({ allow_negative_stock: e.target.checked })
                }
                className="h-4 w-4 accent-teal-700"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
            <CreditCard className="h-5 w-5 text-teal-700 dark:text-teal-400" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Formas de pagamento
            </h3>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {pm.name}
                </span>
                <div className="flex items-center gap-2.5">
                  <StatusBadge status={pm.active ? 'ativo' : 'inativo'} />
                  <button
                    type="button"
                    onClick={() => togglePaymentMethod(pm.id)}
                    className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {pm.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddPayment} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newPmName}
              onChange={(e) => setNewPmName(e.target.value)}
              placeholder="Nova forma (ex.: Link Pagamento)"
              className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
            <select
              value={newPmType}
              onChange={(e) => setNewPmType(e.target.value as PaymentMethod['type'])}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="pix">Pix</option>
              <option value="cartao_credito">Cartão Crédito</option>
              <option value="cartao_debito">Cartão Débito</option>
              <option value="boleto">Boleto</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="transferencia">Transferência</option>
            </select>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-600"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
