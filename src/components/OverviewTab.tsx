import React from 'react';
import { AppState, fmtBRL } from '../utils/storage';
import {
  addMoney,
  annualToMonthlyRate,
  calculateBudget503020,
  calculateCreditCardGraceDays,
  calculateFireProjection,
  calculateGoalMonthsCompound,
  calculateSafeDailyAllowance,
  subMoney,
  sumMoney,
  sumMonthlyExtraIncome,
} from '../utils/financeMath';
import { Calendar } from 'lucide-react';

interface OverviewTabProps {
  state: AppState;
  daysUntilNextPayday: number;
  nextPaydayFormatted: string;
  onNavigate: (tab: string) => void;
  onOpenPaydayModal: () => void;
  onOpenAporteModal: (caixinhaId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  daysUntilNextPayday,
  nextPaydayFormatted,
  onNavigate,
  onOpenPaydayModal,
  onOpenAporteModal,
}) => {
  const despesasMes = state.despesasPorMes[state.competenciaAtual] || [];
  const totalBancos = sumMoney(state.bancos.map((b) => b.saldo || 0));
  const totalCaixinhas = sumMoney(state.caixinhas.map((c) => c.saldo || 0));
  const totalAportesPlanejados = sumMoney(state.caixinhas.map((c) => c.aporteMensal || 0));
  const contasPendentes = sumMoney(despesasMes.filter((d) => !d.paga).map((d) => d.valor || 0));
  const totalFaturasCartao = sumMoney(state.cartoes.map((c) => c.faturaAtual || 0));
  const totalDividas = sumMoney((state.dividas || []).map((d) => d.saldoDevedor || 0));
  const despesasMesTotal = sumMoney(despesasMes.map((d) => d.valor || 0));
  const salarioLiquido = state.salario.liquido || 0;
  const extraRecebidaMes = sumMonthlyExtraIncome(
    state.receitasPorMes?.[state.competenciaAtual],
    true
  );
  const rendaTotalMes = addMoney(salarioLiquido, extraRecebidaMes);

  // Conciliação Real (Aritmética Inteira em Centavos)
  const saldoLivre = subMoney(totalBancos, contasPendentes);
  const patrimonioLiquido = subMoney(subMoney(addMoney(totalBancos, totalCaixinhas), contasPendentes), totalDividas);

  // Orçamento 50/30/20 Real
  const budget503020 = calculateBudget503020(rendaTotalMes, despesasMes, totalAportesPlanejados);

  // Cobertura de Segurança (Runway) baseada em Despesas Essenciais (ou total se essencial for 0)
  const saldoEmergencia = sumMoney(
    state.caixinhas.filter((c) => c.tipo === 'emergencia').map((c) => c.saldo || 0)
  );
  const baseCustoMensal = budget503020.essentialsTotal > 0 ? budget503020.essentialsTotal : despesasMesTotal;
  const mesesCobertura = baseCustoMensal > 0 ? (saldoEmergencia / baseCustoMensal).toFixed(1) : '0.0';
  const pctCoberturaProg = Math.max(0, Math.min(100, Math.round((parseFloat(mesesCobertura) / 6) * 100)));

  // Diária Segura até o próximo salário (motor de centavos)
  const sobraPrevistaMes = Math.max(0, subMoney(subMoney(rendaTotalMes, despesasMesTotal), totalAportesPlanejados));
  const diariaSegura = calculateSafeDailyAllowance({
    salarioLiquido: rendaTotalMes,
    sobraPrevistaMes,
    saldoLivre,
    daysRemaining: daysUntilNextPayday,
  });

  // Distribuição Empilhada (com guarda para estado zerado e clamp [0, 100])
  const clampPct = (v: number) => Math.max(0, Math.min(100, v));
  const totalAtivosBrutos = addMoney(totalBancos, totalCaixinhas);
  const isZeroState = totalBancos <= 0 && totalCaixinhas <= 0 && contasPendentes <= 0;
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
  const needsOnboarding = state.bancos.length === 0 || salarioLiquido <= 0;

  return (
    <div className="space-y-6">
      {/* Cabeçalho Semântico do Cockpit */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Visão Geral & Cockpit Financeiro
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Consolidado em tempo real da sua liquidez, reservas e ritmo mensal.
          </p>
        </div>
      </div>

      {/* CTA amigável para configuração inicial quando não há bancos ou salário */}
      {needsOnboarding && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Complete a configuração inicial do seu Cockpit
            </h2>
            <p className="text-xs text-emerald-800 dark:text-emerald-300/90">
              {state.bancos.length === 0 && salarioLiquido <= 0
                ? 'Cadastre suas contas bancárias e informe seu salário líquido para liberar a Diária Segura e o orçamento 50/30/20.'
                : state.bancos.length === 0
                ? 'Cadastre ao menos uma conta bancária para acompanhar seu Saldo Livre Real e rendimento do CDI.'
                : 'Informe seu salário líquido na aba Contracheque para calcular sua Diária Segura e metas 50/30/20.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {state.bancos.length === 0 && (
              <button
                onClick={() => onNavigate('bancos')}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Cadastrar Conta Bancária
              </button>
            )}
            {salarioLiquido <= 0 && (
              <button
                onClick={() => onNavigate('contracheque')}
                className="px-3.5 py-2 rounded-lg border border-emerald-700/40 dark:border-emerald-600/50 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold transition-colors cursor-pointer"
              >
                Configurar Salário
              </button>
            )}
          </div>
        </div>
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
                  saldoLivre < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : saldoLivre < 300
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {saldoLivre < 0 ? 'Caixa Negativo' : saldoLivre < 300 ? 'Caixa Apertado' : 'Caixa Saudável'}
              </span>
            </div>
            <div
              id="kpiSaldoLivre"
              className={`mt-2 font-mono tabular-nums text-2xl font-bold tracking-tight privacy-val ${
                saldoLivre < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {fmtBRL(saldoLivre)}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>Bancos menos contas pendentes</span>
            {saldoLivre < 0 && (
              <button
                onClick={() => onNavigate('caixinhas')}
                className="text-rose-600 dark:text-rose-400 font-semibold hover:underline"
              >
                Resgatar reserva
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
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
              <span>Orçamento Diário Seguro até o Próximo Salário</span>
              <span aria-hidden="true">·</span>
              <span>
                {diariaSegura <= 0
                  ? 'Margem Esgotada'
                  : diariaSegura < 25
                  ? 'Ritmo Apertado'
                  : 'Ritmo Sob Controle'}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span
                id="displayDiariaSegura"
                className="font-mono tabular-nums text-3xl sm:text-4xl font-extrabold tracking-tight text-white privacy-val"
              >
                {fmtBRL(diariaSegura)}
              </span>
              <span className="text-sm text-emerald-200/90 font-medium">/ dia livre para gastar hoje</span>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed max-w-2xl">
              Restam <strong>{daysUntilNextPayday} dias</strong> até o próximo pagamento previsto (
              <strong>{nextPaydayFormatted}</strong>). Calculado sobre a menor margem entre a sobra mensal do salário (
              <span className="font-mono tabular-nums privacy-val">{fmtBRL(sobraPrevistaMes)}</span>) e seu Saldo Livre Real (
              <span className="font-mono tabular-nums privacy-val">{fmtBRL(Math.max(0, saldoLivre))}</span>).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenPaydayModal}
              className="px-4 py-2.5 rounded-lg bg-emerald-900/90 hover:bg-emerald-800 text-emerald-100 border border-emerald-700/70 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Calendar className="w-4 h-4" />
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
            <strong className="font-mono text-slate-900 dark:text-white privacy-val">
              {fmtBRL(totalBancos + totalCaixinhas)}
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
              <strong className="font-mono text-emerald-700 dark:text-emerald-400 privacy-val">
                {fmtBRL(saldoLivre)}
              </strong>{' '}
              ({livreBarPct}%)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Caixinhas & Reserva:{' '}
              <strong className="font-mono text-sky-700 dark:text-sky-400 privacy-val">
                {fmtBRL(totalCaixinhas)}
              </strong>{' '}
              ({caixinhasBarPct}%)
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Contas Pendentes:{' '}
              <strong className="font-mono text-amber-700 dark:text-amber-400 privacy-val">
                {fmtBRL(contasPendentes)}
              </strong>{' '}
              ({pendentesBarPct}%)
            </span>
            {totalFaturasCartao > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Faturas de Cartão Abertas:{' '}
                  <strong className="font-mono text-slate-700 dark:text-slate-300 privacy-val">
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
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-b border-slate-100 dark:border-slate-800">
              {state.bancos.map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{b.nome}</span>
                    <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">
                      ·
                    </span>
                    <span className={b.rendeJuros ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
                      {b.rendeJuros ? `${b.pctCDI}% CDI` : '0% CDI'}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white privacy-val">
                    {fmtBRL(b.saldo)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
              Destinação Carimbada (Objetivos & Compromissos)
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-b border-slate-100 dark:border-slate-800">
              {state.caixinhas.map((cx) => (
                <div key={cx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{cx.nome}</span>
                  <span className="font-mono font-semibold text-sky-700 dark:text-sky-400 privacy-val">
                    {fmtBRL(cx.saldo)}
                  </span>
                </div>
              ))}
              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-medium text-amber-700 dark:text-amber-400">Contas a Pagar neste Mês</span>
                <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 privacy-val">
                  {fmtBRL(contasPendentes)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Saldo Livre Disponível</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
                  {fmtBRL(saldoLivre)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            onClick={() => onNavigate('caixinhas')}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Gerenciar Caixinhas →
          </button>
        </div>

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
              } else if (Number.isFinite(compound.monthsCompound) && compound.monthsCompound > 0) {
                const now = new Date();
                const targetDate = new Date(now.getFullYear(), now.getMonth() + compound.monthsCompound, 1);
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
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{cx.nome}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        Aporte: <span className="font-mono tabular-nums privacy-val">{fmtBRL(cx.aporteMensal)}</span>/mês ·{' '}
                        {cx.instituicao}
                      </p>
                    </div>
                    <button
                      onClick={() => onOpenAporteModal(cx.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      Aportar
                    </button>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
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
      </div>

      {/* ZONA 4: TERMÔMETRO DO CICLO MENSAL (REGRA 50 / 30 / 20 REAL) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Termômetro do Ciclo Mensal (Metodologia 50 / 30 / 20 Real)
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Classifica automaticamente suas despesas em <strong>Essenciais (alvo ≤ 50%)</strong>,{' '}
            <strong>Estilo de Vida (alvo ≤ 30%)</strong> e <strong>Futuro/Aportes (alvo ≥ 20%)</strong>.
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
            <span className="text-xs text-slate-600 dark:text-slate-400">
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
            <span className="text-xs text-slate-600 dark:text-slate-400">
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
            <span className="text-xs text-slate-600 dark:text-slate-400">
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
              Sobre renda líquida de <span className="font-mono tabular-nums privacy-val">{fmtBRL(rendaTotalMes)}</span>
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
                : 'Cadastre seus cartões para calcular a melhor janela de compra.'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onNavigate('cartoes')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Abrir Cartões & Simulador À Vista vs. Parcelado →
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Bússola de Independência Financeira (FIRE)</span>
              <span>SWR {state.configuracoes.swrAnualPct}% a.a.</span>
            </div>
            <div className="mt-2 font-mono text-lg font-bold text-slate-900 dark:text-white">
              {fireProjection.yearsToFire !== null
                ? `${fireProjection.yearsToFire} anos restantes (${fireProjection.progressPct}% da meta)`
                : 'Configure seu aporte FIRE'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Meta patrimonial: <span className="font-mono privacy-val">{fmtBRL(fireProjection.targetPatrimony)}</span>{' '}
              · Renda passiva perpétua hoje:{' '}
              <span className="font-mono privacy-val">{fmtBRL(fireProjection.currentSafeMonthlyIncome)}/mês</span>.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => onNavigate('caixinhas')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Abrir Simulador Completo de Aposentadoria →
            </button>
          </div>
        </div>
      </div>

      {/* ZONA 6: MENTOR DETERMINÍSTICO BASEADO NOS SEUS NÚMEROS */}
      {saldoSemRendimento > 300 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
              Custo de Oportunidade Detectado: Dinheiro Parado a 0% do CDI
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-200/80 leading-relaxed">
              Você possui <strong className="font-mono privacy-val">{fmtBRL(saldoSemRendimento)}</strong> em contas que
              não rendem juros automáticos. Transferindo esse valor para uma conta remunerada a 100% do CDI, você
              ganharia cerca de{' '}
              <strong className="font-mono privacy-val">
                + {fmtBRL(saldoSemRendimento * monthlyNetCdiRate)}/mês
              </strong>{' '}
              líquidos de IR sem risco e com liquidez imediata.
            </p>
          </div>
          <button
            onClick={() => onNavigate('bancos')}
            className="px-3 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-semibold shrink-0 hover:bg-amber-800 transition-colors cursor-pointer"
          >
            Otimizar Contas
          </button>
        </div>
      )}
    </div>
  );
};
