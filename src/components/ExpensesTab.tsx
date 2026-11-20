import React, { useState } from 'react';
import { AppState, fmtBRL, formatMonthYear } from '../utils/storage';
import { DebtItem, ExpenseItem, isEssentialCategory } from '../utils/financeMath';
import {
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RotateCcw,
  Edit3,
  Trash2,
  Search,
  Scale,
} from 'lucide-react';

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
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debtStrategy, setDebtStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtBalance, setNewDebtBalance] = useState('');
  const [newDebtRate, setNewDebtRate] = useState('');
  const [newDebtMin, setNewDebtMin] = useState('');

  const comp = state.competenciaAtual;
  const despesasMes = state.despesasPorMes[comp] || [];

  const totalPrevisto = despesasMes.reduce((s, d) => s + (d.valor || 0), 0);
  const totalPago = despesasMes.filter((d) => d.paga).reduce((s, d) => s + (d.valor || 0), 0);
  const totalPendente = despesasMes.filter((d) => !d.paga).reduce((s, d) => s + (d.valor || 0), 0);
  const pctQuitado = totalPrevisto > 0 ? Math.min(100, Math.round((totalPago / totalPrevisto) * 100)) : 0;

  // Gastos reais por categoria para cruzar com os Envelopes de Rotina!
  const gastoAlimentacao = despesasMes
    .filter((d) => d.categoria === 'Alimentação')
    .reduce((s, d) => s + (d.valor || 0), 0);
  const gastoLazer = despesasMes
    .filter((d) => d.categoria === 'Lazer' || d.categoria === 'Assinaturas')
    .reduce((s, d) => s + (d.valor || 0), 0);
  const gastoTransporte = despesasMes
    .filter((d) => d.categoria === 'Transporte')
    .reduce((s, d) => s + (d.valor || 0), 0);

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

  // Ordenação do Planejador de Dívidas (Avalanche = maior taxa de juros primeiro; Bola de Neve = menor saldo primeiro)
  const sortedDebts = [...(state.dividas || [])].sort((a, b) =>
    debtStrategy === 'avalanche' ? b.taxaJurosMensal - a.taxaJurosMensal : a.saldoDevedor - b.saldoDevedor
  );

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
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Mês Anterior</span>
            </button>
            <button
              onClick={onGoToCurrentMonth}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
            >
              Mês Atual
            </button>
            <button
              onClick={() => onChangeMonth(1)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Próximo Mês</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Competência Ativa:</span>
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
            <span className="text-xs font-semibold text-slate-500">Total Previsto no Mês</span>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(totalPrevisto)}
            </div>
            <span className="text-xs text-slate-500">{despesasMes.length} lançamentos nesta competência</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500">Já Quitado (Pago)</span>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(totalPago)}
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-1.5">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${pctQuitado}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{pctQuitado}% do total pago</span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500">Falta Pagar (Pendente)</span>
            <div className="mt-1 font-mono text-xl font-bold text-rose-600 dark:text-rose-400 privacy-val">
              {fmtBRL(totalPendente)}
            </div>
            <span className="text-xs text-slate-500">Reservado do Saldo Livre Real</span>
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
              const restanteMes = item.config.total - item.spent;
              const pctUsed =
                item.config.total > 0 ? Math.min(100, Math.round((item.spent / item.config.total) * 100)) : 0;

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
                        className="min-h-[44px] px-2 py-1 font-mono font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer privacy-val inline-flex items-center"
                      >
                        Teto: {fmtBRL(item.config.total)}
                      </button>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg mt-2.5">
                      {item.options.map((opt) => (
                        <button
                          key={opt.id}
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
                      <span className="text-slate-500">
                        Lançado no mês: <strong className="font-mono">{fmtBRL(item.spent)}</strong>
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          restanteMes < 0 ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {restanteMes >= 0 ? `Resta ${fmtBRL(restanteMes)}` : `Excedeu ${fmtBRL(Math.abs(restanteMes))}`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          restanteMes < 0 ? 'bg-rose-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${pctUsed}%` }}
                      />
                    </div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1 privacy-val">
                      Meta por ciclo: <span className="font-mono">{fmtBRL(metaPorCiclo)}</span> ({div}x no mês)
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
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-bold ${
                          d.paga
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {d.descricao}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{d.categoria}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs text-slate-500">
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
                      className={`font-mono text-base font-bold privacy-val ${
                        d.paga ? 'text-slate-400' : 'text-slate-900 dark:text-white'
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
                        onClick={() => onEditExpenseAmount(d.id)}
                        aria-label={`Ajustar valor de ${d.descricao}`}
                        className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center"
                      >
                        Valor
                      </button>
                      <button
                        onClick={() => onDeleteExpense(d.id)}
                        aria-label={`Remover despesa ${d.descricao}`}
                        className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
              onClick={() => setDebtStrategy('avalanche')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                debtStrategy === 'avalanche'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Método Avalanche (Menor Juros)
            </button>
            <button
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
            if (!newDebtName.trim()) return;
            onAddDebt({
              nome: newDebtName.trim(),
              saldoDevedor: parseFloat(newDebtBalance) || 0,
              taxaJurosMensal: parseFloat(newDebtRate) || 0,
              parcelaMinima: parseFloat(newDebtMin) || 0,
            });
            setNewDebtName('');
            setNewDebtBalance('');
            setNewDebtRate('');
            setNewDebtMin('');
          }}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 items-end"
        >
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Nome da Dívida / Financiamento
            </label>
            <input
              type="text"
              value={newDebtName}
              onChange={(e) => setNewDebtName(e.target.value)}
              placeholder="Ex: Empréstimo Pessoal, Cartão Rotativo"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Saldo Devedor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={newDebtBalance}
              onChange={(e) => setNewDebtBalance(e.target.value)}
              placeholder="2500.00"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Juros (% a.m.)
            </label>
            <input
              type="number"
              step="0.1"
              value={newDebtRate}
              onChange={(e) => setNewDebtRate(e.target.value)}
              placeholder="4.5"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
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
        </form>

        {sortedDebts.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhuma dívida ativa cadastrada. Parabéns! Caso tenha algum financiamento ou empréstimo, adicione acima para traçar seu plano de ataque.
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800">
            {sortedDebts.map((debt, idx) => {
              const custoJurosMes = (debt.saldoDevedor * debt.taxaJurosMensal) / 100;
              return (
                <div key={debt.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {idx + 1}º Prioridade: {debt.nome}
                    </span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-rose-600 dark:text-rose-400 font-medium privacy-val">
                      Taxa: {debt.taxaJurosMensal}% a.m. (~{fmtBRL(custoJurosMes)}/mês só de juros)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900 dark:text-white privacy-val">
                      {fmtBRL(debt.saldoDevedor)}
                    </span>
                    <button
                      onClick={() => onDeleteDebt(debt.id)}
                      aria-label={`Remover dívida ${debt.nome}`}
                      className="min-h-[44px] min-w-[44px] p-2 text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center justify-center rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
