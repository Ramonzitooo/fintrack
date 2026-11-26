import React, { useState } from 'react';
import { AppState, fmtBRL } from '../utils/storage';
import {
  addMoney,
  BankAccount,
  Caixinha,
  annualToMonthlyRate,
  calculateBudget503020,
  calculateCdiMonthlyYield,
  calculateFireProjection,
  calculateGoalMonthsCompound,
  generateFireWealthCurve,
  subMoney,
  sumMoney,
} from '../utils/financeMath';
import {
  AlertTriangle,
  ArrowLeftRight,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  TrendingUp,
  Trash2,
} from 'lucide-react';

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
      setEditBankError(
        'Não foi possível salvar a conta. O nome da instituição está em branco. Informe um nome identificador (ex: Nubank, Itaú) e tente novamente.'
      );
      return;
    }
    const parsedPct = editBankRende ? parseFloat(editBankPctCdi) : 0;
    if (editBankRende && (!Number.isFinite(parsedPct) || parsedPct < 0)) {
      setEditBankError(
        'Não foi possível salvar a conta. O percentual do CDI informado é inválido ou negativo. Digite um número igual ou maior que zero (ex: 100 para 100% do CDI).'
      );
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
      totalRendendo = addMoney(totalRendendo, b.saldo);
      const y = calculateCdiMonthlyYield(b.saldo, b.pctCDI ?? 100, cdiAnual, 17.5);
      rendimentoBrutoMes = addMoney(rendimentoBrutoMes, y.grossMonthly);
      rendimentoLiquidoMes = addMoney(rendimentoLiquidoMes, y.netMonthly);
    } else {
      totalParado = addMoney(totalParado, b.saldo);
    }
  });

  const pctRendendo =
    totalBancos > 0
      ? Math.max(0, Math.min(100, Math.round((totalRendendo / totalBancos) * 100)))
      : 0;

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
            <label
              htmlFor="banks-cdi-anual-input"
              className="min-h-[44px] flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs"
            >
              <span className="text-slate-600 dark:text-slate-400 font-medium">CDI Anual:</span>
              <input
                id="banks-cdi-anual-input"
                type="number"
                step="0.25"
                value={cdiAnual}
                onChange={(e) => onUpdateCdiRate(parseFloat(e.target.value) || 0)}
                aria-label="Taxa CDI Anual (%)"
                className="w-16 font-mono tabular-nums font-semibold text-right bg-transparent text-slate-900 dark:text-white rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
              <span className="text-slate-600 dark:text-slate-400">% a.a.</span>
            </label>
            <button
              type="button"
              onClick={onOpenPixTransfer}
              disabled={state.bancos.length < 2}
              title={
                state.bancos.length < 2
                  ? 'Cadastre ao menos 2 contas para transferir saldos entre instituições'
                  : undefined
              }
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Transferir via Pix</span>
            </button>
            <button
              type="button"
              onClick={onOpenNewBank}
              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Cadastrar Conta</span>
            </button>
          </div>
        </div>

        {/* KPIs de Liquidez */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Total Geral em Contas
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(totalBancos)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block tabular-nums">
              Soma de {state.bancos.length}{' '}
              {state.bancos.length === 1 ? 'instituição' : 'instituições'}
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Dinheiro Rendendo (CDI)
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(totalRendendo)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block tabular-nums">
              {pctRendendo}% do saldo bancário ativo
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Dinheiro Parado (0%)
            </span>
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

        {/* Lista de Contas ou Empty State Construtivo */}
        {state.bancos.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center flex flex-col items-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Landmark className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1 max-w-md">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nenhuma conta bancária cadastrada
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Adicione suas contas correntes, contas digitais remuneradas, corretoras ou dinheiro em espécie para apurar seu Saldo Livre Real e projetar seus rendimentos mensais no CDI.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewBank}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Cadastrar Primeira Conta</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {state.bancos.map((b) => {
              const fatia =
                totalBancos > 0
                  ? Math.max(0, Math.min(100, Math.round((b.saldo / totalBancos) * 100)))
                  : 0;
              const yieldInfo = b.rendeJuros
                ? calculateCdiMonthlyYield(b.saldo, b.pctCDI ?? 100, cdiAnual, 17.5)
                : { grossMonthly: 0, netMonthly: 0 };

              return (
                <div key={b.id} className="py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {b.nome}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{b.tipo}</span>
                        <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            b.rendeJuros
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {b.rendeJuros
                            ? `Rende ${b.pctCDI ?? 100}% do CDI`
                            : '0% CDI (Saldo Estático)'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Participação: <strong className="tabular-nums">{fatia}%</strong> ·{' '}
                        {b.rendeJuros ? (
                          <span className="font-mono tabular-nums privacy-val">
                            Rendimento líquido estimado: + {fmtBRL(yieldInfo.netMonthly)}/mês
                            (Bruto: + {fmtBRL(yieldInfo.grossMonthly)})
                          </span>
                        ) : (
                          'Disponível para giro imediato ou espécie'
                        )}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 flex-wrap">
                      <span
                        className={`font-mono tabular-nums text-lg font-bold privacy-val ${
                          b.saldo < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {fmtBRL(b.saldo)}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            editingBankId === b.id ? setEditingBankId(null) : startEditBank(b)
                          }
                          aria-label={`Editar conta ${b.nome}`}
                          className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Editar Conta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdjustBankBalance(b.id)}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          Ajustar Saldo
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteBank(b.id)}
                          aria-label={`Remover conta ${b.nome}`}
                          className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
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
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-bank-type-${b.id}`}
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                          >
                            Modalidade
                          </label>
                          <select
                            id={`edit-bank-type-${b.id}`}
                            value={editBankType}
                            onChange={(e) => setEditBankType(e.target.value as BankAccount['tipo'])}
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
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
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white disabled:opacity-50"
                          />
                        </div>

                        <div className="flex items-center min-h-[44px]">
                          <label
                            htmlFor={`edit-bank-rende-${b.id}`}
                            className="min-h-[44px] inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
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
                        <div
                          role="alert"
                          className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2"
                        >
                          <AlertTriangle
                            className="w-4 h-4 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{editBankError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingBankId(null)}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Cancelar Edição
                        </button>
                        <button
                          type="submit"
                          className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                        >
                          Salvar Conta
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
      setEditGoalError(
        'Não foi possível salvar a caixinha. O título da meta está em branco. Informe um nome objetivo (ex: Reserva de Emergência) e tente novamente.'
      );
      return;
    }
    if (!Number.isFinite(meta) || meta < 0) {
      setEditGoalError(
        'Não foi possível salvar a caixinha. O valor da meta financeira é inválido ou negativo. Informe um valor igual ou maior que R$ 0,00.'
      );
      return;
    }
    if (!Number.isFinite(aporteMensal) || aporteMensal < 0) {
      setEditGoalError(
        'Não foi possível salvar a caixinha. O valor do aporte mensal é inválido ou negativo. Informe um aporte mensal igual ou maior que R$ 0,00.'
      );
      return;
    }
    if (!Number.isFinite(pctCDI) || pctCDI < 0) {
      setEditGoalError(
        'Não foi possível salvar a caixinha. O percentual do CDI informado é inválido ou negativo. Digite um percentual válido (ex: 100 para 100% do CDI).'
      );
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

  // Curva de Evolução Patrimonial FIRE de 20 Anos
  const fireCurvePoints = generateFireWealthCurve({
    currentPatrimony: saldoFireTotal,
    monthlyContribution: aporteFireTotal,
    annualRealRatePct: realReturnPct,
    years: 20,
  });
  const pointYear20 = fireCurvePoints[fireCurvePoints.length - 1] ?? {
    year: 20,
    totalInvested: saldoFireTotal,
    totalCompound: saldoFireTotal,
  };
  const jurosReaisGanhos20a = Math.max(
    0,
    subMoney(pointYear20.totalCompound, pointYear20.totalInvested)
  );

  // Geometria SVG Responsiva para a Curva FIRE
  const svgW = 720;
  const svgH = 250;
  const padLeft = 20;
  const padRight = 20;
  const padTop = 22;
  const padBottom = 34;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;
  const rawMaxY = Math.max(
    pointYear20.totalCompound,
    fireMath.targetPatrimony,
    saldoFireTotal,
    1000
  );
  const maxChartY = rawMaxY * 1.08;

  const toChartX = (year: number) => padLeft + (year / 20) * plotW;
  const toChartY = (val: number) =>
    padTop + plotH - (Math.max(0, Math.min(val, maxChartY)) / maxChartY) * plotH;

  const compoundLinePath = fireCurvePoints
    .map(
      (pt, i) =>
        `${i === 0 ? 'M' : 'L'} ${toChartX(pt.year).toFixed(1)} ${toChartY(
          pt.totalCompound
        ).toFixed(1)}`
    )
    .join(' ');
  const compoundAreaPath = `${compoundLinePath} L ${toChartX(20).toFixed(1)} ${(
    padTop + plotH
  ).toFixed(1)} L ${toChartX(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  const investedLinePath = fireCurvePoints
    .map(
      (pt, i) =>
        `${i === 0 ? 'M' : 'L'} ${toChartX(pt.year).toFixed(1)} ${toChartY(
          pt.totalInvested
        ).toFixed(1)}`
    )
    .join(' ');

  const targetLineY =
    fireMath.targetPatrimony > 0 ? toChartY(fireMath.targetPatrimony) : null;

  const fireChartAriaLabel = `Gráfico de evolução patrimonial FIRE em 20 anos com juros reais de ${realReturnPct}% ao ano. Compara a curva com juros compostos versus apenas os aportes saídos do bolso e a linha da meta patrimonial FIRE.`;

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
                  type="button"
                  onClick={() => onOpenAporteModal(cxFire.id)}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Fazer Aporte</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenWithdrawModal(cxFire.id)}
                  className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Resgatar Saldo
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onOpenFireModal}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Configurar Plano FIRE
            </button>
          </div>
        </div>

        {/* Parâmetros SWR e Juros Reais Ajustáveis */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-lg p-3 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Premissas Matemáticas:
          </span>
          <label
            htmlFor="fire-swr-select"
            className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
          >
            <span>Taxa Segura de Retirada (SWR):</span>
            <select
              id="fire-swr-select"
              value={swrPct}
              onChange={(e) => onUpdateFireParams(parseFloat(e.target.value), realReturnPct)}
              className="min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-white"
            >
              <option value="3.5">3,5% a.a. (Conservadora)</option>
              <option value="4">4,0% a.a. (Regra dos 4% Trinity)</option>
              <option value="4.5">4,5% a.a. (Moderada Brasil)</option>
            </select>
          </label>
          <label
            htmlFor="fire-real-return-select"
            className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
          >
            <span>Juros Reais Acima da Inflação:</span>
            <select
              id="fire-real-return-select"
              value={realReturnPct}
              onChange={(e) => onUpdateFireParams(swrPct, parseFloat(e.target.value))}
              className="min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-mono tabular-nums font-semibold text-slate-900 dark:text-white"
            >
              <option value="4">4,0% a.a. real</option>
              <option value="5">5,0% a.a. real (IPCA+5%)</option>
              <option value="6">6,0% a.a. real (IPCA+6%)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Saldo Acumulado FIRE
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(saldoFireTotal)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block font-mono tabular-nums privacy-val">
              Aporte atual: {fmtBRL(aporteFireTotal)}/mês
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Patrimônio Alvo FIRE
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(fireMath.targetPatrimony)}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block font-mono tabular-nums privacy-val">
              Para cobrir {fmtBRL(custoEssencial)}/mês essenciais
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Tempo até a Liberdade
            </span>
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
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Renda Passiva Hoje
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(fireMath.currentSafeMonthlyIncome)}/mês
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 block">
              Sem nunca esgotar o principal
            </span>
          </div>
        </div>

        {/* GRÁFICO SVG DE CURVA DE EVOLUÇÃO PATRIMONIAL & FIRE (20 ANOS) */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                <TrendingUp
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <span>Curva de Evolução Patrimonial & Meta FIRE (Horizonte de 20 Anos)</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Efeito exponencial dos juros reais compostos ({realReturnPct}% a.a. acima da inflação) frente ao esforço linear de aportes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400 inline-block"
                  aria-hidden="true"
                />
                <span>Com Juros Compostos</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-3 h-0.5 border-t-2 border-dashed border-slate-500 dark:border-slate-400 inline-block"
                  aria-hidden="true"
                />
                <span>Apenas Aportes do Bolso</span>
              </span>
              {fireMath.targetPatrimony > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-3 h-0.5 border-t-2 border-dashed border-sky-600 dark:border-sky-400 inline-block"
                    aria-hidden="true"
                  />
                  <span>Meta FIRE</span>
                </span>
              )}
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2 sm:p-3">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              role="img"
              aria-label={fireChartAriaLabel}
              className="w-full h-auto"
            >
              <defs>
                <linearGradient id="fireCompoundAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Linhas horizontais de referência */}
              {[0, 0.33, 0.66, 1].map((ratio) => {
                const y = padTop + plotH - ratio * plotH;
                return (
                  <line
                    key={ratio}
                    x1={padLeft}
                    y1={y}
                    x2={svgW - padRight}
                    y2={y}
                    strokeWidth="1"
                    className="stroke-slate-100 dark:stroke-slate-800"
                  />
                );
              })}

              {/* Linha horizontal da Meta FIRE */}
              {targetLineY !== null && (
                <g>
                  <line
                    x1={padLeft}
                    y1={targetLineY}
                    x2={svgW - padRight}
                    y2={targetLineY}
                    stroke="#0284c7"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                  <text
                    x={svgW - padRight - 4}
                    y={Math.max(14, targetLineY - 6)}
                    textAnchor="end"
                    className="fill-sky-700 dark:fill-sky-400 text-[11px] font-bold"
                  >
                    Meta FIRE
                  </text>
                </g>
              )}

              {/* Área e Linha Com Juros Compostos */}
              <path d={compoundAreaPath} fill="url(#fireCompoundAreaGrad)" />
              <path
                d={investedLinePath}
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <path
                d={compoundLinePath}
                fill="none"
                stroke="#059669"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Marcadores em Ano 0, 5, 10, 15, 20 */}
              {[0, 5, 10, 15, 20].map((yr) => {
                const pt = fireCurvePoints[yr];
                if (!pt) return null;
                const cx = toChartX(yr);
                const cy = toChartY(pt.totalCompound);
                return (
                  <g key={yr}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="4"
                      fill="#059669"
                      className="stroke-white dark:stroke-slate-900"
                      strokeWidth="1.5"
                    />
                    <text
                      x={cx}
                      y={svgH - 10}
                      textAnchor={yr === 0 ? 'start' : yr === 20 ? 'end' : 'middle'}
                      className="fill-slate-500 dark:fill-slate-400 text-[11px] font-medium tabular-nums"
                    >
                      {yr === 0 ? 'Hoje' : `${yr} anos`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Cards Resumo do Rodapé da Curva FIRE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Apenas Aportes do Bolso (20 anos)
              </span>
              <span className="font-mono tabular-nums text-base font-bold text-slate-800 dark:text-slate-200 privacy-val mt-0.5 block">
                {fmtBRL(pointYear20.totalInvested)}
              </span>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 p-3.5">
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                Projeção com Juros Compostos (20 anos)
              </span>
              <span className="font-mono tabular-nums text-base font-extrabold text-emerald-700 dark:text-emerald-400 privacy-val mt-0.5 block">
                {fmtBRL(pointYear20.totalCompound)}
              </span>
            </div>

            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Multiplicação Exclusiva dos Juros
              </span>
              <span className="font-mono tabular-nums text-base font-bold text-sky-700 dark:text-sky-400 privacy-val mt-0.5 block">
                + {fmtBRL(jurosReaisGanhos20a)}
              </span>
            </div>
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
            type="button"
            onClick={onOpenNewGoal}
            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Criar Nova Caixinha</span>
          </button>
        </div>

        {caixinhasComuns.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center flex flex-col items-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <PiggyBank className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {state.caixinhas.length === 0
                  ? 'Nenhuma caixinha ou reserva cadastrada'
                  : 'Nenhuma caixinha de emergência ou curto prazo criada'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Separe sua Reserva de Emergência (idealmente 6 meses de gastos essenciais) e objetivos específicos para acompanhar o ganho real de tempo gerado pelo CDI.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewGoal}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Criar Primeira Caixinha</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {caixinhasComuns.map((cx) => {
              const pct =
                cx.meta > 0
                  ? Math.max(0, Math.min(100, Math.round((cx.saldo / cx.meta) * 100)))
                  : 0;
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
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {cx.nome}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {cx.instituicao}
                        </span>
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

                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 flex-wrap">
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
                          <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Editar Meta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenAporteModal(cx.id)}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          Fazer Aporte
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenWithdrawModal(cx.id)}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          Resgatar Saldo
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteGoal(cx.id)}
                          aria-label={`Remover meta ${cx.nome}`}
                          className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
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
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
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
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white privacy-val"
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
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white privacy-val"
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
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
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
                            className="w-full min-h-[44px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {editGoalError && (
                        <div
                          role="alert"
                          className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2"
                        >
                          <AlertTriangle
                            className="w-4 h-4 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{editGoalError}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingGoalId(null)}
                          className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Cancelar Edição
                        </button>
                        <button
                          type="submit"
                          className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                        >
                          Salvar Caixinha
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
