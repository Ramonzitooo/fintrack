import React from 'react';
import { AppState, fmtBRL, formatMonthYear } from '../utils/storage';
import {
  addMoney,
  annualToMonthlyRate,
  calculateBudget503020,
  calculateCategoryBreakdown,
  calculateCreditCardGraceDays,
  calculateFireProjection,
  calculateGoalMonthsCompound,
  calculateSafeDailyAllowance,
  classifyExpenseDueStatus,
  subMoney,
  sumMoney,
  sumMonthlyExtraIncome,
} from '../utils/financeMath';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Landmark,
  PieChart,
  PiggyBank,
  Receipt,
  Sparkles,
  Wallet,
} from 'lucide-react';

interface OverviewTabProps {
  state: AppState;
  daysUntilNextPayday: number;
  nextPaydayFormatted: string;
  onNavigate: (tab: string) => void;
  onOpenPaydayModal: () => void;
  onOpenAporteModal: (caixinhaId: string) => void;
  onLoadDemoData?: () => void;
}

const DONUT_PALETTE = [
  '#059669', // emerald-600
  '#0284c7', // sky-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#e11d48', // rose-600
  '#0d9488', // teal-600
  '#4f46e5', // indigo-600
  '#ea580c', // orange-600
  '#65a30d', // lime-600
  '#475569', // slate-600
] as const;

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  daysUntilNextPayday,
  nextPaydayFormatted,
  onNavigate,
  onOpenPaydayModal,
  onOpenAporteModal,
  onLoadDemoData,
}) => {
  const comp = state.competenciaAtual;
  const despesasMes = state.despesasPorMes[comp] || [];
  const totalBancos = sumMoney(state.bancos.map((b) => b.saldo || 0));
  const totalCaixinhas = sumMoney(state.caixinhas.map((c) => c.saldo || 0));
  const totalAportesPlanejados = sumMoney(state.caixinhas.map((c) => c.aporteMensal || 0));
  const contasPendentes = sumMoney(despesasMes.filter((d) => !d.paga).map((d) => d.valor || 0));
  const totalFaturasCartao = sumMoney(state.cartoes.map((c) => c.faturaAtual || 0));
  const totalDividas = sumMoney((state.dividas || []).map((d) => d.saldoDevedor || 0));
  const despesasMesTotal = sumMoney(despesasMes.map((d) => d.valor || 0));
  const salarioLiquido = state.salario.liquido || 0;
  const extraRecebidaMes = sumMonthlyExtraIncome(state.receitasPorMes?.[comp], true);
  const rendaTotalMes = addMoney(salarioLiquido, extraRecebidaMes);

  // Conciliação Real (Aritmética Inteira em Centavos)
  const saldoLivre = subMoney(totalBancos, contasPendentes);
  const patrimonioLiquido = subMoney(
    subMoney(addMoney(totalBancos, totalCaixinhas), contasPendentes),
    totalDividas
  );

  // Orçamento 50/30/20 Real
  const budget503020 = calculateBudget503020(rendaTotalMes, despesasMes, totalAportesPlanejados);

  // Cobertura de Segurança (Runway) baseada em Despesas Essenciais (ou total se essencial for 0)
  const saldoEmergencia = sumMoney(
    state.caixinhas.filter((c) => c.tipo === 'emergencia').map((c) => c.saldo || 0)
  );
  const baseCustoMensal =
    budget503020.essentialsTotal > 0 ? budget503020.essentialsTotal : despesasMesTotal;
  const mesesCobertura =
    baseCustoMensal > 0 ? (saldoEmergencia / baseCustoMensal).toFixed(1) : '0.0';
  const pctCoberturaProg = Math.max(
    0,
    Math.min(100, Math.round((parseFloat(mesesCobertura) / 6) * 100))
  );

  // Diária Segura até o próximo salário (motor de centavos)
  const sobraPrevistaMes = Math.max(
    0,
    subMoney(subMoney(rendaTotalMes, despesasMesTotal), totalAportesPlanejados)
  );
  const diariaSegura = calculateSafeDailyAllowance({
    salarioLiquido: rendaTotalMes,
    sobraPrevistaMes,
    saldoLivre,
    daysRemaining: daysUntilNextPayday,
  });

  // Distribuição Empilhada (com guarda para estado zerado e clamp [0, 100])
  const clampPct = (v: number) => Math.max(0, Math.min(100, v));
  const totalAtivosBrutos = addMoney(totalBancos, totalCaixinhas);
  const isZeroState =
    state.bancos.length === 0 &&
    state.caixinhas.length === 0 &&
    state.cartoes.length === 0 &&
    despesasMes.length === 0 &&
    rendaTotalMes <= 0;
  const livreBarPct =
    isZeroState || totalAtivosBrutos <= 0
      ? 0
      : clampPct(Math.round((Math.max(0, saldoLivre) / totalAtivosBrutos) * 100));
  const caixinhasBarPct =
    isZeroState || totalAtivosBrutos <= 0
      ? 0
      : clampPct(Math.round((Math.max(0, totalCaixinhas) / totalAtivosBrutos) * 100));
  const pendentesBarPct = isZeroState
    ? 0
    : totalAtivosBrutos <= 0
    ? contasPendentes > 0
      ? 100
      : 0
    : clampPct(100 - livreBarPct - caixinhasBarPct);

  // Taxa mensal líquida do CDI para projeção das caixinhas
  const cdiAnual = state.configuracoes.taxaCdiAnual ?? 10.75;
  const monthlyNetCdiRate = annualToMonthlyRate(cdiAnual) * 0.825; // líquido de 17.5% IR médio

  const nomesMeses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  // Melhor Cartão Hoje (com cálculo real de prazo)
  let melhorCartao = state.cartoes[0] || null;
  let melhorPrazo = 0;
  let melhorStatus = 'Prazo Médio';
  for (const card of state.cartoes) {
    const info = calculateCreditCardGraceDays(card.diaCorte, card.diaVencimento);
    if (info.daysToPay > melhorPrazo) {
      melhorPrazo = info.daysToPay;
      melhorCartao = card;
      melhorStatus = info.statusLabel;
    }
  }

  // Bússola FIRE Unificada (soma todas as caixinhas de aposentadoria)
  const caixinhasFire = state.caixinhas.filter((c) => c.tipo === 'aposentadoria');
  const fireProjection = calculateFireProjection(
    sumMoney(caixinhasFire.map((c) => c.saldo || 0)),
    sumMoney(caixinhasFire.map((c) => c.aporteMensal || 0)),
    baseCustoMensal,
    state.configuracoes.swrAnualPct ?? 4.0,
    state.configuracoes.jurosReaisAnualPct ?? 5.0
  );

  // Dicas Determinísticas
  const saldoSemRendimento = sumMoney(
    state.bancos.filter((b) => !b.rendeJuros).map((b) => b.saldo || 0)
  );

  // Onboarding Checklist de 3 Passos (Primeiro Acesso)
  const stepSalaryDone = salarioLiquido > 0;
  const stepBanksDone = state.bancos.length > 0;
  const stepExpensesDone =
    despesasMes.length > 0 || (state.despesasFixasMolde || []).length > 0;
  const onboardingSteps = [
    {
      id: 'salary',
      title: '1. Configurar Salário CLT/Renda',
      description:
        'Informe seus proventos e descontos para apurar sua renda líquida e destravar a Diária Segura.',
      done: stepSalaryDone,
      ctaLabel: stepSalaryDone ? 'Revisar Contracheque' : 'Configurar Salário',
      targetTab: 'contracheque',
      Icon: Wallet,
    },
    {
      id: 'banks',
      title: '2. Cadastrar Conta Bancária',
      description:
        'Adicione suas contas correntes, digitais ou corretoras para medir seu Saldo Livre Real e o CDI.',
      done: stepBanksDone,
      ctaLabel: stepBanksDone ? 'Revisar Contas' : 'Cadastrar Conta',
      targetTab: 'bancos',
      Icon: Landmark,
    },
    {
      id: 'expenses',
      title: '3. Registrar Contas Fixas do Mês',
      description:
        'Cadastre aluguel, energia e despesas recorrentes para carimbar compromissos antes de gastar.',
      done: stepExpensesDone,
      ctaLabel: stepExpensesDone ? 'Revisar Despesas' : 'Registrar Contas',
      targetTab: 'despesas',
      Icon: Receipt,
    },
  ] as const;
  const completedStepsCount = onboardingSteps.filter((s) => s.done).length;
  const showOnboardingChecklist = completedStepsCount < 3;

  // Radar de Vencimentos Críticos na Competência Ativa
  const despesasVencidas = despesasMes.filter(
    (d) => classifyExpenseDueStatus(d, comp) === 'vencida'
  );
  const despesasVenceBreve = despesasMes.filter(
    (d) => classifyExpenseDueStatus(d, comp) === 'vence_breve'
  );
  const totalVencidas = sumMoney(despesasVencidas.map((d) => d.valor || 0));
  const totalVenceBreve = sumMoney(despesasVenceBreve.map((d) => d.valor || 0));
  const hasCriticalDueExpenses =
    despesasVencidas.length > 0 || despesasVenceBreve.length > 0;
  const hasOverdueExpenses = despesasVencidas.length > 0;
  const criticalPreviewItems = [...despesasVencidas, ...despesasVenceBreve].slice(0, 3);

  // Gráfico Donut SVG Nativo de Gastos por Categoria
  const categoryBreakdown = calculateCategoryBreakdown(despesasMes);
  const totalCategorizado = sumMoney(categoryBreakdown.map((c) => c.valor));
  const donutRadius = 78;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let cumulativeFraction = 0;
  const donutSegments = categoryBreakdown.map((item, idx) => {
    const fraction = totalCategorizado > 0 ? item.valor / totalCategorizado : 0;
    const rawLength = fraction * donutCircumference;
    const gap = categoryBreakdown.length > 1 && rawLength > 4 ? 2.5 : 0;
    const dashLength = Math.max(0, rawLength - gap);
    const dashOffset = -cumulativeFraction * donutCircumference;
    cumulativeFraction += fraction;
    return {
      ...item,
      color: DONUT_PALETTE[idx % DONUT_PALETTE.length],
      dashLength,
      dashOffset,
    };
  });

  const donutAriaSummary =
    categoryBreakdown.length > 0
      ? `Gráfico de rosca da distribuição de despesas em ${formatMonthYear(comp)} com ${
          categoryBreakdown.length
        } categorias. Maior participação: ${categoryBreakdown[0].categoria} (${categoryBreakdown[0].percentual
          .toFixed(1)
          .replace('.', ',')}%).`
      : `Sem despesas registradas em ${formatMonthYear(comp)}.`;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Semântico do Cockpit */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Visão Geral
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Saldo disponível, compromissos e objetivos reunidos em{' '}
            <strong className="text-slate-800 dark:text-slate-200">{formatMonthYear(comp)}</strong>.
          </p>
        </div>
      </div>

      {/* ONBOARDING CHECKLIST INTERATIVO DE 3 PASSOS (PRIMEIRO ACESSO) */}
      {showOnboardingChecklist && (
        <section
          aria-labelledby="onboarding-checklist-heading"
          className="bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Configuração Inicial Guiada ({completedStepsCount} de 3 etapas concluídas)
                </span>
              </div>
              <h2
                id="onboarding-checklist-heading"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                Prepare seu Cockpit Financeiro em 3 passos rápidos
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl">
                Preencha os pilares abaixo para calcular com precisão sua Diária Segura, o Saldo Livre Real e o orçamento 50/30/20 — 100% salvo localmente no seu dispositivo.
              </p>
            </div>

            {onLoadDemoData && (
              <button
                type="button"
                onClick={onLoadDemoData}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-emerald-700/40 dark:border-emerald-600/60 bg-white dark:bg-slate-900 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Explorar com Dados de Demonstração</span>
              </button>
            )}
          </div>

          <div
            className="w-full h-1.5 bg-emerald-200/60 dark:bg-emerald-950 rounded-full overflow-hidden"
            role="progressbar"
            aria-label="Progresso da configuração inicial"
            aria-valuenow={Math.round((completedStepsCount / 3) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((completedStepsCount / 3) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {onboardingSteps.map((step) => {
              const StepIcon = step.Icon;
              return (
                <div
                  key={step.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                    step.done
                      ? 'bg-white/90 dark:bg-slate-900/80 border-emerald-300 dark:border-emerald-800/80'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <StepIcon
                          className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{step.done ? 'Concluído' : 'Pendente'}</span>
                      </span>
                      {step.done ? (
                        <CheckCircle2
                          className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <Circle
                          className="w-4 h-4 text-slate-400 dark:text-slate-600 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate(step.targetTab)}
                    className={`min-h-[44px] w-full px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      step.done
                        ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    }`}
                  >
                    <span>{step.ctaLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* RADAR DE VENCIMENTOS CRÍTICOS (VENCIDAS OU VENCENDO EM ATÉ 3 DIAS) */}
      {hasCriticalDueExpenses && (
        <section
          aria-labelledby="critical-due-radar-heading"
          className={`rounded-2xl border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
            hasOverdueExpenses
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70'
              : 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/70'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                hasOverdueExpenses
                  ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                  : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
              }`}
            >
              {hasOverdueExpenses ? (
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Clock className="w-5 h-5" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-1">
              <h2
                id="critical-due-radar-heading"
                className={`text-sm font-bold ${
                  hasOverdueExpenses
                    ? 'text-rose-900 dark:text-rose-200'
                    : 'text-amber-900 dark:text-amber-200'
                }`}
              >
                {hasOverdueExpenses
                  ? 'Atenção: Existem contas vencidas aguardando baixa nesta competência'
                  : 'Radar de Vencimentos: Contas vencendo nos próximos 3 dias'}
              </h2>
              <p
                className={`text-xs leading-relaxed ${
                  hasOverdueExpenses
                    ? 'text-rose-800 dark:text-rose-200/90'
                    : 'text-amber-800 dark:text-amber-200/90'
                }`}
              >
                {despesasVencidas.length > 0 && (
                  <span>
                    <strong>
                      {despesasVencidas.length}{' '}
                      {despesasVencidas.length === 1 ? 'conta vencida' : 'contas vencidas'}
                    </strong>{' '}
                    somando{' '}
                    <strong className="font-mono tabular-nums privacy-val">
                      {fmtBRL(totalVencidas)}
                    </strong>
                    {despesasVenceBreve.length > 0 ? ' · ' : '. '}
                  </span>
                )}
                {despesasVenceBreve.length > 0 && (
                  <span>
                    <strong>
                      {despesasVenceBreve.length}{' '}
                      {despesasVenceBreve.length === 1
                        ? 'conta vence em breve'
                        : 'contas vencem em breve'}
                    </strong>{' '}
                    somando{' '}
                    <strong className="font-mono tabular-nums privacy-val">
                      {fmtBRL(totalVenceBreve)}
                    </strong>
                    .{' '}
                  </span>
                )}
                Quite ou atualize o status para evitar juros e multas desnecessárias.
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {criticalPreviewItems.map((item) => {
                  const status = classifyExpenseDueStatus(item, comp);
                  return (
                    <span
                      key={item.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                        status === 'vencida'
                          ? 'bg-rose-100/80 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                          : 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <span>
                        {item.descricao} (dia {item.diaVencimento})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums privacy-val">
                        {fmtBRL(item.valor)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('despesas')}
            className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
              hasOverdueExpenses
                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                : 'bg-amber-900 hover:bg-amber-800 text-white'
            }`}
          >
            <span>Revisar Contas na Aba Despesas</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </button>
        </section>
      )}

      {/* ZONA 1: COCKPIT EXECUTIVO (4 NÚMEROS VITAIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Livre Real */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold">Saldo Livre Real</span>
              <span
                className={`font-medium ${
                  isZeroState
                    ? 'text-slate-500 dark:text-slate-400'
                    : saldoLivre < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : saldoLivre < 300
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {isZeroState
                  ? 'Aguardando dados'
                  : saldoLivre < 0
                  ? 'Caixa Negativo'
                  : saldoLivre < 300
                  ? 'Caixa Apertado'
                  : 'Caixa Saudável'}
              </span>
            </div>
            <div
              id="kpiSaldoLivre"
              className={`mt-2 font-mono tabular-nums text-2xl font-bold tracking-tight privacy-val ${
                isZeroState
                  ? 'text-slate-900 dark:text-white'
                  : saldoLivre < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {fmtBRL(saldoLivre)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Bancos menos contas pendentes</span>
            {saldoLivre < 0 && (
              <button
                type="button"
                onClick={() => onNavigate('caixinhas')}
                className="min-h-[44px] px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center cursor-pointer shrink-0"
              >
                Resgatar da Reserva
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Patrimônio Líquido */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold">Patrimônio Líquido</span>
              <span>Ativos - Passivos</span>
            </div>
            <div
              id="kpiPatrimonioLiquido"
              className="mt-2 font-mono tabular-nums text-2xl font-bold tracking-tight text-slate-900 dark:text-white privacy-val"
            >
              {fmtBRL(patrimonioLiquido)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums privacy-val">
            Contas ({fmtBRL(totalBancos)}) + Caixinhas ({fmtBRL(totalCaixinhas)})
          </div>
        </div>

        {/* Card 3: Taxa de Poupança */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold">Taxa de Poupança</span>
              <span>Alvo ≥ 20%</span>
            </div>
            <div
              id="kpiSavingsRate"
              className="mt-2 font-mono tabular-nums text-2xl font-bold tracking-tight text-sky-700 dark:text-sky-400"
            >
              {budget503020.investmentsPct}%
            </div>
            <div
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2"
              role="progressbar"
              aria-label="Taxa de Poupança"
              aria-valuenow={clampPct(Math.round(budget503020.investmentsPct))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-sky-600 dark:bg-sky-400 rounded-full transition-all duration-300"
                style={{ width: `${clampPct(budget503020.investmentsPct)}%` }}
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums privacy-val">
            {fmtBRL(totalAportesPlanejados)} de {fmtBRL(rendaTotalMes)} líquidos
          </div>
        </div>

        {/* Card 4: Cobertura de Segurança (Runway) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold">Autonomia da Reserva</span>
              <span>Alvo: 6 meses</span>
            </div>
            <div
              id="kpiMesesCobertura"
              className="mt-2 font-mono tabular-nums text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              {mesesCobertura} meses
            </div>
            <div
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2"
              role="progressbar"
              aria-label="Autonomia da Reserva de Emergência"
              aria-valuenow={pctCoberturaProg}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${pctCoberturaProg}%` }}
              />
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums privacy-val">
            Reserva ({fmtBRL(saldoEmergencia)}) ÷ Custo ({fmtBRL(baseCustoMensal)})
          </div>
        </div>
      </div>

      {/* HERO CARD: DIÁRIA SEGURA DE GASTOS (FOCAL ANCHOR) */}
      <div className="bg-emerald-950 text-white rounded-2xl p-6 border border-emerald-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-300">
              <span>Orçamento Diário Seguro até o Próximo Salário</span>
              <span aria-hidden="true">·</span>
              <span>
                {isZeroState
                  ? 'Aguardando configuração'
                  : diariaSegura <= 0
                  ? 'Margem Esgotada'
                  : diariaSegura < 25
                  ? 'Ritmo Apertado'
                  : 'Ritmo Sob Controle'}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                id="displayDiariaSegura"
                className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold tracking-tight text-white privacy-val"
              >
                {fmtBRL(diariaSegura)}
              </span>
              <span className="text-sm text-emerald-200/90 font-medium">
                / dia livre para gastar hoje
              </span>
            </div>
            <p className="text-sm text-emerald-100/85 leading-relaxed max-w-2xl">
              {isZeroState ? (
                'Cadastre sua renda, uma conta e as despesas do mês para calcular um valor diário seguro com base no seu caixa real.'
              ) : (
                <>
                  Restam <strong className="tabular-nums">{daysUntilNextPayday} dias</strong> até o
                  próximo pagamento previsto (<strong>{nextPaydayFormatted}</strong>). Calculado sobre
                  a menor margem entre a sobra mensal do salário (
                  <span className="font-mono tabular-nums privacy-val">{fmtBRL(sobraPrevistaMes)}</span>
                  ) e seu Saldo Livre Real (
                  <span className="font-mono tabular-nums privacy-val">
                    {fmtBRL(Math.max(0, saldoLivre))}
                  </span>
                  ).
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenPaydayModal}
              className="min-h-[44px] px-4 py-2.5 rounded-lg bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 border border-emerald-700/70 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ajustar Data do Salário</span>
            </button>
          </div>
        </div>
      </div>

      {/* ZONA 2: MATRIZ DE CONCILIAÇÃO REAL (ORIGEM X DESTINO) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Matriz de Conciliação Patrimonial: Onde está cada real
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cruza o dinheiro custodiado nas contas e corretoras com o que já está carimbado para metas e contas a vencer.
            </p>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Ativos Totais Mapeados:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-white privacy-val">
              {fmtBRL(addMoney(totalBancos, totalCaixinhas))}
            </strong>
          </div>
        </div>

        {/* Barra Proporcional Empilhada */}
        <div className="space-y-2">
          <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex">
            <div
              style={{ width: `${livreBarPct}%` }}
              className="bg-emerald-600 h-full transition-all duration-300"
              title="Saldo Livre Real"
            />
            <div
              style={{ width: `${caixinhasBarPct}%` }}
              className="bg-sky-600 h-full transition-all duration-300"
              title="Caixinhas & Metas"
            />
            <div
              style={{ width: `${pendentesBarPct}%` }}
              className="bg-amber-500 h-full transition-all duration-300"
              title="Contas Pendentes do Mês"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
            <span>
              Saldo Livre Real:{' '}
              <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 privacy-val">
                {fmtBRL(saldoLivre)}
              </strong>{' '}
              ({livreBarPct}%)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Caixinhas & Reserva:{' '}
              <strong className="font-mono tabular-nums text-sky-700 dark:text-sky-400 privacy-val">
                {fmtBRL(totalCaixinhas)}
              </strong>{' '}
              ({caixinhasBarPct}%)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Contas Pendentes:{' '}
              <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-400 privacy-val">
                {fmtBRL(contasPendentes)}
              </strong>{' '}
              ({pendentesBarPct}%)
            </span>
            {totalFaturasCartao > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Faturas de Cartão Abertas:{' '}
                  <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-300 privacy-val">
                    {fmtBRL(totalFaturasCartao)}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Grid Origem vs Destino */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
              Custódia Física (Contas Bancárias)
            </h4>
            {state.bancos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma conta bancária cadastrada ainda.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('bancos')}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  Cadastrar Conta
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-b border-slate-100 dark:border-slate-800">
                {state.bancos.map((b) => (
                  <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {b.nome}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span
                        className={
                          b.rendeJuros
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }
                      >
                        {b.rendeJuros ? `${b.pctCDI}% CDI` : '0% CDI'}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white privacy-val">
                      {fmtBRL(b.saldo)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
              Destinação Carimbada (Objetivos & Compromissos)
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-b border-slate-100 dark:border-slate-800">
              {state.caixinhas.map((cx) => (
                <div key={cx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {cx.nome}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-sky-700 dark:text-sky-400 privacy-val">
                    {fmtBRL(cx.saldo)}
                  </span>
                </div>
              ))}
              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  Contas a Pagar neste Mês
                </span>
                <span className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400 privacy-val">
                  {fmtBRL(contasPendentes)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Saldo Livre Disponível
                </span>
                <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
                  {fmtBRL(saldoLivre)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ZONA 2.5: GRÁFICO DONUT SVG NATIVO DE GASTOS POR CATEGORIA */}
      <section
        aria-labelledby="category-donut-heading"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3
              id="category-donut-heading"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Distribuição de Gastos por Categoria
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Participação exata de cada categoria nas despesas registradas em{' '}
              {formatMonthYear(comp)}.
            </p>
          </div>
          {categoryBreakdown.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('despesas')}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span>Detalhar Despesas</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center flex flex-col items-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
              <PieChart className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nenhuma despesa registrada em {formatMonthYear(comp)}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Cadastre suas contas fixas ou gastos variáveis do mês para enxergar para onde seu dinheiro está indo por categoria.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('despesas')}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Registrar Despesas do Mês</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Donut SVG */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-52 h-52 sm:w-56 sm:h-56">
                <svg
                  viewBox="0 0 220 220"
                  role="img"
                  aria-label={donutAriaSummary}
                  className="w-full h-full"
                >
                  <circle
                    cx="110"
                    cy="110"
                    r={donutRadius}
                    fill="none"
                    strokeWidth="26"
                    className="stroke-slate-100 dark:stroke-slate-800"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.categoria}
                      cx="110"
                      cy="110"
                      r={donutRadius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="26"
                      strokeDasharray={`${seg.dashLength} ${donutCircumference}`}
                      strokeDashoffset={seg.dashOffset}
                      transform="rotate(-90 110 110)"
                      className="transition-all duration-300"
                    >
                      <title>
                        {seg.categoria}: {seg.percentual.toFixed(1).replace('.', ',')}%
                      </title>
                    </circle>
                  ))}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Total do Mês
                  </span>
                  <span className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-slate-900 dark:text-white privacy-val mt-0.5">
                    {fmtBRL(totalCategorizado)}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {despesasMes.length}{' '}
                    {despesasMes.length === 1 ? 'lançamento' : 'lançamentos'}
                  </span>
                </div>
              </div>
            </div>

            {/* Lista Lateral de Categorias */}
            <div className="lg:col-span-7 space-y-3">
              {donutSegments.map((seg) => (
                <div
                  key={seg.categoria}
                  className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                        aria-hidden="true"
                      />
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {seg.categoria}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                        ({seg.count} {seg.count === 1 ? 'item' : 'itens'} ·{' '}
                        {seg.isEssential ? 'Essencial' : 'Estilo de Vida'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white privacy-val">
                        {fmtBRL(seg.valor)}
                      </span>
                      <span className="font-mono tabular-nums text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                        {seg.percentual.toFixed(1).replace('.', ',')}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(2, seg.percentual))}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ZONA 3: MONITOR DE VELOCIDADE DAS CAIXINHAS COM JUROS COMPOSTOS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Suas Caixinhas & Previsão Temporal com Juros Compostos
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Projeção exata combinando seus aportes mensais + capitalização composta líquida do CDI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('caixinhas')}
            className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Gerenciar Caixinhas</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </button>
        </div>

        {state.caixinhas.length === 0 ? (
          <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center flex flex-col items-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <PiggyBank className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Nenhuma caixinha ou meta configurada
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Crie sua Reserva de Emergência ou plano FIRE para simular em quantos meses os juros compostos do CDI antecipam seus objetivos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('caixinhas')}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Criar Primeira Caixinha</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {state.caixinhas.map((cx) => {
              const pct = cx.meta > 0 ? clampPct(Math.round((cx.saldo / cx.meta) * 100)) : 0;
              const cxMonthlyRate = monthlyNetCdiRate * ((cx.pctCDI ?? 100) / 100);
              const compound = calculateGoalMonthsCompound(
                cx.saldo,
                cx.meta,
                cx.aporteMensal,
                cxMonthlyRate
              );

              let previsaoTxt = 'Acumulação contínua de longo prazo';
              if (cx.meta > 0) {
                if (cx.saldo >= cx.meta) {
                  previsaoTxt = 'Meta 100% atingida!';
                } else if (
                  Number.isFinite(compound.monthsCompound) &&
                  compound.monthsCompound > 0
                ) {
                  const now = new Date();
                  const targetDate = new Date(
                    now.getFullYear(),
                    now.getMonth() + compound.monthsCompound,
                    1
                  );
                  const mesNome = `${nomesMeses[targetDate.getMonth()]} de ${targetDate.getFullYear()}`;
                  previsaoTxt = `Conclui em ${compound.monthsCompound} meses (${mesNome})`;
                } else {
                  previsaoTxt = 'Defina um aporte mensal para projetar data';
                }
              }

              return (
                <div
                  key={cx.id}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {cx.nome}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          Aporte:{' '}
                          <span className="font-mono tabular-nums privacy-val">
                            {fmtBRL(cx.aporteMensal)}
                          </span>
                          /mês · {cx.instituicao}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenAporteModal(cx.id)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      >
                        Fazer Aporte
                      </button>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between gap-2">
                      <span className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
                        {fmtBRL(cx.saldo)}
                      </span>
                      {cx.meta > 0 && (
                        <span className="font-mono tabular-nums text-xs font-semibold text-emerald-700 dark:text-emerald-400 privacy-val">
                          {pct}% de {fmtBRL(cx.meta)}
                        </span>
                      )}
                    </div>

                    {cx.meta > 0 && (
                      <div
                        className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2"
                        role="progressbar"
                        aria-label={`Progresso de ${cx.nome}`}
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full bg-emerald-600 dark:bg-emerald-400 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <div>{previsaoTxt}</div>
                    {cx.meta > cx.saldo && compound.totalInterestEarned > 0 && (
                      <div className="text-emerald-700 dark:text-emerald-400 font-medium font-mono tabular-nums privacy-val">
                        Juros compostos somam +{fmtBRL(compound.totalInterestEarned)} até a meta
                        {compound.monthsSavedByInterest > 0
                          ? ` (${compound.monthsSavedByInterest}m mais rápido)`
                          : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ZONA 4: TERMÔMETRO DO CICLO MENSAL (REGRA 50 / 30 / 20 REAL) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Termômetro do Ciclo Mensal (Metodologia 50 / 30 / 20 Real)
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Classifica automaticamente suas despesas em <strong>Essenciais (alvo ≤ 50%)</strong>,{' '}
            <strong>Estilo de Vida (alvo ≤ 30%)</strong> e{' '}
            <strong>Futuro/Aportes (alvo ≥ 20%)</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              1. Necessidades Essenciais
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(budget503020.essentialsTotal)}
            </div>
            <div
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-2"
              role="progressbar"
              aria-label="Percentual de Necessidades Essenciais"
              aria-valuenow={clampPct(Math.round(budget503020.essentialsPct))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full ${
                  budget503020.essentialsPct > 55 ? 'bg-amber-500' : 'bg-emerald-600'
                }`}
                style={{ width: `${clampPct(budget503020.essentialsPct)}%` }}
              />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {budget503020.essentialsPct}% da renda (Alvo ≤ 50%)
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              2. Desejos & Estilo de Vida
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(budget503020.lifestyleTotal)}
            </div>
            <div
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-2"
              role="progressbar"
              aria-label="Percentual de Desejos e Estilo de Vida"
              aria-valuenow={clampPct(Math.round(budget503020.lifestylePct))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full ${
                  budget503020.lifestylePct > 30 ? 'bg-rose-500' : 'bg-sky-600'
                }`}
                style={{ width: `${clampPct(budget503020.lifestylePct)}%` }}
              />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {budget503020.lifestylePct}% da renda (Alvo ≤ 30%)
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              3. Aportes & Futuro
            </span>
            <div className="mt-1.5 font-mono tabular-nums text-xl font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(budget503020.investmentsTotal)}
            </div>
            <div
              className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden my-2"
              role="progressbar"
              aria-label="Percentual de Aportes e Futuro"
              aria-valuenow={clampPct(Math.round(budget503020.investmentsPct))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${clampPct(budget503020.investmentsPct)}%` }}
              />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {budget503020.investmentsPct}% da renda (Alvo ≥ 20%)
            </span>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              4. Sobra Livre Não Alocada
            </span>
            <div
              className={`mt-1.5 font-mono tabular-nums text-xl font-bold privacy-val ${
                budget503020.unallocatedMargin < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {fmtBRL(budget503020.unallocatedMargin)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
              Sobre renda líquida de{' '}
              <span className="font-mono tabular-nums privacy-val">{fmtBRL(rendaTotalMes)}</span>
              {extraRecebidaMes > 0 && (
                <span className="block text-[11px] text-emerald-700 dark:text-emerald-400 font-mono tabular-nums privacy-val mt-0.5">
                  Inclui +{fmtBRL(extraRecebidaMes)} de receitas extras
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ZONA 5: RADAR DO DIA (MELHOR CARTÃO & BÚSSOLA FIRE UNIFICADA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Melhor Cartão para Compras Hoje</span>
              <span>{melhorStatus}</span>
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
              {melhorCartao ? melhorCartao.nome : 'Nenhum cartão cadastrado'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {melhorCartao
                ? `Comprando hoje, você ganha ${melhorPrazo} dias de prazo até o vencimento da fatura (dia ${melhorCartao.diaVencimento}).`
                : 'Cadastre seus cartões para o algoritmo indicar a melhor janela de compra sem juros.'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onNavigate('cartoes')}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Simular Compra nos Cartões</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Bússola de Independência Financeira (FIRE)</span>
              <span className="tabular-nums">SWR {state.configuracoes.swrAnualPct}% a.a.</span>
            </div>
            <div className="mt-2 font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
              {fireProjection.yearsToFire !== null
                ? `${fireProjection.yearsToFire} anos restantes (${fireProjection.progressPct}% da meta)`
                : 'Configure seu aporte FIRE'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Meta patrimonial:{' '}
              <span className="font-mono tabular-nums privacy-val">
                {fmtBRL(fireProjection.targetPatrimony)}
              </span>{' '}
              · Renda passiva perpétua hoje:{' '}
              <span className="font-mono tabular-nums privacy-val">
                {fmtBRL(fireProjection.currentSafeMonthlyIncome)}/mês
              </span>
              .
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onNavigate('caixinhas')}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Simular Plano FIRE</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ZONA 6: MENTOR DETERMINÍSTICO BASEADO NOS SEUS NÚMEROS */}
      {saldoSemRendimento > 300 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              Custo de Oportunidade Detectado: Dinheiro Parado a 0% do CDI
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
              Você possui{' '}
              <strong className="font-mono tabular-nums privacy-val">
                {fmtBRL(saldoSemRendimento)}
              </strong>{' '}
              em contas que não rendem juros automáticos. Transferindo esse valor para uma conta remunerada a 100% do CDI, você ganharia cerca de{' '}
              <strong className="font-mono tabular-nums privacy-val">
                + {fmtBRL(saldoSemRendimento * monthlyNetCdiRate)}/mês
              </strong>{' '}
              líquidos de IR sem risco e com liquidez imediata.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('bancos')}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-900 text-white text-xs font-semibold shrink-0 hover:bg-amber-800 transition-colors cursor-pointer"
          >
            Otimizar Contas no CDI
          </button>
        </div>
      )}
    </div>
  );
};
