export interface BankAccount {
  id: string;
  nome: string;
  tipo: 'Conta Digital' | 'Conta Corrente' | 'Investimento' | 'Dinheiro Físico';
  saldo: number;
  rendeJuros: boolean;
  pctCDI: number;
}

export interface Caixinha {
  id: string;
  nome: string;
  saldo: number;
  aporteMensal: number;
  meta: number;
  tipo: 'emergencia' | 'viagem' | 'aposentadoria' | 'outros';
  instituicao: string;
  pctCDI?: number;
}

export interface CreditCard {
  id: string;
  nome: string;
  diaCorte: number;
  diaVencimento: number;
  beneficio: 'Cashback' | 'Milhas' | 'SemAnuidade';
  limiteTotal: number;
  faturaAtual: number;
}

export interface ExpenseItem {
  id: string;
  moldeId: string | null;
  descricao: string;
  valor: number;
  diaVencimento: number;
  paga: boolean;
  categoria:
    | 'Moradia'
    | 'Conectividade'
    | 'Utilidades'
    | 'Alimentação'
    | 'Transporte'
    | 'Saúde'
    | 'Assinaturas'
    | 'Lazer'
    | 'Imprevisto'
    | 'Educação'
    | 'Impostos'
    | 'Outros';
  natureza?: 'essencial' | 'estilo_vida';
  dataPagamento: string | null;
  contaOrigem: string | null;
  contaOrigemId?: string | null;
  formaPagamento?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  grupoParcelamentoId?: string;
}

export interface ExtraIncomeItem {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  recebida: boolean;
  contaDestinoId?: string | null;
}

export interface RecurringExpenseTemplate {
  id: string;
  descricao: string;
  valorPadrao: number;
  diaVencimento: number;
  categoria: ExpenseItem['categoria'];
  ativa: boolean;
}

export interface PayrollItem {
  id: string;
  nome: string;
  valor: number;
}

export interface DebtItem {
  id: string;
  nome: string;
  saldoDevedor: number;
  taxaJurosMensal: number; // % a.m.
  parcelaMinima: number;
}

/**
 * Limites defensivos do motor financeiro:
 * - MAX_SAFE_MONEY = 9e12 garante |cents| <= 9e14 < Number.MAX_SAFE_INTEGER (~9.007e15),
 *   evitando overflow para Infinity (ex.: 1e308 * 100) e perda de precisão inteira.
 * - MAX_INSTALLMENTS = 600 (50 anos mensais) previne CPU/memória DoS em loops de parcelamento.
 */
export const MAX_SAFE_MONEY = 9_000_000_000_000;
export const MAX_INSTALLMENTS = 600;

/**
 * Motor de Aritmética Inteira em Centavos (Cents Engine):
 * Elimina desvios de ponto flutuante binário IEEE 754 (ex: 0.1 + 0.2 = 0.30000000000000004)
 * convertendo valores monetários para inteiros de centavos antes de somar ou subtrair.
 */
export function toCents(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || Math.abs(num) > MAX_SAFE_MONEY) return 0;
  const cents = Math.round(num * 100);
  return cents === 0 ? 0 : cents;
}

export function fromCents(cents: number): number {
  const numCents = Number(cents);
  if (!Number.isFinite(numCents) || Math.abs(numCents) > MAX_SAFE_MONEY * 100) return 0;
  const intCents = Math.round(numCents);
  const val = intCents / 100;
  return val === 0 ? 0 : val;
}

export function addMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

export function subMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

export function sumMoney(values: number[]): number {
  let totalCents = 0;
  for (const v of values) {
    totalCents += toCents(v);
  }
  return fromCents(totalCents);
}

/**
 * Converte taxa anual nominal/efetiva (%) para taxa mensal equivalente composta (decimal).
 * Fórmula exata: (1 + i_anual)^(1/12) - 1
 * Corrige o erro clássico de dividir a taxa anual por 12 linearmente.
 */
export function annualToMonthlyRate(annualPct: number): number {
  const safeAnnual = Math.max(0, Number(annualPct) || 0) / 100;
  if (safeAnnual === 0) return 0;
  return Math.pow(1 + safeAnnual, 1 / 12) - 1;
}

/**
 * Calcula o rendimento mensal bruto e líquido (descontando IR regressivo) de um saldo em CDI.
 */
export function calculateCdiMonthlyYield(
  balance: number,
  pctCdi: number,
  annualCdiPct: number,
  irAliquotPct = 17.5 // Alíquota média de IR regressivo (361 a 720 dias = 17.5%, >720d = 15%, <180d = 22.5%)
): { grossMonthly: number; netMonthly: number; effectiveMonthlyRate: number } {
  const safeBalance = Math.max(0, Number(balance) || 0);
  const cdiMultiplier = Math.max(0, Number(pctCdi) || 0) / 100;
  if (safeBalance === 0 || cdiMultiplier === 0) {
    return { grossMonthly: 0, netMonthly: 0, effectiveMonthlyRate: 0 };
  }

  // Taxa anual efetiva ponderada pelo % do CDI
  const baseMonthlyCdi = annualToMonthlyRate(annualCdiPct);
  const effectiveMonthlyRate = baseMonthlyCdi * cdiMultiplier;
  const grossMonthly = safeBalance * effectiveMonthlyRate;
  const irFactor = 1 - Math.max(0, Math.min(100, irAliquotPct)) / 100;
  const netMonthly = grossMonthly * irFactor;

  return {
    grossMonthly: Math.round(grossMonthly * 100) / 100,
    netMonthly: Math.round(netMonthly * 100) / 100,
    effectiveMonthlyRate,
  };
}

/**
 * Calcula em quantos meses uma Caixinha/Meta será atingida considerando:
 * 1) Sem juros (linear: (Meta - Saldo) / Aporte)
 * 2) Com juros compostos mensais líquidos do CDI:
 *    FV = PV*(1+r)^n + PMT*(((1+r)^n - 1)/r)
 *    n = ln((FV*r + PMT) / (PV*r + PMT)) / ln(1 + r)
 */
export function calculateGoalMonthsCompound(
  currentBalance: number,
  targetAmount: number,
  monthlyContribution: number,
  monthlyNetRate: number
): {
  monthsLinear: number;
  monthsCompound: number;
  monthsSavedByInterest: number;
  totalInterestEarned: number;
} {
  const pv = Math.max(0, Number(currentBalance) || 0);
  const fv = Math.max(0, Number(targetAmount) || 0);
  const pmt = Math.max(0, Number(monthlyContribution) || 0);
  const r = Math.max(0, Number(monthlyNetRate) || 0);

  if (fv <= 0 || pv >= fv) {
    return { monthsLinear: 0, monthsCompound: 0, monthsSavedByInterest: 0, totalInterestEarned: 0 };
  }

  const remaining = fv - pv;
  const monthsLinear = pmt > 0 ? Math.ceil(remaining / pmt) : Infinity;

  if (r <= 0.000001) {
    return {
      monthsLinear,
      monthsCompound: monthsLinear,
      monthsSavedByInterest: 0,
      totalInterestEarned: 0,
    };
  }

  // Se não há aporte mensal mas já existe saldo rendendo juros compostos
  if (pmt === 0) {
    if (pv <= 0) {
      return { monthsLinear: Infinity, monthsCompound: Infinity, monthsSavedByInterest: 0, totalInterestEarned: 0 };
    }
    const nOnlyInterest = Math.ceil(Math.log(fv / pv) / Math.log(1 + r));
    return {
      monthsLinear: Infinity,
      monthsCompound: nOnlyInterest,
      monthsSavedByInterest: 0,
      totalInterestEarned: Math.max(0, Math.round((fv - pv) * 100) / 100),
    };
  }

  const num = fv * r + pmt;
  const den = pv * r + pmt;
  const nExact = Math.log(num / den) / Math.log(1 + r);
  const monthsCompound = Math.max(1, Math.ceil(nExact));
  const monthsSavedByInterest = Number.isFinite(monthsLinear)
    ? Math.max(0, monthsLinear - monthsCompound)
    : 0;

  // Fórmula fechada O(1) para saldo futuro após monthsCompound meses
  const factor = Math.pow(1 + r, monthsCompound);
  const simBalance = pv * factor + pmt * ((factor - 1) / r);
  const totalContributed = pmt * monthsCompound;
  const rawInterest = Number.isFinite(simBalance)
    ? simBalance - pv - totalContributed
    : fv - pv - totalContributed;
  const totalInterestEarned = Math.max(0, Math.round(rawInterest * 100) / 100);

  return {
    monthsLinear,
    monthsCompound,
    monthsSavedByInterest,
    totalInterestEarned,
  };
}

/**
 * Calcula a Independência Financeira (FIRE) de forma unificada e consistente.
 * Corrige a divergência entre o Painel Executivo e a Aba de Aposentadoria.
 */
export function calculateFireProjection(
  retirementBalance: number,
  monthlyRetirementContribution: number,
  monthlyCostOfLiving: number,
  swrAnnualPct = 4.0,
  realAnnualReturnPct = 5.0
): {
  targetPatrimony: number;
  currentSafeMonthlyIncome: number;
  yearsToFire: number | null;
  monthsToFire: number | null;
  yearsSavedWithExtra100: number;
  progressPct: number;
} {
  const pv = Math.max(0, Number(retirementBalance) || 0);
  const pmt = Math.max(0, Number(monthlyRetirementContribution) || 0);
  const cost = Math.max(0, Number(monthlyCostOfLiving) || 0);
  const swr = Math.max(0.5, Number(swrAnnualPct) || 4.0) / 100;
  const realMonthlyRate = annualToMonthlyRate(realAnnualReturnPct);

  const annualCost = cost * 12;
  const targetPatrimony = annualCost > 0 ? Math.round((annualCost / swr) * 100) / 100 : 0;
  const currentSafeMonthlyIncome = Math.round(((pv * swr) / 12) * 100) / 100;

  if (targetPatrimony <= 0) {
    return {
      targetPatrimony: 0,
      currentSafeMonthlyIncome,
      yearsToFire: null,
      monthsToFire: null,
      yearsSavedWithExtra100: 0,
      progressPct: 0,
    };
  }

  const progressPct = Math.min(100, Math.round((pv / targetPatrimony) * 1000) / 10);

  if (pv >= targetPatrimony) {
    return {
      targetPatrimony,
      currentSafeMonthlyIncome,
      yearsToFire: 0,
      monthsToFire: 0,
      yearsSavedWithExtra100: 0,
      progressPct: 100,
    };
  }

  if (pmt <= 0 && pv <= 0) {
    return {
      targetPatrimony,
      currentSafeMonthlyIncome,
      yearsToFire: null,
      monthsToFire: null,
      yearsSavedWithExtra100: 0,
      progressPct,
    };
  }

  const calcMonths = (contribution: number) => {
    if (realMonthlyRate <= 0) {
      return contribution > 0 ? Math.ceil((targetPatrimony - pv) / contribution) : Infinity;
    }
    const num = targetPatrimony * realMonthlyRate + contribution;
    const den = pv * realMonthlyRate + contribution;
    if (den <= 0 || num <= den) return Infinity;
    return Math.ceil(Math.log(num / den) / Math.log(1 + realMonthlyRate));
  };

  const monthsToFire = calcMonths(pmt);
  const monthsWithExtra = calcMonths(pmt + 100);

  if (!Number.isFinite(monthsToFire)) {
    return {
      targetPatrimony,
      currentSafeMonthlyIncome,
      yearsToFire: null,
      monthsToFire: null,
      yearsSavedWithExtra100: 0,
      progressPct,
    };
  }

  const yearsToFire = Math.round((monthsToFire / 12) * 10) / 10;
  const yearsWithExtra = Number.isFinite(monthsWithExtra) ? Math.round((monthsWithExtra / 12) * 10) / 10 : yearsToFire;
  const yearsSavedWithExtra100 = Math.max(0, Math.round((yearsToFire - yearsWithExtra) * 10) / 10);

  return {
    targetPatrimony,
    currentSafeMonthlyIncome,
    yearsToFire,
    monthsToFire,
    yearsSavedWithExtra100,
    progressPct,
  };
}

/**
 * Classifica automaticamente se uma categoria de despesa pertence a:
 * - Necessidades Essenciais (50%): Moradia, Alimentação, Saúde, Transporte, Utilidades, Conectividade, Educação, Impostos
 * - Desejos / Estilo de Vida (30%): Lazer, Assinaturas, Imprevisto, Outros
 */
export function isEssentialCategory(categoria: ExpenseItem['categoria'], naturezaOverride?: 'essencial' | 'estilo_vida'): boolean {
  if (naturezaOverride === 'essencial') return true;
  if (naturezaOverride === 'estilo_vida') return false;
  const essentialSet = new Set([
    'Moradia',
    'Alimentação',
    'Saúde',
    'Transporte',
    'Utilidades',
    'Conectividade',
    'Educação',
    'Impostos',
  ]);
  return essentialSet.has(categoria);
}

/**
 * Calcula a distribuição real do orçamento segundo a metodologia 50 / 30 / 20:
 * - 50% Necessidades Essenciais
 * - 30% Estilo de Vida & Desejos
 * - 20% Futuro (Aportes em Caixinhas & Investimentos)
 */
export function calculateBudget503020(
  netIncome: number,
  expenses: ExpenseItem[],
  plannedContributions: number
): {
  essentialsTotal: number;
  essentialsPct: number;
  lifestyleTotal: number;
  lifestylePct: number;
  investmentsTotal: number;
  investmentsPct: number;
  unallocatedMargin: number;
  unallocatedPct: number;
} {
  const income = fromCents(Math.max(0, toCents(netIncome)));
  let essentialsCents = 0;
  let lifestyleCents = 0;

  for (const exp of expenses) {
    const valCents = Math.max(0, toCents(exp.valor));
    if (isEssentialCategory(exp.categoria, exp.natureza)) {
      essentialsCents += valCents;
    } else {
      lifestyleCents += valCents;
    }
  }

  const essentialsTotal = fromCents(essentialsCents);
  const lifestyleTotal = fromCents(lifestyleCents);
  const investmentsTotal = fromCents(Math.max(0, toCents(plannedContributions)));
  const totalCommittedCents = essentialsCents + lifestyleCents + toCents(investmentsTotal);
  const unallocatedMargin = fromCents(toCents(income) - totalCommittedCents);

  if (income <= 0) {
    return {
      essentialsTotal,
      essentialsPct: 0,
      lifestyleTotal,
      lifestylePct: 0,
      investmentsTotal,
      investmentsPct: 0,
      unallocatedMargin,
      unallocatedPct: 0,
    };
  }

  return {
    essentialsTotal,
    essentialsPct: Math.round((essentialsTotal / income) * 1000) / 10,
    lifestyleTotal,
    lifestylePct: Math.round((lifestyleTotal / income) * 1000) / 10,
    investmentsTotal,
    investmentsPct: Math.round((investmentsTotal / income) * 1000) / 10,
    unallocatedMargin,
    unallocatedPct: Math.round((Math.max(0, unallocatedMargin) / income) * 1000) / 10,
  };
}

/**
 * Executa o débito e o estorno exato de uma despesa na conta bancária.
 * Corrige o bug onde `Math.max(0, banco.saldo - d.valor)` truncava saldos negativos
 * e depois o estorno somava `d.valor` integralmente criando dinheiro fictício.
 */
export function applyExpensePaymentToAccount(currentBalance: number, expenseAmount: number): number {
  const val = fromCents(Math.max(0, toCents(expenseAmount)));
  return subMoney(currentBalance, val);
}

export function refundExpensePaymentToAccount(currentBalance: number, expenseAmount: number): number {
  const val = fromCents(Math.max(0, toCents(expenseAmount)));
  return addMoney(currentBalance, val);
}

/**
 * Fixa um dia do mês dentro dos limites válidos do mês/ano informados (ex.: 31/02 -> 28/02 ou 29/02),
 * evitando overflow automático do construtor Date para o mês seguinte.
 */
export function clampDateToMonth(year: number, monthZeroBased: number, day: number): Date {
  const normalized = new Date(year, monthZeroBased, 1);
  const y = normalized.getFullYear();
  const m = normalized.getMonth();
  const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
  const clampedDay = Math.max(1, Math.min(Math.round(Number(day) || 1), lastDayOfMonth));
  return new Date(y, m, clampedDay);
}

function diffDaysUTC(from: Date, to: Date): number {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((utcTo - utcFrom) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula o prazo real em dias para pagar uma compra feita hoje no cartão de crédito.
 * Se hoje >= diaCorte, a compra entra na fatura que fecha no próximo mês.
 * Se hoje < diaCorte, a compra entra na fatura que fecha neste mês.
 */
export function calculateCreditCardGraceDays(
  closingDay: number,
  dueDay: number,
  referenceDate: Date = new Date()
): { daysToPay: number; statusLabel: 'Melhor Janela' | 'Prazo Médio' | 'Fatura Quase Fechando' } {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const currentDay = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Determina a data de fechamento da fatura em que a compra de hoje cairá
  let statementCloseDate: Date;
  if (currentDay >= closingDay) {
    // Fatura deste mês já fechou -> compra cai no fechamento do mês seguinte
    statementCloseDate = clampDateToMonth(year, month + 1, closingDay);
  } else {
    // Fatura deste mês ainda está aberta -> fecha neste mês
    statementCloseDate = clampDateToMonth(year, month, closingDay);
  }

  // Determina a data de vencimento associada a esse fechamento
  let statementDueDate: Date;
  if (dueDay > closingDay) {
    statementDueDate = clampDateToMonth(statementCloseDate.getFullYear(), statementCloseDate.getMonth(), dueDay);
  } else {
    // Vence no mês subsequente ao fechamento (ex: fecha dia 25, vence dia 05)
    statementDueDate = clampDateToMonth(statementCloseDate.getFullYear(), statementCloseDate.getMonth() + 1, dueDay);
  }

  const daysToPay = Math.max(1, diffDaysUTC(today, statementDueDate));

  let statusLabel: 'Melhor Janela' | 'Prazo Médio' | 'Fatura Quase Fechando' = 'Prazo Médio';
  if (daysToPay >= 32) {
    statusLabel = 'Melhor Janela';
  } else if (daysToPay <= 14) {
    statusLabel = 'Fatura Quase Fechando';
  }

  return { daysToPay, statusLabel };
}

/**
 * Simulador Financeiro: Comprar à Vista com Desconto vs Parcelar sem Juros investindo no CDI.
 * Calcula também o Desconto Mínimo de Equilíbrio (Break-even Discount %) a partir do qual pagar à vista vence.
 */
export function simulateCashVsInstallments(
  nominalPrice: number,
  cashDiscountPct: number,
  installments: number,
  monthlyNetYieldPct: number
): {
  cashPrice: number;
  immediateDiscountValue: number;
  installmentValue: number;
  totalInterestEarned: number;
  finalCdiBalanceAfterInstallments: number;
  netAdvantageForInstallments: number;
  verdict: 'PARCELAR' | 'A_VISTA' | 'EMPATE';
  breakEvenDiscountPct: number;
} {
  const rawPrice = Number(nominalPrice);
  const price =
    Number.isFinite(rawPrice) && rawPrice > 0 && rawPrice <= MAX_SAFE_MONEY ? rawPrice : 0;
  const rawDisc = Number(cashDiscountPct);
  const discPct =
    Number.isFinite(rawDisc) && rawDisc > 0 && rawDisc <= MAX_SAFE_MONEY
      ? Math.min(99, rawDisc)
      : 0;
  const rawInstallments = Number(installments);
  const n = Number.isFinite(rawInstallments)
    ? Math.min(MAX_INSTALLMENTS, Math.max(1, Math.round(rawInstallments)))
    : 1;
  const rawYield = Number(monthlyNetYieldPct);
  const r =
    Number.isFinite(rawYield) && rawYield > 0 && rawYield <= MAX_SAFE_MONEY
      ? Math.min(100, rawYield) / 100
      : 0;

  const cashPrice = Math.round(price * (1 - discPct / 100) * 100) / 100;
  const immediateDiscountValue = Math.round((price - cashPrice) * 100) / 100;
  const installmentValue = Math.round((price / n) * 100) / 100;

  // Valor Presente das parcelas descontadas à taxa líquida mensal r (primeira parcela em 30 dias na fatura)
  let pvInstallments = 0;
  for (let k = 1; k <= n; k++) {
    pvInstallments += (price / n) / Math.pow(1 + r, k);
  }
  const breakEvenDiscountPct = price > 0 ? Math.max(0, Math.round(((1 - pvInstallments / price) * 100) * 100) / 100) : 0;

  let saldoCDI = cashPrice;
  let totalInterestEarned = 0;

  for (let m = 1; m <= n; m++) {
    const yieldMonth = saldoCDI > 0 ? saldoCDI * r : 0;
    totalInterestEarned += yieldMonth;
    saldoCDI = saldoCDI + yieldMonth - price / n;
  }

  const finalCdiBalanceAfterInstallments = Math.round(saldoCDI * 100) / 100;
  const netAdvantageForInstallments = finalCdiBalanceAfterInstallments;

  let verdict: 'PARCELAR' | 'A_VISTA' | 'EMPATE' = 'EMPATE';
  if (netAdvantageForInstallments > 0.5) verdict = 'PARCELAR';
  else if (netAdvantageForInstallments < -0.5) verdict = 'A_VISTA';

  return {
    cashPrice,
    immediateDiscountValue,
    installmentValue,
    totalInterestEarned: Math.round(totalInterestEarned * 100) / 100,
    finalCdiBalanceAfterInstallments,
    netAdvantageForInstallments,
    verdict,
    breakEvenDiscountPct,
  };
}

/**
 * Calcula o desconto progressivo oficial de INSS e IRRF (Tabela Progressiva CLT Brasileira)
 * para ajudar usuários leigos a estimarem seu contracheque com 1 clique.
 */
export function calculateOfficialPayrollTaxes(
  grossSalary: number,
  dependents = 0
): {
  inss: number;
  irrf: number;
  effectiveTaxRatePct: number;
  estimatedNetSalary: number;
} {
  if (!Number.isFinite(grossSalary) || grossSalary <= 0) {
    return { inss: 0, irrf: 0, effectiveTaxRatePct: 0, estimatedNetSalary: 0 };
  }
  const bruto = grossSalary;

  // Faixas progressivas do INSS 2026 (Portaria Interministerial MPS/MF nº 13/2026)
  const bracketsINSS = [
    { limit: 1621.0, rate: 0.075 },
    { limit: 2902.84, rate: 0.09 },
    { limit: 4354.27, rate: 0.12 },
    { limit: 8475.55, rate: 0.14 },
  ];

  let inss = 0;
  let prevLimit = 0;
  for (const b of bracketsINSS) {
    if (bruto > prevLimit) {
      const taxableSlice = Math.min(bruto, b.limit) - prevLimit;
      inss += taxableSlice * b.rate;
      prevLimit = b.limit;
    } else {
      break;
    }
  }
  inss = Math.round(inss * 100) / 100;

  // Base de cálculo do IRRF: opta pelo maior benefício entre Dedução Legal (INSS + Dependentes) ou Desconto Simplificado Mensal (R$ 607,20)
  const safeDependents = Math.max(0, Number(dependents) || 0);
  const legalDeduction = inss + safeDependents * 189.59;
  const simplifiedDiscount = 607.2;
  const bestDeduction = Math.max(legalDeduction, simplifiedDiscount);
  const baseIR = Math.max(0, bruto - bestDeduction);

  let irrfBase = 0;
  if (baseIR <= 2428.8) {
    irrfBase = 0;
  } else if (baseIR <= 2826.65) {
    irrfBase = baseIR * 0.075 - 182.16;
  } else if (baseIR <= 3751.05) {
    irrfBase = baseIR * 0.15 - 394.16;
  } else if (baseIR <= 4664.68) {
    irrfBase = baseIR * 0.225 - 675.49;
  } else {
    irrfBase = baseIR * 0.275 - 908.73;
  }
  irrfBase = Math.max(0, Math.round(irrfBase * 100) / 100);

  // Redutor Mensal da Lei nº 15.270/2025 sobre os rendimentos tributáveis
  let reducao = 0;
  if (bruto <= 5000.0) {
    reducao = 312.89;
  } else if (bruto <= 7350.0) {
    reducao = Math.max(0, 978.62 - 0.133145 * bruto);
  }
  const irrf = Math.max(0, Math.round((irrfBase - reducao) * 100) / 100);

  const totalTaxes = inss + irrf;
  const effectiveTaxRatePct = Math.round(((totalTaxes / bruto) * 100) * 10) / 10;
  const estimatedNetSalary = Math.round((bruto - totalTaxes) * 100) / 100;

  return {
    inss,
    irrf,
    effectiveTaxRatePct,
    estimatedNetSalary,
  };
}

const QUICK_EXPENSE_CATEGORY_RULES: Array<{ pattern: RegExp; category: ExpenseItem['categoria'] }> = [
  { pattern: /mercado|almoco|almoço|jantar|lanche|restaurante|padaria|ifood|cafe|café|comida|feira|supermercado/i, category: 'Alimentação' },
  { pattern: /uber|99|gasolina|combustivel|combustível|onibus|ônibus|metro|metrô|estacionamento|pedagio/i, category: 'Transporte' },
  { pattern: /aluguel|condominio|condomínio|iptu/i, category: 'Moradia' },
  { pattern: /luz|energia|agua|água|gas|gás/i, category: 'Utilidades' },
  { pattern: /internet|celular|vivo|claro|tim/i, category: 'Conectividade' },
  { pattern: /farmacia|farmácia|remedio|remédio|medico|médico|dentista|exame|consulta/i, category: 'Saúde' },
  { pattern: /cinema|show|jogo|viagem|passeio|bar|lazer/i, category: 'Lazer' },
  { pattern: /netflix|spotify|assinatura|prime|youtube/i, category: 'Assinaturas' },
  { pattern: /curso|faculdade|escola|livro|livros|mensalidade|educacao|educação|aula|udemy|alura/i, category: 'Educação' },
  { pattern: /imprevisto|emergencia|emergência|multa|conserto|reparo|guincho|chaveiro/i, category: 'Imprevisto' },
];

function classifyQuickExpenseCategory(description: string): ExpenseItem['categoria'] {
  const matched = QUICK_EXPENSE_CATEGORY_RULES.find((r) => r.pattern.test(description));
  return matched ? matched.category : 'Outros';
}

function classifyQuickPaymentMethod(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('pix')) return 'Pix';
  if (/credito|crédito|cartao|cartão/.test(lower)) return 'Cartão de Crédito';
  if (/dinheiro|especie|espécie/.test(lower)) return 'Dinheiro';
  return 'Pix / Débito';
}

function parseMonetaryToken(rawNum: string): number {
  if (rawNum.includes(',')) {
    return parseFloat(rawNum.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d{1,3}(?:\.\d{3})+$/.test(rawNum)) {
    return parseFloat(rawNum.replace(/\./g, ''));
  }
  return parseFloat(rawNum);
}

/**
 * Parser de linguagem natural para lançamento rápido de despesas (Command Palette Ctrl+K).
 */
export function parseQuickExpenseCommand(text: string): {
  descricao: string;
  valor: number;
  categoria: ExpenseItem['categoria'];
  formaPagamento: string;
} | null {
  if (!text || typeof text !== 'string' || text.length > 500) return null;
  const trimmed = text.trim();
  const monetaryRegex = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi;

  const candidates: Array<{
    fullMatch: string;
    index: number;
    valor: number;
    hasDecimalOrCurrency: boolean;
  }> = [];

  for (const match of trimmed.matchAll(monetaryRegex)) {
    const rawNum = match[1];
    const valor = parseMonetaryToken(rawNum);
    if (Number.isFinite(valor) && valor > 0 && valor <= MAX_SAFE_MONEY && match.index !== undefined) {
      candidates.push({
        fullMatch: match[0],
        index: match.index,
        valor,
        hasDecimalOrCurrency: /[.,]|r\$/i.test(match[0]),
      });
    }
  }

  if (candidates.length === 0) return null;

  const decimalCandidates = candidates.filter((c) => c.hasDecimalOrCurrency);
  const chosen =
    decimalCandidates.length > 0
      ? decimalCandidates[decimalCandidates.length - 1]
      : candidates[candidates.length - 1];

  const withoutVal = (
    trimmed.slice(0, chosen.index) + trimmed.slice(chosen.index + chosen.fullMatch.length)
  )
    .replace(/\s+/g, ' ')
    .trim();

  const descClean = withoutVal
    .replace(/\b(pix|cartao|cartão|credito|crédito|debito|débito|dinheiro|no|na|via|em)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!descClean) return null;

  return {
    descricao: descClean.charAt(0).toUpperCase() + descClean.slice(1),
    valor: fromCents(toCents(chosen.valor)),
    categoria: classifyQuickExpenseCategory(descClean),
    formaPagamento: classifyQuickPaymentMethod(withoutVal),
  };
}

export interface PaydayConfig {
  tipo: 'quintoDiaUtil' | 'diaFixo' | 'dataExata';
  diaFixo: number;
  dataExata: string | null;
}

const FERIADOS_NACIONAIS = new Set(['0-1', '3-21', '4-1', '8-7', '9-12', '10-2', '10-15', '10-20', '11-25']);

function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

export function calcularQuintoDiaUtil(ano: number, mes: number): Date {
  const easter = calculateEasterSunday(ano);
  const goodFriday = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - 2);
  const goodFridayKey = `${goodFriday.getMonth()}-${goodFriday.getDate()}`;

  let uteis = 0;
  for (let dia = 1; dia <= 31; dia++) {
    const d = new Date(ano, mes, dia);
    if (d.getMonth() !== mes) break;
    const sem = d.getDay();
    const key = `${mes}-${dia}`;
    if (sem !== 0 && sem !== 6 && !FERIADOS_NACIONAIS.has(key) && key !== goodFridayKey) {
      uteis++;
      if (uteis === 5) return d;
    }
  }
  return new Date(ano, mes, 5);
}

export function getNextPaydayInfo(
  cfg: PaydayConfig,
  referenceDate: Date = new Date()
): { daysRemaining: number; formattedDate: string } {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  let target: Date | null = null;

  if (cfg.tipo === 'dataExata' && cfg.dataExata) {
    const parts = cfg.dataExata.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (d >= today) target = d;
  }

  if (!target && cfg.tipo === 'diaFixo') {
    const dia = cfg.diaFixo || 5;
    const thisMonth = clampDateToMonth(today.getFullYear(), today.getMonth(), dia);
    target = thisMonth > today ? thisMonth : clampDateToMonth(today.getFullYear(), today.getMonth() + 1, dia);
  }

  if (!target) {
    const thisMonthFifth = calcularQuintoDiaUtil(today.getFullYear(), today.getMonth());
    if (thisMonthFifth > today) {
      target = thisMonthFifth;
    } else {
      const nextM = (today.getMonth() + 1) % 12;
      const nextY = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
      target = calcularQuintoDiaUtil(nextY, nextM);
    }
  }

  const daysRemaining = Math.max(1, diffDaysUTC(today, target));
  const formattedDate = `${String(target.getDate()).padStart(2, '0')}/${String(target.getMonth() + 1).padStart(
    2,
    '0'
  )}/${target.getFullYear()}`;

  return { daysRemaining, formattedDate };
}

/**
 * Calcula a Diária Segura até o próximo pagamento em centavos exatos.
 */
export function calculateSafeDailyAllowance(params: {
  salarioLiquido: number;
  sobraPrevistaMes: number;
  saldoLivre: number;
  daysRemaining: number;
}): number {
  const salarioCents = Math.max(0, toCents(params.salarioLiquido));
  const sobraCents = Math.max(0, toCents(params.sobraPrevistaMes));
  const saldoLivreCents = Math.max(0, toCents(params.saldoLivre));
  const days = Math.max(1, Math.round(Number(params.daysRemaining) || 1));

  const baseCents = salarioCents > 0 ? Math.min(sobraCents, saldoLivreCents) : saldoLivreCents;
  return fromCents(Math.floor(baseCents / days));
}

export function matchesExpenseOriginBank(bank: BankAccount, expense: ExpenseItem): boolean {
  if (expense.contaOrigemId) return bank.id === expense.contaOrigemId;
  return Boolean(expense.contaOrigem && bank.nome === expense.contaOrigem);
}

export function executeGoalTransfer(
  bancos: BankAccount[],
  caixinhas: Caixinha[],
  caixinhaId: string,
  bankId: string,
  valor: number,
  mode: 'aporte' | 'withdraw'
): { bancos: BankAccount[]; caixinhas: Caixinha[]; effectiveValor: number } {
  const targetCx = caixinhas.find((c) => c.id === caixinhaId);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { bancos, caixinhas, effectiveValor: 0 };
  }
  const rawVal = fromCents(Math.max(0, toCents(valor)));
  if (!targetCx || !bankId || !bancos.some((b) => b.id === bankId) || !Number.isFinite(rawVal) || rawVal <= 0) {
    return { bancos, caixinhas, effectiveValor: 0 };
  }

  const maxSaldoCx = fromCents(Math.max(0, toCents(targetCx.saldo)));
  const effectiveValor = mode === 'withdraw' ? Math.min(rawVal, maxSaldoCx) : rawVal;
  if (effectiveValor <= 0) {
    return { bancos, caixinhas, effectiveValor: 0 };
  }

  const nextBancos = bancos.map((b) =>
    b.id === bankId
      ? {
          ...b,
          saldo:
            mode === 'aporte'
              ? applyExpensePaymentToAccount(b.saldo, effectiveValor)
              : refundExpensePaymentToAccount(b.saldo, effectiveValor),
        }
      : b
  );

  const nextCaixinhas = caixinhas.map((c) =>
    c.id === caixinhaId
      ? {
          ...c,
          saldo:
            mode === 'aporte'
              ? addMoney(c.saldo, effectiveValor)
              : Math.max(0, subMoney(c.saldo, effectiveValor)),
        }
      : c
  );

  return { bancos: nextBancos, caixinhas: nextCaixinhas, effectiveValor };
}

export function receiveSalary(
  bancos: BankAccount[],
  caixinhas: Caixinha[],
  netSalary: number,
  bankId: string,
  autoAportarCaixinhas: boolean
): { bancos: BankAccount[]; caixinhas: Caixinha[] } {
  if (!Number.isFinite(netSalary) || netSalary <= 0 || !bankId || !bancos.some((b) => b.id === bankId)) {
    return { bancos, caixinhas };
  }
  const liq = fromCents(Math.max(0, toCents(netSalary)));
  if (liq <= 0) return { bancos, caixinhas };

  const totalAportes = autoAportarCaixinhas
    ? sumMoney(caixinhas.map((c) => Math.max(0, Number(c.aporteMensal) || 0)))
    : 0;

  const netCredit = subMoney(liq, totalAportes);
  const nextBancos = bancos.map((b) =>
    b.id === bankId ? { ...b, saldo: addMoney(b.saldo, netCredit) } : b
  );

  const nextCaixinhas = autoAportarCaixinhas
    ? caixinhas.map((c) => ({
        ...c,
        saldo: addMoney(c.saldo, Math.max(0, Number(c.aporteMensal) || 0)),
      }))
    : caixinhas;

  return { bancos: nextBancos, caixinhas: nextCaixinhas };
}

export function payExpenseInList(
  bancos: BankAccount[],
  despesas: ExpenseItem[],
  expenseId: string,
  bankId: string | null,
  todayIso: string
): { bancos: BankAccount[]; despesas: ExpenseItem[]; target: ExpenseItem | null } {
  const target = despesas.find((d) => d.id === expenseId) || null;
  if (!target || target.paga) return { bancos, despesas, target: null };

  const bank = bankId ? bancos.find((b) => b.id === bankId) : null;
  const nextBancos = bankId
    ? bancos.map((b) => (b.id === bankId ? { ...b, saldo: applyExpensePaymentToAccount(b.saldo, target.valor) } : b))
    : bancos;

  const nextDespesas = despesas.map((d) =>
    d.id === expenseId
      ? {
          ...d,
          paga: true,
          dataPagamento: todayIso,
          contaOrigem: bank ? bank.nome : null,
          contaOrigemId: bank ? bank.id : null,
        }
      : d
  );

  return { bancos: nextBancos, despesas: nextDespesas, target };
}

function updateExpenseOriginBank(
  bancos: BankAccount[],
  expense: ExpenseItem,
  updater: (bank: BankAccount) => BankAccount
): BankAccount[] {
  const idx = bancos.findIndex((b) => matchesExpenseOriginBank(b, expense));
  if (idx === -1) return bancos;
  return bancos.map((b, i) => (i === idx ? updater(b) : b));
}

export function refundExpenseInList(
  bancos: BankAccount[],
  despesas: ExpenseItem[],
  expenseId: string
): { bancos: BankAccount[]; despesas: ExpenseItem[]; target: ExpenseItem | null } {
  const target = despesas.find((d) => d.id === expenseId) || null;
  if (!target || !target.paga) return { bancos, despesas, target: null };

  const nextBancos = updateExpenseOriginBank(bancos, target, (b) => ({
    ...b,
    saldo: refundExpensePaymentToAccount(b.saldo, target.valor),
  }));

  const nextDespesas = despesas.map((d) =>
    d.id === expenseId
      ? { ...d, paga: false, dataPagamento: null, contaOrigem: null, contaOrigemId: null }
      : d
  );

  return { bancos: nextBancos, despesas: nextDespesas, target };
}

export function editExpenseAmountInList(
  bancos: BankAccount[],
  despesas: ExpenseItem[],
  expenseId: string,
  newAmount: number
): { bancos: BankAccount[]; despesas: ExpenseItem[]; target: ExpenseItem | null; novoVal: number } {
  const target = despesas.find((d) => d.id === expenseId) || null;
  const novoVal = fromCents(Math.max(0, toCents(newAmount)));
  if (!target) return { bancos, despesas, target: null, novoVal };

  const diff = subMoney(novoVal, target.valor);
  const nextBancos =
    target.paga && diff !== 0
      ? updateExpenseOriginBank(bancos, target, (b) => ({
          ...b,
          saldo: subMoney(b.saldo, diff),
        }))
      : bancos;

  const nextDespesas = despesas.map((d) => (d.id === expenseId ? { ...d, valor: novoVal } : d));
  return { bancos: nextBancos, despesas: nextDespesas, target, novoVal };
}

export function deleteExpenseFromList(
  bancos: BankAccount[],
  despesas: ExpenseItem[],
  expenseId: string
): { bancos: BankAccount[]; despesas: ExpenseItem[]; target: ExpenseItem | null } {
  const target = despesas.find((d) => d.id === expenseId) || null;
  if (!target) return { bancos, despesas, target: null };

  const nextBancos = target.paga
    ? updateExpenseOriginBank(bancos, target, (b) => ({
        ...b,
        saldo: refundExpensePaymentToAccount(b.saldo, target.valor),
      }))
    : bancos;

  const nextDespesas = despesas.filter((d) => d.id !== expenseId);
  return { bancos: nextBancos, despesas: nextDespesas, target };
}

export function syncTemplatesToMonth(
  comp: string,
  currentList: ExpenseItem[],
  templates: RecurringExpenseTemplate[]
): { list: ExpenseItem[]; addedCount: number } {
  const activeTemplates = (templates || []).filter((m) => m.ativa !== false);
  const missing = activeTemplates
    .filter(
      (m) =>
        !currentList.some(
          (d) => d.moldeId === m.id || d.descricao.toLowerCase() === m.descricao.toLowerCase()
        )
    )
    .map((m, idx) => ({
      id: `d_${comp.replace('-', '')}_${m.id}_${idx}`,
      moldeId: m.id,
      descricao: m.descricao,
      valor: Number(m.valorPadrao) || 0,
      diaVencimento: Number(m.diaVencimento) || 10,
      categoria: m.categoria || 'Moradia',
      paga: false,
      dataPagamento: null,
      contaOrigem: null,
      contaOrigemId: null,
    }));

  return {
    list: [...currentList, ...missing],
    addedCount: missing.length,
  };
}

/**
 * Apple WWDC 2018 (Designing Fluid Interfaces) — Projeção de Momento por Decaimento Exponencial:
 * Calcula a distância projetada até o repouso com base na velocidade inicial do gesto (px/s).
 */
export function projectMomentum(initialVelocityPxPerSec: number, decelerationRate = 0.998): number {
  const v = Number.isFinite(initialVelocityPxPerSec) ? initialVelocityPxPerSec : 0;
  const d = Math.max(0.8, Math.min(0.9995, Number(decelerationRate) || 0.998));
  return ((v / 1000) * d) / (1 - d);
}

/**
 * Apple WWDC 2018 — Rubber-banding (resistência elástica progressiva nas bordas):
 * Quanto mais além do limite o usuário arrasta, menor o deslocamento resultante.
 */
export function rubberbandOffset(overshoot: number, dimension: number, constant = 0.55): number {
  const ov = Number.isFinite(overshoot) ? overshoot : 0;
  const dim = Math.max(1, Number(dimension) || 400);
  const c = Math.max(0.05, Math.min(1, Number(constant) || 0.55));
  if (ov === 0) return 0;
  return (ov * dim * c) / (dim + c * Math.abs(ov));
}

/**
 * Decide se um modal/sheet arrastado deve fechar ou retornar à origem,
 * respeitando o sinal da velocidade no instante da soltura e a projeção de momento.
 */
export function shouldDismissSheetOnRelease(
  dragOffsetY: number,
  velocityY: number,
  thresholdPx = 110
): boolean {
  if (velocityY < -80) return false;
  const projectedEndpoint = dragOffsetY + projectMomentum(velocityY, 0.99);
  return projectedEndpoint >= thresholdPx;
}

/**
 * Soma em centavos exatos as receitas avulsas de uma competência.
 * Quando `onlyReceived` é true, considera apenas as receitas já marcadas como recebidas.
 */
export function sumMonthlyExtraIncome(
  receitas: ExtraIncomeItem[] | undefined,
  onlyReceived = false
): number {
  if (!Array.isArray(receitas) || receitas.length === 0) return 0;
  const values: number[] = [];
  for (const r of receitas) {
    if (!r || (onlyReceived && !r.recebida)) continue;
    const val = Number(r.valor);
    if (Number.isFinite(val) && val > 0) {
      values.push(val);
    }
  }
  return sumMoney(values);
}

/**
 * Gera despesas parceladas multi-mês com divisão exata em centavos.
 * Qualquer resto da divisão inteira é alocado na 1ª parcela para garantir
 * que a soma das parcelas seja exatamente igual a `valorTotal`.
 */
export function generateInstallmentExpenses(params: {
  baseId: string;
  descricao: string;
  valorTotal: number;
  totalParcelas: number;
  competenciaInicial: string;
  categoria: string;
  vencimentoDia: number;
  natureza?: 'essencial' | 'estilo_vida';
  contaOrigemId?: string | null;
  contaOrigem?: string;
}): Record<string, ExpenseItem[]> {
  const valorTotal = Number(params.valorTotal);
  if (!Number.isFinite(valorTotal) || valorTotal <= 0 || valorTotal > MAX_SAFE_MONEY) {
    return {};
  }
  const totalCents = toCents(valorTotal);
  const rawN = Math.trunc(Number(params.totalParcelas));
  if (totalCents <= 0 || !Number.isFinite(rawN) || rawN < 1) {
    return {};
  }
  const n = Math.min(MAX_INSTALLMENTS, rawN);

  const compMatch = /^(\d{4})-(\d{2})$/.exec(params.competenciaInicial);
  if (!compMatch) return {};
  const startYear = parseInt(compMatch[1], 10);
  const startMonth = parseInt(compMatch[2], 10);
  if (startMonth < 1 || startMonth > 12) return {};

  const baseCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - baseCents * n;
  const diaVencimento = Math.max(1, Math.min(31, Math.trunc(Number(params.vencimentoDia) || 10)));

  const result: Record<string, ExpenseItem[]> = {};
  for (let i = 0; i < n; i++) {
    const parcelaAtual = i + 1;
    const totalMonths = startYear * 12 + (startMonth - 1) + i;
    const year = Math.floor(totalMonths / 12);
    const month = (totalMonths % 12) + 1;
    const compKey = `${year}-${String(month).padStart(2, '0')}`;
    const parcelaCents = i === 0 ? baseCents + remainderCents : baseCents;

    const item: ExpenseItem = {
      id: `${params.baseId}_p${parcelaAtual}`,
      moldeId: null,
      descricao: `${params.descricao} (${parcelaAtual}/${n})`,
      valor: fromCents(parcelaCents),
      diaVencimento,
      paga: false,
      categoria: params.categoria as ExpenseItem['categoria'],
      ...(params.natureza ? { natureza: params.natureza } : {}),
      dataPagamento: null,
      contaOrigem: params.contaOrigem ?? null,
      contaOrigemId: params.contaOrigemId ?? null,
      parcelaAtual,
      totalParcelas: n,
      grupoParcelamentoId: params.baseId,
    };

    if (!result[compKey]) {
      result[compKey] = [];
    }
    result[compKey].push(item);
  }

  return result;
}

/**
 * Simula a quitação de dívidas mês a mês com juros compostos mensais,
 * comparando estratégias Avalanche (maior taxa primeiro) e Bola de Neve (menor saldo primeiro).
 * Aplica efeito bola de neve: parcelas mínimas liberadas de dívidas quitadas somam-se ao aporte extra.
 */
export function simulateDebtPayoff(
  debts: DebtItem[],
  extraMonthlyPayment: number,
  strategy: 'avalanche' | 'snowball'
): { months: number; totalInterestPaid: number; totalPaid: number; order: string[] } {
  const MAX_MONTHS = 600;
  const activeDebts = (debts || [])
    .map((d) => {
      const balanceCents = Math.max(0, toCents(d.saldoDevedor));
      const monthlyRate = Math.max(0, Number.isFinite(d.taxaJurosMensal) ? d.taxaJurosMensal : 0) / 100;
      const rawMinCents = toCents(d.parcelaMinima);
      const minPaymentCents =
        rawMinCents > 0
          ? rawMinCents
          : Math.max(100, Math.round(balanceCents * (monthlyRate + 0.02)));
      return {
        id: d.id,
        balanceCents,
        monthlyRate,
        minPaymentCents,
        paidOff: false,
      };
    })
    .filter((d) => d.balanceCents > 0);

  if (activeDebts.length === 0) {
    return { months: 0, totalInterestPaid: 0, totalPaid: 0, order: [] };
  }

  const extraCents = Math.max(0, toCents(extraMonthlyPayment));
  const totalBudgetCents =
    activeDebts.reduce((acc, d) => acc + d.minPaymentCents, 0) + extraCents;

  let months = 0;
  let totalInterestCents = 0;
  let totalPaidCents = 0;
  const order: string[] = [];

  for (let m = 1; m <= MAX_MONTHS; m++) {
    const remaining = activeDebts.filter((d) => d.balanceCents > 0);
    if (remaining.length === 0) break;

    months = m;

    // 1. Aplica juros compostos mensais sobre os saldos devedores ativos
    for (const d of remaining) {
      const interestCents = Math.round(d.balanceCents * d.monthlyRate);
      d.balanceCents += interestCents;
      totalInterestCents += interestCents;
    }

    // 2. Ordena dívidas ativas conforme estratégia escolhida
    const sorted = [...remaining].sort((a, b) => {
      if (strategy === 'avalanche') {
        return b.monthlyRate - a.monthlyRate || a.balanceCents - b.balanceCents;
      }
      return a.balanceCents - b.balanceCents || b.monthlyRate - a.monthlyRate;
    });

    let availableBudget = totalBudgetCents;

    // 3. Paga a parcela mínima de cada dívida ativa
    for (const d of sorted) {
      if (availableBudget <= 0) break;
      const pay = Math.min(d.balanceCents, d.minPaymentCents, availableBudget);
      d.balanceCents -= pay;
      totalPaidCents += pay;
      availableBudget -= pay;
      if (d.balanceCents === 0 && !d.paidOff) {
        d.paidOff = true;
        order.push(d.id);
      }
    }

    // 4. Direciona o excedente (aporte extra + bola de neve de dívidas já quitadas) para a prioritária
    for (const d of sorted) {
      if (availableBudget <= 0) break;
      if (d.balanceCents <= 0) continue;
      const pay = Math.min(d.balanceCents, availableBudget);
      d.balanceCents -= pay;
      totalPaidCents += pay;
      availableBudget -= pay;
      if (d.balanceCents === 0 && !d.paidOff) {
        d.paidOff = true;
        order.push(d.id);
      }
    }

    if (activeDebts.every((d) => d.balanceCents === 0)) {
      break;
    }
  }

  return {
    months,
    totalInterestPaid: fromCents(totalInterestCents),
    totalPaid: fromCents(totalPaidCents),
    order,
  };
}

export interface CategoryBreakdownItem {
  categoria: string;
  valor: number;
  percentual: number;
  count: number;
  isEssential: boolean;
}

/**
 * Agrupa despesas em centavos exatos por categoria, ordena por valor decrescente
 * e calcula a participação percentual (0–100 com 1 casa decimal) para gráficos SVG.
 */
export function calculateCategoryBreakdown(expenses: ExpenseItem[]): CategoryBreakdownItem[] {
  if (!Array.isArray(expenses) || expenses.length === 0) return [];

  const buckets = new Map<
    string,
    { cents: number; count: number; essentialCents: number }
  >();
  let totalCents = 0;

  for (const exp of expenses) {
    if (!exp || typeof exp !== 'object') continue;
    const valCents = Math.max(0, toCents(exp.valor));
    if (valCents <= 0) continue;

    const cat = String(exp.categoria || 'Outros').trim() || 'Outros';
    const essential = isEssentialCategory(cat as ExpenseItem['categoria'], exp.natureza);
    const existing = buckets.get(cat);

    if (existing) {
      existing.cents += valCents;
      existing.count += 1;
      if (essential) existing.essentialCents += valCents;
    } else {
      buckets.set(cat, {
        cents: valCents,
        count: 1,
        essentialCents: essential ? valCents : 0,
      });
    }
    totalCents += valCents;
  }

  if (totalCents <= 0 || buckets.size === 0) return [];

  return Array.from(buckets.entries())
    .sort((a, b) => b[1].cents - a[1].cents || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([categoria, bucket]) => {
      const isEssential =
        bucket.essentialCents === bucket.cents
          ? true
          : bucket.essentialCents === 0
            ? false
            : bucket.essentialCents >= bucket.cents / 2;

      return {
        categoria,
        valor: fromCents(bucket.cents),
        percentual: Math.round((bucket.cents / totalCents) * 1000) / 10,
        count: bucket.count,
        isEssential,
      };
    });
}

export interface FireCurvePoint {
  year: number;
  totalInvested: number;
  totalCompound: number;
}

/**
 * Gera curva patrimonial anual (year: 0..N, N limitado a [1, 50], padrão 20 anos,
 * taxa real padrão 5% a.a. composta mensalmente) comparando capital investido vs juros compostos.
 */
export function generateFireWealthCurve(params: {
  currentPatrimony: number;
  monthlyContribution: number;
  annualRealRatePct?: number;
  years?: number;
}): FireCurvePoint[] {
  const pvCents = Math.max(0, toCents(params.currentPatrimony));
  const pmtCents = Math.max(0, toCents(params.monthlyContribution));
  const pv = fromCents(pvCents);
  const pmt = fromCents(pmtCents);

  const rawYears = params.years === undefined ? 20 : Number(params.years);
  const totalYears = Number.isFinite(rawYears)
    ? Math.max(1, Math.min(50, Math.trunc(Math.round(rawYears))))
    : 20;

  const rawRate = params.annualRealRatePct === undefined ? 5 : Number(params.annualRealRatePct);
  const safeAnnualRatePct = Number.isFinite(rawRate) ? Math.max(0, Math.min(100, rawRate)) : 5;
  const monthlyRate = annualToMonthlyRate(safeAnnualRatePct);

  const points: FireCurvePoint[] = [];
  for (let year = 0; year <= totalYears; year++) {
    const months = year * 12;
    const totalInvested = fromCents(
      Math.min(MAX_SAFE_MONEY * 100, pvCents + pmtCents * months)
    );

    if (year === 0 || monthlyRate <= 0) {
      points.push({
        year,
        totalInvested,
        totalCompound: totalInvested,
      });
      continue;
    }

    const factor = Math.pow(1 + monthlyRate, months);
    const rawCompound = pv * factor + pmt * ((factor - 1) / monthlyRate);
    const clampedCompound = Number.isFinite(rawCompound)
      ? Math.min(MAX_SAFE_MONEY, Math.max(totalInvested, rawCompound))
      : MAX_SAFE_MONEY;

    points.push({
      year,
      totalInvested,
      totalCompound: Math.round(clampedCompound * 100) / 100,
    });
  }

  return points;
}

export type ExpenseDueStatus = 'paga' | 'vencida' | 'vence_breve' | 'no_prazo';

/**
 * Classifica o status de vencimento de uma despesa na competência informada
 * comparando dias civis sem interferência de fuso horário / horário de verão.
 */
export function classifyExpenseDueStatus(
  expense: Pick<ExpenseItem, 'paga' | 'diaVencimento'>,
  competencia: string,
  today: Date = new Date()
): ExpenseDueStatus {
  if (expense.paga) return 'paga';

  const refDate =
    today instanceof Date && Number.isFinite(today.getTime()) ? today : new Date();
  const compMatch = /^(\d{4})-(\d{2})$/.exec(String(competencia || '').trim());
  const year = compMatch ? parseInt(compMatch[1], 10) : refDate.getFullYear();
  const parsedMonth = compMatch ? parseInt(compMatch[2], 10) : refDate.getMonth() + 1;
  const monthZeroBased =
    parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth - 1 : refDate.getMonth();

  const dueDate = clampDateToMonth(year, monthZeroBased, expense.diaVencimento);
  const daysUntilDue = diffDaysUTC(refDate, dueDate);

  if (daysUntilDue < 0) return 'vencida';
  if (daysUntilDue <= 3) return 'vence_breve';
  return 'no_prazo';
}
