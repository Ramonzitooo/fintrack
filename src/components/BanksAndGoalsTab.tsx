import React, { useState } from 'react';
import { AppState, fmtBRL } from '../utils/storage';
import {
  BankAccount,
  Caixinha,
  annualToMonthlyRate,
  calculateBudget503020,
  calculateCdiMonthlyYield,
  calculateFireProjection,
  calculateGoalMonthsCompound,
  sumMoney,
} from '../utils/financeMath';
import { Plus, ArrowLeftRight, Trash2, Pencil } from 'lucide-react';

interface BanksViewProps {
  state: AppState;
  onOpenNewBank: () => void;
  onOpenPixTransfer: () => void;
  onAdjustBankBalance: (bankId: string) => void;
  onDeleteBank: (bankId: string) => void;
  onUpdateCdiRate: (newRate: number) => void;
  onUpdateBank?: (bank: BankAccount) => void;
}

export const BanksTab: React.FC<BanksViewProps> = ({
  state,
  onOpenNewBank,
  onOpenPixTransfer,
  onAdjustBankBalance,
  onDeleteBank,
  onUpdateCdiRate,
  onUpdateBank,
}) => {
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editBankName, setEditBankName] = useState('');
  const [editBankType, setEditBankType] = useState<BankAccount['tipo']>('Conta Digital');
  const [editBankRende, setEditBankRende] = useState(true);
  const [editBankPctCdi, setEditBankPctCdi] = useState('100');
  const [editBankError, setEditBankError] = useState<string | null>(null);

  const startEditBank = (b: BankAccount) => {
    setEditingBankId(b.id);
    setEditBankName(b.nome);
    setEditBankType(b.tipo);
    setEditBankRende(Boolean(b.rendeJuros));
    setEditBankPctCdi(String(b.pctCDI ?? 100));
    setEditBankError(null);
  };

  const handleSaveBank = (b: BankAccount) => {
    const trimmed = editBankName.trim();
    if (!trimmed) {
      setEditBankError('Informe o nome da conta.');
      return;
    }
    const parsedPct = editBankRende ? parseFloat(editBankPctCdi) : 0;
    if (editBankRende && (!Number.isFinite(parsedPct) || parsedPct < 0)) {
      setEditBankError('Informe um percentual do CDI válido.');
      return;
    }
    onUpdateBank?.({
      ...b,
      nome: trimmed,
      tipo: editBankType,
      rendeJuros: editBankRende,
      pctCDI: editBankRende ? parsedPct : 0,
    });
    setEditingBankId(null);
    setEditBankError(null);
  };
  const cdiAnual = state.configuracoes.taxaCdiAnual ?? 10.75;
  const totalBancos = sumMoney(state.bancos.map((b) => b.saldo || 0));

  let totalRendendo = 0;
  let totalParado = 0;
  let rendimentoBrutoMes = 0;
  let rendimentoLiquidoMes = 0;

  state.bancos.forEach((b) => {
    if (b.rendeJuros) {
      totalRendendo += b.saldo;
      const y = calculateCdiMonthlyYield(b.saldo, b.pctCDI ?? 100, cdiAnual, 17.5);
      rendimentoBrutoMes += y.grossMonthly;
      rendimentoLiquidoMes += y.netMonthly;
    } else {
      totalParado += b.saldo;
    }
  });

  const pctRendendo =
    totalBancos > 0 ? Math.max(0, Math.min(100, Math.round((totalRendendo / totalBancos) * 100))) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Contas Bancárias & Custódia de Liquidez
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Acompanhe quanto tem em cada instituição, o rendimento composto líquido de IR e transfira saldos via Pix.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
              <span className="text-slate-600 dark:text-slate-400">CDI Anual:</span>
              <input
                type="number"
                step="0.25"
                value={cdiAnual}
                onChange={(e) => onUpdateCdiRate(parseFloat(e.target.value) || 0)}
                aria-label="Taxa CDI Anual (%)"
                className="w-14 font-mono tabular-nums font-semibold text-right bg-transparent text-slate-900 dark:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
              <span className="text-slate-600 dark:text-slate-400">% a.a.</span>
            </div>
            <button
              onClick={onOpenPixTransfer}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Transferir via Pix</span>
            </button>
            <button
              onClick={onOpenNewBank}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Conta</span>
            </button>
          </div>
        </div>

        {/* KPIs de Liquidez */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Total Geral em Contas</span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(totalBancos)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
              Soma de {state.bancos.length} instituições
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Dinheiro Rendendo (CDI)</span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(totalRendendo)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
              {pctRendendo}% do saldo bancário ativo
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Dinheiro Parado (0%)</span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-slate-600 dark:text-slate-300 privacy-val">
              {fmtBRL(totalParado)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
              Sem remuneração automática
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Rendimento Composto Líquido
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-sky-700 dark:text-sky-400 privacy-val">
              + {fmtBRL(rendimentoLiquidoMes)}/mês
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block font-mono tabular-nums privacy-val">
              Bruto: +{fmtBRL(rendimentoBrutoMes)}/mês (IR descontado)
            </span>
          </div>
        </div>

        {/* Lista de Contas */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
          {state.bancos.map((b) => {
            const fatia =
              totalBancos > 0 ? Math.max(0, Math.min(100, Math.round((b.saldo / totalBancos) * 100))) : 0;
            const yieldInfo = b.rendeJuros
              ? calculateCdiMonthlyYield(b.saldo, b.pctCDI ?? 100, cdiAnual, 17.5)
              : { grossMonthly: 0, netMonthly: 0 };

            return (
              <div
                key={b.id}
                className="py-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{b.nome}</span>
                      <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">{b.tipo}</span>
                      <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          b.rendeJuros ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {b.rendeJuros ? `Rende ${b.pctCDI ?? 100}% do CDI` : '0% CDI (Saldo Estático)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Participação: <strong>{fatia}%</strong> ·{' '}
                      {b.rendeJuros ? (
                        <span className="font-mono tabular-nums privacy-val">
                          Rendimento líquido estimado: + {fmtBRL(yieldInfo.netMonthly)}/mês (Bruto: +{' '}
                          {fmtBRL(yieldInfo.grossMonthly)})
                        </span>
                      ) : (
                        'Disponível para giro imediato ou espécie'
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span
                      className={`font-mono tabular-nums text-lg font-bold privacy-val ${
                        b.saldo < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {fmtBRL(b.saldo)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editingBankId === b.id ? setEditingBankId(null) : startEditBank(b)
                        }
                        aria-label={`Editar conta ${b.nome}`}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => onAdjustBankBalance(b.id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        Ajustar Saldo
                      </button>
                      <button
                        onClick={() => onDeleteBank(b.id)}
                        aria-label={`Remover conta ${b.nome}`}
                        className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {editingBankId === b.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveBank(b);
                    }}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div>
                        <label
                          htmlFor={`edit-bank-name-${b.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Nome da Conta
                        </label>
                        <input
                          id={`edit-bank-name-${b.id}`}
                          type="text"
                          value={editBankName}
                          onChange={(e) => {
                            setEditBankName(e.target.value);
                            if (editBankError) setEditBankError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-bank-type-${b.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Tipo
                        </label>
                        <select
                          id={`edit-bank-type-${b.id}`}
                          value={editBankType}
                          onChange={(e) => setEditBankType(e.target.value as BankAccount['tipo'])}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="Conta Digital">Conta Digital</option>
                          <option value="Conta Corrente">Conta Corrente</option>
                          <option value="Investimento">Investimento</option>
                          <option value="Dinheiro Físico">Dinheiro Físico</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-bank-cdi-${b.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          % do CDI
                        </label>
                        <input
                          id={`edit-bank-cdi-${b.id}`}
                          type="number"
                          step="1"
                          min="0"
                          disabled={!editBankRende}
                          value={editBankRende ? editBankPctCdi : '0'}
                          onChange={(e) => {
                            setEditBankPctCdi(e.target.value);
                            if (editBankError) setEditBankError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white disabled:opacity-50"
                        />
                      </div>

                      <div className="flex items-center min-h-[38px]">
                        <label
                          htmlFor={`edit-bank-rende-${b.id}`}
                          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <input
                            id={`edit-bank-rende-${b.id}`}
                            type="checkbox"
                            checked={editBankRende}
                            onChange={(e) => setEditBankRende(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                          />
                          <span>Rende juros (CDI)</span>
                        </label>
                      </div>
                    </div>

                    {editBankError && (
                      <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        {editBankError}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingBankId(null)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface GoalsViewProps {
  state: AppState;
  onOpenNewGoal: () => void;
  onOpenFireModal: () => void;
  onOpenAporteModal: (caixinhaId: string) => void;
  onOpenWithdrawModal: (caixinhaId: string) => void;
  onDeleteGoal: (caixinhaId: string) => void;
  onUpdateFireParams: (swrPct: number, realReturnPct: number) => void;
  onUpdateGoal?: (goal: Caixinha) => void;
}

export const GoalsTab: React.FC<GoalsViewProps> = ({
  state,
  onOpenNewGoal,
  onOpenFireModal,
  onOpenAporteModal,
  onOpenWithdrawModal,
  onDeleteGoal,
  onUpdateFireParams,
  onUpdateGoal,
}) => {
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalName, setEditGoalName] = useState('');
  const [editGoalMeta, setEditGoalMeta] = useState('');
  const [editGoalAporte, setEditGoalAporte] = useState('');
  const [editGoalPctCdi, setEditGoalPctCdi] = useState('100');
  const [editGoalInstituicao, setEditGoalInstituicao] = useState('');
  const [editGoalError, setEditGoalError] = useState<string | null>(null);

  const startEditGoal = (cx: Caixinha) => {
    setEditingGoalId(cx.id);
    setEditGoalName(cx.nome);
    setEditGoalMeta(String(cx.meta ?? 0));
    setEditGoalAporte(String(cx.aporteMensal ?? 0));
    setEditGoalPctCdi(String(cx.pctCDI ?? 100));
    setEditGoalInstituicao(cx.instituicao || '');
    setEditGoalError(null);
  };

  const handleSaveGoal = (cx: Caixinha) => {
    const nome = editGoalName.trim();
    const meta = parseFloat(editGoalMeta);
    const aporteMensal = parseFloat(editGoalAporte);
    const pctCDI = parseFloat(editGoalPctCdi);
    const instituicao = editGoalInstituicao.trim();

    if (!nome) {
      setEditGoalError('Informe o nome da caixinha.');
      return;
    }
    if (!Number.isFinite(meta) || meta < 0) {
      setEditGoalError('Informe uma meta válida (>= 0).');
      return;
    }
    if (!Number.isFinite(aporteMensal) || aporteMensal < 0) {
      setEditGoalError('Informe um aporte mensal válido (>= 0).');
      return;
    }
    if (!Number.isFinite(pctCDI) || pctCDI < 0) {
      setEditGoalError('Informe um % do CDI válido (>= 0).');
      return;
    }

    onUpdateGoal?.({
      ...cx,
      nome,
      meta,
      aporteMensal,
      pctCDI,
      instituicao: instituicao || cx.instituicao,
    });
    setEditingGoalId(null);
    setEditGoalError(null);
  };
  const despesasMes = state.despesasPorMes[state.competenciaAtual] || [];
  const totalAportes = sumMoney(state.caixinhas.map((c) => c.aporteMensal || 0));
  const budget = calculateBudget503020(state.salario.liquido, despesasMes, totalAportes);
  const custoEssencial =
    budget.essentialsTotal > 0
      ? budget.essentialsTotal
      : sumMoney(despesasMes.map((d) => d.valor || 0));

  const caixinhasFire = state.caixinhas.filter((c) => c.tipo === 'aposentadoria');
  const cxFire = caixinhasFire[0];
  const saldoFireTotal = sumMoney(caixinhasFire.map((c) => c.saldo || 0));
  const aporteFireTotal = sumMoney(caixinhasFire.map((c) => c.aporteMensal || 0));
  const swrPct = state.configuracoes.swrAnualPct ?? 4.0;
  const realReturnPct = state.configuracoes.jurosReaisAnualPct ?? 5.0;

  const fireMath = calculateFireProjection(
    saldoFireTotal,
    aporteFireTotal,
    custoEssencial,
    swrPct,
    realReturnPct
  );

  const cdiAnual = state.configuracoes.taxaCdiAnual ?? 10.75;
  const monthlyNetCdiRate = annualToMonthlyRate(cdiAnual) * 0.825;
  const caixinhasComuns = state.caixinhas.filter((c) => c.tipo !== 'aposentadoria');

  return (
    <div className="space-y-6">
      {/* SUPER-CAIXINHA FIRE (INDEPENDÊNCIA FINANCEIRA) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span>Acumulação Perpétua (Estratégia FIRE)</span>
              <span aria-hidden="true">·</span>
              <span>Custódia: {cxFire?.instituicao || 'Tesouro IPCA+ / Corretora'}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {cxFire ? cxFire.nome : 'Independência Financeira & Aposentadoria (FIRE)'}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {cxFire && (
              <>
                <button
                  onClick={() => onOpenAporteModal(cxFire.id)}
                  className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  + Realizar Aporte
                </button>
                <button
                  onClick={() => onOpenWithdrawModal(cxFire.id)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Resgatar
                </button>
              </>
            )}
            <button
              onClick={onOpenFireModal}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Configurar Plano FIRE
            </button>
          </div>
        </div>

        {/* Parâmetros SWR e Juros Reais Ajustáveis */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Premissas Matemáticas:</span>
          <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span>Taxa Segura de Retirada (SWR):</span>
            <select
              value={swrPct}
              onChange={(e) => onUpdateFireParams(parseFloat(e.target.value), realReturnPct)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 font-mono font-semibold text-slate-900 dark:text-white"
            >
              <option value="3.5">3,5% a.a. (Conservadora)</option>
              <option value="4">4,0% a.a. (Regra dos 4% Trinity)</option>
              <option value="4.5">4,5% a.a. (Moderada Brasil)</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span>Juros Reais Acima da Inflação:</span>
            <select
              value={realReturnPct}
              onChange={(e) => onUpdateFireParams(swrPct, parseFloat(e.target.value))}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 font-mono font-semibold text-slate-900 dark:text-white"
            >
              <option value="4">4,0% a.a. real</option>
              <option value="5">5,0% a.a. real (IPCA+5%)</option>
              <option value="6">6,0% a.a. real (IPCA+6%)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Saldo Acumulado FIRE</span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(saldoFireTotal)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block font-mono tabular-nums privacy-val">
              Aporte atual: {fmtBRL(aporteFireTotal)}/mês
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Patrimônio Alvo FIRE</span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(fireMath.targetPatrimony)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block font-mono tabular-nums privacy-val">
              Para cobrir {fmtBRL(custoEssencial)}/mês essenciais
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tempo até a Liberdade</span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-sky-700 dark:text-sky-400">
              {fireMath.yearsToFire !== null ? `${fireMath.yearsToFire} anos` : '--'}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
              {fireMath.yearsSavedWithExtra100 > 0
                ? `+R$ 100/mês antecipa em ${fireMath.yearsSavedWithExtra100} anos`
                : 'Com capitalização real composta'}
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Renda Passiva Hoje</span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(fireMath.currentSafeMonthlyIncome)}/mês
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
              Sem nunca esgotar o principal
            </span>
          </div>
        </div>
      </div>

      {/* CAIXINHAS DE EMERGÊNCIA & METAS DE CURTO/MÉDIO PRAZO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Caixinhas de Reserva de Emergência & Metas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Compare o tempo linear (sem juros) com o tempo real acelerado pelos juros compostos do CDI.
            </p>
          </div>
          <button
            onClick={onOpenNewGoal}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Caixinha / Meta</span>
          </button>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
          {caixinhasComuns.map((cx) => {
            const pct = cx.meta > 0 ? Math.max(0, Math.min(100, Math.round((cx.saldo / cx.meta) * 100))) : 0;
            const cxMonthlyRate = monthlyNetCdiRate * ((cx.pctCDI ?? 100) / 100);
            const math = calculateGoalMonthsCompound(
              cx.saldo,
              cx.meta,
              cx.aporteMensal,
              cxMonthlyRate
            );

            return (
              <div key={cx.id} className="py-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{cx.nome}</span>
                      <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">{cx.instituicao}</span>
                      <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 font-mono tabular-nums privacy-val">
                        Aporte: {fmtBRL(cx.aporteMensal)}/mês
                      </span>
                    </div>

                    {cx.meta > 0 && (
                      <div className="max-w-md space-y-1">
                        <div
                          className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                          role="progressbar"
                          aria-label={`Progresso de ${cx.nome}`}
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums privacy-val gap-2 flex-wrap">
                          <span>
                            {pct}% da meta ({fmtBRL(cx.meta)})
                          </span>
                          {cx.saldo < cx.meta && Number.isFinite(math.monthsCompound) && (
                            <span>
                              Com CDI: <strong>{math.monthsCompound} meses</strong> (
                              {Number.isFinite(math.monthsLinear)
                                ? `Sem juros: ${math.monthsLinear}m`
                                : 'Sem prazo (aporte R$ 0)'}{' '}
                              · Juros ganhos: +{fmtBRL(math.totalInterestEarned)})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                    <span className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white privacy-val">
                      {fmtBRL(cx.saldo)}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          editingGoalId === cx.id ? setEditingGoalId(null) : startEditGoal(cx)
                        }
                        aria-label={`Editar caixinha ${cx.nome}`}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => onOpenAporteModal(cx.id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        Aportar
                      </button>
                      <button
                        onClick={() => onOpenWithdrawModal(cx.id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        Resgatar
                      </button>
                      <button
                        onClick={() => onDeleteGoal(cx.id)}
                        aria-label={`Remover meta ${cx.nome}`}
                        className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {editingGoalId === cx.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveGoal(cx);
                    }}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                      <div>
                        <label
                          htmlFor={`edit-goal-name-${cx.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Nome da Caixinha
                        </label>
                        <input
                          id={`edit-goal-name-${cx.id}`}
                          type="text"
                          value={editGoalName}
                          onChange={(e) => {
                            setEditGoalName(e.target.value);
                            if (editGoalError) setEditGoalError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-goal-meta-${cx.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Meta (R$)
                        </label>
                        <input
                          id={`edit-goal-meta-${cx.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={editGoalMeta}
                          onChange={(e) => {
                            setEditGoalMeta(e.target.value);
                            if (editGoalError) setEditGoalError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white privacy-val"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-goal-aporte-${cx.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Aporte Mensal (R$)
                        </label>
                        <input
                          id={`edit-goal-aporte-${cx.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={editGoalAporte}
                          onChange={(e) => {
                            setEditGoalAporte(e.target.value);
                            if (editGoalError) setEditGoalError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white privacy-val"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-goal-cdi-${cx.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          % do CDI
                        </label>
                        <input
                          id={`edit-goal-cdi-${cx.id}`}
                          type="number"
                          step="1"
                          min="0"
                          value={editGoalPctCdi}
                          onChange={(e) => {
                            setEditGoalPctCdi(e.target.value);
                            if (editGoalError) setEditGoalError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-goal-inst-${cx.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Instituição
                        </label>
                        <input
                          id={`edit-goal-inst-${cx.id}`}
                          type="text"
                          value={editGoalInstituicao}
                          onChange={(e) => {
                            setEditGoalInstituicao(e.target.value);
                            if (editGoalError) setEditGoalError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {editGoalError && (
                      <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        {editGoalError}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingGoalId(null)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
