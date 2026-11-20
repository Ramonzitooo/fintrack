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
    | 'Outros';
  natureza?: 'essencial' | 'estilo_vida';
  dataPagamento: string | null;
  contaOrigem: string | null;
  contaOrigemId?: string | null;
  formaPagamento?: string;
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
 * Motor de Aritmética Inteira em Centavos (Cents Engine):
 * Elimina desvios de ponto flutuante binário IEEE 754 (ex: 0.1 + 0.2 = 0.30000000000000004)
 * convertendo valores monetários para inteiros de centavos antes de somar ou subtrair.
 */
export function toCents(value: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const cents = Math.round(num * 100);
  return cents === 0 ? 0 : cents;
}

export function fromCents(cents: number): number {
  const intCents = Math.round(Number(cents) || 0);
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
      totalInterestEarned: Math.max(0, fv - pv),
    };
  }

  const num = fv * r + pmt;
  const den = pv * r + pmt;
  const nExact = Math.log(num / den) / Math.log(1 + r);
  const monthsCompound = Math.max(1, Math.ceil(nExact));
  const monthsSavedByInterest = Number.isFinite(monthsLinear)
    ? Math.max(0, monthsLinear - monthsCompound)
    : 0;

  // Simula evolução mês a mês para achar o total exato de juros ganhos até atingir a meta
  let simBalance = pv;
  let totalContributed = 0;
  for (let m = 0; m < monthsCompound; m++) {
    simBalance = simBalance * (1 + r) + pmt;
    totalContributed += pmt;
  }
  const totalInterestEarned = Math.max(0, Math.round((simBalance - pv - totalContributed) * 100) / 100);

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
  const monthsWithExtra = calcMonths(pmt + 200);

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
 * - Necessidades Essenciais (50%): Moradia, Alimentação, Saúde, Transporte, Utilidades, Conectividade, Educação
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
    statementCloseDate = new Date(year, month + 1, closingDay);
  } else {
    // Fatura deste mês ainda está aberta -> fecha neste mês
    statementCloseDate = new Date(year, month, closingDay);
  }

  // Determina a data de vencimento associada a esse fechamento
  let statementDueDate: Date;
  if (dueDay > closingDay) {
    statementDueDate = new Date(statementCloseDate.getFullYear(), statementCloseDate.getMonth(), dueDay);
  } else {
    // Vence no mês subsequente ao fechamento (ex: fecha dia 25, vence dia 05)
    statementDueDate = new Date(statementCloseDate.getFullYear(), statementCloseDate.getMonth() + 1, dueDay);
  }

  const diffMs = statementDueDate.getTime() - today.getTime();
  const daysToPay = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

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
  const price = Math.max(0, Number(nominalPrice) || 0);
  const discPct = Math.max(0, Math.min(99, Number(cashDiscountPct) || 0));
  const n = Math.max(1, Math.round(Number(installments) || 1));
  const r = Math.max(0, Number(monthlyNetYieldPct) || 0) / 100;

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
    const yieldMonth = saldoCDI * r;
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
  const bruto = Math.max(0, Number(grossSalary) || 0);
  if (bruto <= 0) {
    return { inss: 0, irrf: 0, effectiveTaxRatePct: 0, estimatedNetSalary: 0 };
  }

  // Faixas progressivas do INSS (referência atualizada CLT)
  const bracketsINSS = [
    { limit: 1518.0, rate: 0.075 },
    { limit: 2793.88, rate: 0.09 },
    { limit: 4190.83, rate: 0.12 },
    { limit: 8157.41, rate: 0.14 },
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
  const legalDeduction = inss + Math.max(0, dependents) * 189.59;
  const simplifiedDiscount = 607.2;
  const bestDeduction = Math.max(legalDeduction, simplifiedDiscount);
  const baseIR = Math.max(0, bruto - bestDeduction);

  let irrf = 0;
  if (baseIR <= 2428.8) {
    irrf = 0;
  } else if (baseIR <= 2826.65) {
    irrf = baseIR * 0.075 - 182.16;
  } else if (baseIR <= 3751.05) {
    irrf = baseIR * 0.15 - 394.16;
  } else if (baseIR <= 4664.68) {
    irrf = baseIR * 0.225 - 675.49;
  } else {
    irrf = baseIR * 0.275 - 908.73;
  }
  irrf = Math.max(0, Math.round(irrf * 100) / 100);

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

/**
 * Parser de linguagem natural para lançamento rápido de despesas (Command Palette Ctrl+K).
 */
export function parseQuickExpenseCommand(text: string): {
  descricao: string;
  valor: number;
  categoria: ExpenseItem['categoria'];
  formaPagamento: string;
} | null {
  if (!text || typeof text !== 'string') return null;
  const valMatch = text.trim().match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  if (!valMatch) return null;

  const valor = parseFloat(valMatch[1].replace(',', '.'));
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const withoutVal = text.replace(valMatch[0], '').replace(/\s+/g, ' ').trim();
  const descClean = withoutVal
    .replace(/\b(pix|cartao|cartão|credito|crédito|debito|débito|dinheiro|no|na|via|em)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!descClean) return null;

  return {
    descricao: descClean.charAt(0).toUpperCase() + descClean.slice(1),
    valor: Math.round(valor * 100) / 100,
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

export function calcularQuintoDiaUtil(ano: number, mes: number): Date {
  let uteis = 0;
  for (let dia = 1; dia <= 31; dia++) {
    const d = new Date(ano, mes, dia);
    if (d.getMonth() !== mes) break;
    const sem = d.getDay();
    if (sem !== 0 && sem !== 6 && !FERIADOS_NACIONAIS.has(`${mes}-${dia}`)) {
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
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), dia);
    target = thisMonth > today ? thisMonth : new Date(today.getFullYear(), today.getMonth() + 1, dia);
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

  const diffMs = target.getTime() - today.getTime();
  const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const formattedDate = `${String(target.getDate()).padStart(2, '0')}/${String(target.getMonth() + 1).padStart(
    2,
    '0'
  )}/${target.getFullYear()}`;

  return { daysRemaining, formattedDate };
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
  const rawVal = fromCents(Math.max(0, toCents(valor)));
  if (!targetCx || rawVal <= 0) {
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

export function refundExpenseInList(
  bancos: BankAccount[],
  despesas: ExpenseItem[],
  expenseId: string
): { bancos: BankAccount[]; despesas: ExpenseItem[]; target: ExpenseItem | null } {
  const target = despesas.find((d) => d.id === expenseId) || null;
  if (!target || !target.paga) return { bancos, despesas, target: null };

  const nextBancos = bancos.map((b) =>
    matchesExpenseOriginBank(b, target) ? { ...b, saldo: refundExpensePaymentToAccount(b.saldo, target.valor) } : b
  );

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
      ? bancos.map((b) =>
          matchesExpenseOriginBank(b, target) ? { ...b, saldo: subMoney(b.saldo, diff) } : b
        )
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
    ? bancos.map((b) =>
        matchesExpenseOriginBank(b, target) ? { ...b, saldo: refundExpensePaymentToAccount(b.saldo, target.valor) } : b
      )
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

