import React, { useState } from 'react';
import { AppState, fmtBRL, formatMonthYear } from '../utils/storage';
import {
  DebtItem,
  ExpenseItem,
  ExtraIncomeItem,
  isEssentialCategory,
  simulateDebtPayoff,
  subMoney,
  sumMoney,
  sumMonthlyExtraIncome,
} from '../utils/financeMath';
import {
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Search,
  Pencil,
} from 'lucide-react';

const EXPENSE_CATEGORIES: ExpenseItem['categoria'][] = [
  'Moradia',
  'Conectividade',
  'Utilidades',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Assinaturas',
  'Lazer',
  'Imprevisto',
  'Educação',
  'Impostos',
  'Outros',
];

const EXTRA_INCOME_CATEGORIES = [
  'Freelance',
  'Bônus / Comissão',
  'Reembolso',
  'Venda',
  'Rendimentos',
  'Outros',
];

interface ExpensesTabProps {
  state: AppState;
  onChangeMonth: (delta: number) => void;
  onGoToCurrentMonth: () => void;
  onOpenNewExpenseModal: () => void;
  onOpenTemplateModal: () => void;
  onOpenPayExpenseModal: (expenseId: string) => void;
  onRefundExpense: (expenseId: string) => void;
  onEditExpenseAmount: (expenseId: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  onSyncTemplateToMonth: () => void;
  onRequestEditEnvelope?: (
    key: 'supermercado' | 'lazer' | 'combustivel',
    title: string,
    currentTotal: number
  ) => void;
  onUpdateEnvelope: (
    key: 'supermercado' | 'lazer' | 'combustivel',
    total: number,
    cadencia: 'semanal' | 'quinzenal' | 'mensal' | 'fds'
  ) => void;
  onAddDebt: (debt: Omit<DebtItem, 'id'>) => void;
  onDeleteDebt: (id: string) => void;
  onUpdateExpense?: (expense: ExpenseItem) => void;
  onAddExtraIncome?: (item: Omit<ExtraIncomeItem, 'id'>) => void;
  onToggleExtraIncome?: (id: string) => void;
  onDeleteExtraIncome?: (id: string) => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  state,
  onChangeMonth,
  onGoToCurrentMonth,
  onOpenNewExpenseModal,
  onOpenTemplateModal,
  onOpenPayExpenseModal,
  onRefundExpense,
  onEditExpenseAmount,
  onDeleteExpense,
  onSyncTemplateToMonth,
  onRequestEditEnvelope,
  onUpdateEnvelope,
  onAddDebt,
  onDeleteDebt,
  onUpdateExpense,
  onAddExtraIncome,
  onToggleExtraIncome,
  onDeleteExtraIncome,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debtStrategy, setDebtStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraDebtBudget, setExtraDebtBudget] = useState<number>(200);
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtBalance, setNewDebtBalance] = useState('');
  const [newDebtRate, setNewDebtRate] = useState('');
  const [newDebtMin, setNewDebtMin] = useState('');
  const [debtFormError, setDebtFormError] = useState<string | null>(null);

  // Estado de edição inline de despesa
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpDesc, setEditExpDesc] = useState('');
  const [editExpCat, setEditExpCat] = useState<ExpenseItem['categoria']>('Outros');
  const [editExpNatureza, setEditExpNatureza] = useState<'essencial' | 'estilo_vida'>('essencial');
  const [editExpError, setEditExpError] = useState<string | null>(null);

  // Estado de Receitas Extras do Mês
  const [extraDesc, setExtraDesc] = useState('');
  const [extraVal, setExtraVal] = useState('');
  const [extraCat, setExtraCat] = useState('Freelance');
  const [extraRecebida, setExtraRecebida] = useState(true);
  const [extraFormError, setExtraFormError] = useState<string | null>(null);

  const comp = state.competenciaAtual;
  const despesasMes = state.despesasPorMes[comp] || [];
  const receitasMes = state.receitasPorMes?.[comp] || [];
  const totalReceitasExtras = sumMonthlyExtraIncome(receitasMes, false);
  const totalReceitasRecebidas = sumMonthlyExtraIncome(receitasMes, true);

  const startEditExpense = (d: ExpenseItem) => {
    setEditingExpenseId(d.id);
    setEditExpDesc(d.descricao);
    setEditExpCat(d.categoria);
    setEditExpNatureza(
      d.natureza ?? (isEssentialCategory(d.categoria) ? 'essencial' : 'estilo_vida')
    );
    setEditExpError(null);
  };

  const handleSaveExpense = (d: ExpenseItem) => {
    const trimmed = editExpDesc.trim();
    if (!trimmed) {
      setEditExpError('Informe a descrição da despesa.');
      return;
    }
    onUpdateExpense?.({
      ...d,
      descricao: trimmed,
      categoria: editExpCat,
      natureza: editExpNatureza,
    });
    setEditingExpenseId(null);
    setEditExpError(null);
  };

  const totalPrevisto = sumMoney(despesasMes.map((d) => d.valor || 0));
  const totalPago = sumMoney(despesasMes.filter((d) => d.paga).map((d) => d.valor || 0));
  const totalPendente = sumMoney(despesasMes.filter((d) => !d.paga).map((d) => d.valor || 0));
  const pctQuitado = totalPrevisto > 0 ? Math.max(0, Math.min(100, Math.round((totalPago / totalPrevisto) * 100))) : 0;

  // Gastos reais por categoria para cruzar com os Envelopes de Rotina!
  const gastoAlimentacao = sumMoney(
    despesasMes.filter((d) => d.categoria === 'Alimentação').map((d) => d.valor || 0)
  );
  const gastoLazer = sumMoney(
    despesasMes.filter((d) => d.categoria === 'Lazer' || d.categoria === 'Assinaturas').map((d) => d.valor || 0)
  );
  const gastoTransporte = sumMoney(
    despesasMes.filter((d) => d.categoria === 'Transporte').map((d) => d.valor || 0)
  );

  const envSuper = state.envelopes.supermercado;
  const envLazer = state.envelopes.lazer;
  const envComb = state.envelopes.combustivel;

  const divisorCadencia = (c: string) => (c === 'semanal' || c === 'fds' ? 4 : c === 'quinzenal' ? 2 : 1);

  const filteredExpenses = despesasMes.filter((d) => {
    if (statusFilter === 'pending' && d.paga) return false;
    if (statusFilter === 'paid' && !d.paga) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return d.descricao.toLowerCase().includes(q) || d.categoria.toLowerCase().includes(q);
    }
    return true;
  });

  // Ordenação e Simulação do Planejador de Dívidas (Avalanche = maior taxa de juros primeiro; Bola de Neve = menor saldo primeiro)
  const sortedDebts = [...(state.dividas || [])].sort((a, b) =>
    debtStrategy === 'avalanche' ? b.taxaJurosMensal - a.taxaJurosMensal : a.saldoDevedor - b.saldoDevedor
  );
  const avalancheSim = simulateDebtPayoff(state.dividas || [], extraDebtBudget, 'avalanche');
  const snowballSim = simulateDebtPayoff(state.dividas || [], extraDebtBudget, 'snowball');
  const activeSim = simulateDebtPayoff(state.dividas || [], extraDebtBudget, debtStrategy);
  const interestDiff = subMoney(snowballSim.totalInterestPaid, avalancheSim.totalInterestPaid);
  const interestSavings = Math.abs(interestDiff);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        {/* Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Despesas do Mês & Envelopes de Rotina
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Contas fixas são clonadas automaticamente a cada virada de mês. Dê baixa com 1 clique conforme pagar.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenTemplateModal}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Molde de Contas Fixas</span>
            </button>
            <button
              onClick={onOpenNewExpenseModal}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Gasto Avulso</span>
            </button>
          </div>
        </div>

        {/* Navegador de Competência */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangeMonth(-1)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Mês Anterior</span>
            </button>
            <button
              onClick={onGoToCurrentMonth}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Mês Atual
            </button>
            <button
              onClick={() => onChangeMonth(1)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Próximo Mês</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Competência Ativa:</span>
            <strong
              id="displayCompetenciaAtiva"
              className="text-sm font-bold text-emerald-700 dark:text-emerald-400"
            >
              {formatMonthYear(comp)}
            </strong>
          </div>
        </div>

        {/* KPIs de Quitação */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Previsto no Mês</span>
            <div className="mt-1 font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(totalPrevisto)}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{despesasMes.length} lançamentos nesta competência</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Já Quitado (Pago)</span>
            <div className="mt-1 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(totalPago)}
            </div>
            <div
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-1.5"
              role="progressbar"
              aria-label="Percentual quitado das despesas do mês"
              aria-valuenow={pctQuitado}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${pctQuitado}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{pctQuitado}% do total pago</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Falta Pagar (Pendente)</span>
            <div className="mt-1 font-mono tabular-nums text-xl font-bold text-rose-600 dark:text-rose-400 privacy-val">
              {fmtBRL(totalPendente)}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Reservado do Saldo Livre Real</span>
          </div>
        </div>

        {/* ENVELOPES SEMANAIS CONECTADOS AOS GASTOS REAIS */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Fatiador de Envelopes de Rotina (Conectado aos Gastos Reais do Mês)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cruza automaticamente seus tetos mensais de Supermercado, Lazer e Transporte com o que já foi lançado neste mês.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                key: 'supermercado' as const,
                title: 'Supermercado & Alimentação',
                config: envSuper,
                spent: gastoAlimentacao,
                options: [
                  { id: 'semanal', label: 'Semanal (4x)' },
                  { id: 'quinzenal', label: 'Quinzenal (2x)' },
                  { id: 'mensal', label: 'Mensal (1x)' },
                ],
              },
              {
                key: 'lazer' as const,
                title: 'Lazer & Assinaturas',
                config: envLazer,
                spent: gastoLazer,
                options: [
                  { id: 'fds', label: 'Fim de Semana (4x)' },
                  { id: 'quinzenal', label: 'Quinzenal (2x)' },
                ],
              },
              {
                key: 'combustivel' as const,
                title: 'Combustível & Transporte',
                config: envComb,
                spent: gastoTransporte,
                options: [
                  { id: 'semanal', label: 'Semanal (4x)' },
                  { id: 'quinzenal', label: 'Quinzenal (2x)' },
                ],
              },
            ].map((item) => {
              const div = divisorCadencia(item.config.cadencia);
              const metaPorCiclo = item.config.total / div;
              const restanteMes = subMoney(item.config.total, item.spent);
              const pctUsed =
                item.config.total > 0
                  ? Math.max(0, Math.min(100, Math.round((item.spent / item.config.total) * 100)))
                  : 0;

              return (
                <div
                  key={item.key}
                  className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <strong className="text-slate-900 dark:text-white">{item.title}</strong>
                      <button
                        onClick={() => {
                          if (onRequestEditEnvelope) {
                            onRequestEditEnvelope(item.key, item.title, item.config.total);
                          }
                        }}
                        className="min-h-[44px] px-2 py-1 font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer privacy-val inline-flex items-center"
                      >
                        Teto: {fmtBRL(item.config.total)}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg mt-2.5">
                      {item.options.map((opt) => (
                        <button
                          key={opt.id}
                          aria-pressed={item.config.cadencia === opt.id}
                          onClick={() =>
                            onUpdateEnvelope(item.key, item.config.total, opt.id as any)
                          }
                          className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            item.config.cadencia === opt.id
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs privacy-val">
                      <span className="text-slate-500 dark:text-slate-400">
                        Lançado no mês: <strong className="font-mono tabular-nums">{fmtBRL(item.spent)}</strong>
                      </span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          restanteMes < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {restanteMes >= 0 ? `Resta ${fmtBRL(restanteMes)}` : `Excedeu ${fmtBRL(Math.abs(restanteMes))}`}
                      </span>
                    </div>
                    <div
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
                      role="progressbar"
                      aria-label={`Consumo do envelope ${item.title}`}
                      aria-valuenow={pctUsed}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className={`h-full rounded-full ${
                          restanteMes < 0 ? 'bg-rose-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${pctUsed}%` }}
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1 privacy-val">
                      Meta por ciclo: <span className="font-mono tabular-nums">{fmtBRL(metaPorCiclo)}</span> ({div}x no mês)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Barra de Filtro e Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
            {[
              { id: 'all', label: `Todas (${despesasMes.length})` },
              { id: 'pending', label: `Pendentes (${despesasMes.filter((d) => !d.paga).length})` },
              { id: 'paid', label: `Pagas (${despesasMes.filter((d) => d.paga).length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                aria-pressed={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar conta ou categoria..."
              aria-label="Filtrar despesas por nome ou categoria"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Lista de Despesas */}
        {filteredExpenses.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhuma despesa encontrada para este filtro em {formatMonthYear(comp)}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onSyncTemplateToMonth}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Importar Contas do Molde Recorrente
              </button>
              <button
                onClick={onOpenNewExpenseModal}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                + Lançar Gasto Avulso
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {filteredExpenses.map((d) => {
              const isEssencial = isEssentialCategory(d.categoria, d.natureza);
              return (
                <div
                  key={d.id}
                  className="py-3.5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold ${
                            d.paga
                              ? 'line-through text-slate-600 dark:text-slate-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {d.descricao}
                        </span>
                        {d.totalParcelas && d.totalParcelas > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-[11px] font-semibold font-mono tabular-nums">
                            Parcela {d.parcelaAtual || 1}/{d.totalParcelas}
                          </span>
                        )}
                        <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{d.categoria}</span>
                        <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {isEssencial ? 'Essencial (50%)' : 'Estilo de Vida (30%)'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {d.paga ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            Paga {d.dataPagamento ? `em ${d.dataPagamento}` : ''}{' '}
                            {d.contaOrigem ? `(${d.contaOrigem})` : ''}
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            Aguardando Pagamento · Vence dia {d.diaVencimento}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span
                        className={`font-mono tabular-nums text-base font-bold privacy-val ${
                          d.paga ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {fmtBRL(d.valor)}
                      </span>

                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                        {d.paga ? (
                          <button
                            onClick={() => onRefundExpense(d.id)}
                            className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Desfazer</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onOpenPayExpenseModal(d.id)}
                            className="min-h-[44px] px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Pagar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            editingExpenseId === d.id ? setEditingExpenseId(null) : startEditExpense(d)
                          }
                          aria-label={`Editar despesa ${d.descricao}`}
                          className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => onEditExpenseAmount(d.id)}
                          aria-label={`Ajustar valor de ${d.descricao}`}
                          className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center"
                        >
                          Valor
                        </button>
                        <button
                          onClick={() => onDeleteExpense(d.id)}
                          aria-label={`Remover despesa ${d.descricao}`}
                          className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {editingExpenseId === d.id && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveExpense(d);
                      }}
                      className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label
                            htmlFor={`edit-exp-desc-${d.id}`}
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                          >
                            Descrição
                          </label>
                          <input
                            id={`edit-exp-desc-${d.id}`}
                            type="text"
                            value={editExpDesc}
                            onChange={(e) => {
                              setEditExpDesc(e.target.value);
                              if (editExpError) setEditExpError(null);
                            }}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-exp-cat-${d.id}`}
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                          >
                            Categoria
                          </label>
                          <select
                            id={`edit-exp-cat-${d.id}`}
                            value={editExpCat}
                            onChange={(e) => setEditExpCat(e.target.value as ExpenseItem['categoria'])}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                          >
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label
                            htmlFor={`edit-exp-nat-${d.id}`}
                            className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                          >
                            Natureza (50/30/20)
                          </label>
                          <select
                            id={`edit-exp-nat-${d.id}`}
                            value={editExpNatureza}
                            onChange={(e) =>
                              setEditExpNatureza(e.target.value as 'essencial' | 'estilo_vida')
                            }
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                          >
                            <option value="essencial">Essencial (50%)</option>
                            <option value="estilo_vida">Estilo de Vida (30%)</option>
                          </select>
                        </div>
                      </div>

                      {editExpError && (
                        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                          {editExpError}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingExpenseId(null)}
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
        )}
      </div>

      {/* RECEITAS EXTRAS DO MÊS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Receitas Extras do Mês ({formatMonthYear(comp)})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Freelas, reembolsos, bônus ou vendas. Receitas marcadas como já recebidas somam na renda do Cockpit e na Diária Segura.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs shrink-0">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Recebidas: </span>
              <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 privacy-val">
                {fmtBRL(totalReceitasRecebidas)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Total Previsto: </span>
              <strong className="font-mono tabular-nums text-slate-900 dark:text-white privacy-val">
                {fmtBRL(totalReceitasExtras)}
              </strong>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const desc = extraDesc.trim();
            const val = parseFloat(extraVal);
            if (!desc) {
              setExtraFormError('Informe a descrição da receita extra.');
              return;
            }
            if (!Number.isFinite(val) || val <= 0) {
              setExtraFormError('Informe um valor maior que zero.');
              return;
            }
            setExtraFormError(null);
            onAddExtraIncome?.({
              descricao: desc,
              valor: val,
              categoria: extraCat,
              data: new Date().toISOString().slice(0, 10),
              recebida: extraRecebida,
            });
            setExtraDesc('');
            setExtraVal('');
            setExtraRecebida(true);
          }}
          className="space-y-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="extra-income-desc" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Descrição
              </label>
              <input
                id="extra-income-desc"
                type="text"
                value={extraDesc}
                onChange={(e) => {
                  setExtraDesc(e.target.value);
                  if (extraFormError) setExtraFormError(null);
                }}
                placeholder="Ex: Projeto Freelance, Reembolso"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="extra-income-val" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Valor (R$)
              </label>
              <input
                id="extra-income-val"
                type="number"
                step="0.01"
                min="0"
                value={extraVal}
                onChange={(e) => {
                  setExtraVal(e.target.value);
                  if (extraFormError) setExtraFormError(null);
                }}
                placeholder="450.00"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="extra-income-cat" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Categoria
              </label>
              <select
                id="extra-income-cat"
                value={extraCat}
                onChange={(e) => setExtraCat(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                {EXTRA_INCOME_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center min-h-[38px]">
              <label htmlFor="extra-income-received" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  id="extra-income-received"
                  type="checkbox"
                  checked={extraRecebida}
                  onChange={(e) => setExtraRecebida(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>Já recebida</span>
              </label>
            </div>

            <div>
              <button
                type="submit"
                className="w-full min-h-[44px] py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                + Adicionar Receita
              </button>
            </div>
          </div>

          {extraFormError && (
            <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {extraFormError}
            </p>
          )}
        </form>

        {receitasMes.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhuma receita extra registrada em {formatMonthYear(comp)}.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {receitasMes.map((r) => (
              <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{r.descricao}</span>
                    <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{r.categoria}</span>
                    <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        r.recebida ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {r.recebida ? 'Recebida' : 'A receber'}
                    </span>
                  </div>
                  {r.data && (
                    <div className="text-slate-500 dark:text-slate-400">Data: {r.data}</div>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <span className="font-mono tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
                    +{fmtBRL(r.valor)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleExtraIncome?.(r.id)}
                    aria-label={r.recebida ? `Marcar ${r.descricao} como a receber` : `Marcar ${r.descricao} como recebida`}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {r.recebida ? 'Marcar Pendente' : 'Confirmar Recebimento'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteExtraIncome?.(r.id)}
                    aria-label={`Remover receita ${r.descricao}`}
                    className="min-h-[44px] min-w-[44px] p-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NOVO MÓDULO: PLANEJADOR DE QUITAÇÃO DE DÍVIDAS (AVALANCHE VS BOLA DE NEVE) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Planejador de Quitação de Dívidas (Avalanche vs. Bola de Neve)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Possui empréstimo, financiamento ou parcelamento com juros? Cadastre aqui para priorizar a ordem matemática que economiza mais juros.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
            <button
              type="button"
              aria-pressed={debtStrategy === 'avalanche'}
              onClick={() => setDebtStrategy('avalanche')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                debtStrategy === 'avalanche'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Método Avalanche (Maior Juros)
            </button>
            <button
              type="button"
              aria-pressed={debtStrategy === 'snowball'}
              onClick={() => setDebtStrategy('snowball')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                debtStrategy === 'snowball'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Bola de Neve (Menor Saldo)
            </button>
          </div>
        </div>

        {/* Formulário Rápido de Dívida */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const nome = newDebtName.trim();
            const saldo = parseFloat(newDebtBalance);
            const taxa = parseFloat(newDebtRate);
            const parcelaMin = newDebtMin.trim() ? parseFloat(newDebtMin) : 0;

            if (!nome) {
              setDebtFormError('Informe o nome da dívida ou financiamento.');
              return;
            }
            if (!Number.isFinite(saldo) || saldo <= 0) {
              setDebtFormError('Informe um saldo devedor maior que zero.');
              return;
            }
            if (!Number.isFinite(taxa) || taxa <= 0) {
              setDebtFormError('Informe uma taxa de juros mensal maior que zero.');
              return;
            }
            if (newDebtMin.trim() && (!Number.isFinite(parcelaMin) || parcelaMin <= 0)) {
              setDebtFormError('A parcela mínima deve ser maior que zero.');
              return;
            }

            setDebtFormError(null);
            onAddDebt({
              nome,
              saldoDevedor: saldo,
              taxaJurosMensal: taxa,
              parcelaMinima: parcelaMin,
            });
            setNewDebtName('');
            setNewDebtBalance('');
            setNewDebtRate('');
            setNewDebtMin('');
          }}
          className="space-y-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="debt-name" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Nome da Dívida / Financiamento
              </label>
              <input
                id="debt-name"
                type="text"
                value={newDebtName}
                onChange={(e) => {
                  setNewDebtName(e.target.value);
                  if (debtFormError) setDebtFormError(null);
                }}
                placeholder="Ex: Empréstimo Pessoal, Cartão Rotativo"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="debt-balance" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Saldo Devedor (R$)
              </label>
              <input
                id="debt-balance"
                type="number"
                step="0.01"
                value={newDebtBalance}
                onChange={(e) => {
                  setNewDebtBalance(e.target.value);
                  if (debtFormError) setDebtFormError(null);
                }}
                placeholder="2500.00"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="debt-rate" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Juros (% a.m.)
              </label>
              <input
                id="debt-rate"
                type="number"
                step="0.1"
                value={newDebtRate}
                onChange={(e) => {
                  setNewDebtRate(e.target.value);
                  if (debtFormError) setDebtFormError(null);
                }}
                placeholder="4.5"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="debt-min" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Parcela Mínima (R$)
              </label>
              <input
                id="debt-min"
                type="number"
                step="0.01"
                value={newDebtMin}
                onChange={(e) => {
                  setNewDebtMin(e.target.value);
                  if (debtFormError) setDebtFormError(null);
                }}
                placeholder="150.00"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
              >
                + Cadastrar Dívida
              </button>
            </div>
          </div>
          {debtFormError && (
            <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {debtFormError}
            </p>
          )}
        </form>

        {sortedDebts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhuma dívida ativa cadastrada. Parabéns! Caso tenha algum financiamento ou empréstimo, adicione acima para traçar seu plano de ataque.
          </p>
        ) : (
          <div className="space-y-5">
            {/* Simulador Completo de Quitação: Avalanche vs Bola de Neve */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Simulador Comparativo de Quitação (Avalanche vs. Bola de Neve)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Simula mês a mês com juros compostos e reaplicação automática das parcelas liberadas.
                  </p>
                </div>
                <label htmlFor="debt-extra-budget" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 shrink-0">
                  <span>Aporte Extra Mensal (R$):</span>
                  <input
                    id="debt-extra-budget"
                    type="number"
                    min="0"
                    step="50"
                    value={extraDebtBudget}
                    onChange={(e) => setExtraDebtBudget(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono tabular-nums text-right text-slate-900 dark:text-white"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className={`border rounded-xl p-4 space-y-2 ${
                    debtStrategy === 'avalanche'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Método Avalanche (Maior Juros Primeiro)
                    </span>
                    {interestDiff > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                        Mais econômico
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Prazo</span>
                      <strong className="font-mono tabular-nums text-sm text-slate-900 dark:text-white">
                        {avalancheSim.months} meses
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Juros Totais</span>
                      <strong className="font-mono tabular-nums text-sm text-rose-600 dark:text-rose-400 privacy-val">
                        {fmtBRL(avalancheSim.totalInterestPaid)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Total Pago</span>
                      <strong className="font-mono tabular-nums text-sm text-slate-900 dark:text-white privacy-val">
                        {fmtBRL(avalancheSim.totalPaid)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div
                  className={`border rounded-xl p-4 space-y-2 ${
                    debtStrategy === 'snowball'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Bola de Neve (Menor Saldo Primeiro)
                    </span>
                    {interestDiff < 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold">
                        Mais econômico
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Prazo</span>
                      <strong className="font-mono tabular-nums text-sm text-slate-900 dark:text-white">
                        {snowballSim.months} meses
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Juros Totais</span>
                      <strong className="font-mono tabular-nums text-sm text-rose-600 dark:text-rose-400 privacy-val">
                        {fmtBRL(snowballSim.totalInterestPaid)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Total Pago</span>
                      <strong className="font-mono tabular-nums text-sm text-slate-900 dark:text-white privacy-val">
                        {fmtBRL(snowballSim.totalPaid)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700 text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  Estratégia ativa:{' '}
                  <strong>{debtStrategy === 'avalanche' ? 'Avalanche' : 'Bola de Neve'}</strong> (quitação estimada em{' '}
                  <strong className="font-mono tabular-nums">{activeSim.months} meses</strong>)
                </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 privacy-val">
                  Economia estimada em juros:{' '}
                  <strong className="font-mono tabular-nums">{fmtBRL(interestSavings)}</strong>
                  {interestDiff > 0
                    ? ' (a favor do Avalanche)'
                    : interestDiff < 0
                    ? ' (a favor da Bola de Neve)'
                    : ' (empate entre estratégias)'}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
              {sortedDebts.map((debt, idx) => {
                const custoJurosMes = (debt.saldoDevedor * debt.taxaJurosMensal) / 100;
                return (
                  <div key={debt.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {idx + 1}º Prioridade: {debt.nome}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400 mx-2" aria-hidden="true">·</span>
                      <span className="text-rose-600 dark:text-rose-400 font-medium privacy-val">
                        Taxa: {debt.taxaJurosMensal}% a.m. (~<span className="font-mono tabular-nums">{fmtBRL(custoJurosMes)}</span>/mês só de juros)
                      </span>
                      {debt.parcelaMinima > 0 && (
                        <>
                          <span className="text-slate-600 dark:text-slate-400 mx-2" aria-hidden="true">·</span>
                          <span className="text-slate-600 dark:text-slate-400 privacy-val">
                            Parcela mín.: <span className="font-mono tabular-nums">{fmtBRL(debt.parcelaMinima)}</span>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white privacy-val">
                        {fmtBRL(debt.saldoDevedor)}
                      </span>
                      <button
                        onClick={() => onDeleteDebt(debt.id)}
                        aria-label={`Remover dívida ${debt.nome}`}
                        className="min-h-[44px] min-w-[44px] p-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer inline-flex items-center justify-center rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
