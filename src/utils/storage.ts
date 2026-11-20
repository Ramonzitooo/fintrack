import {
  BankAccount,
  Caixinha,
  CreditCard,
  DebtItem,
  ExpenseItem,
  PayrollItem,
  RecurringExpenseTemplate,
} from './financeMath';

export const STORAGE_KEY = 'APP_FINANCEIRO_V2_DATA';

export interface HistoricalPayroll {
  id: string;
  competencia: string;
  mesLabel: string;
  proventos: { id?: string; nome: string; valor: number }[];
  descontos: { id?: string; nome: string; valor: number }[];
  bruto: number;
  descontosTotal: number;
  liquido: number;
}

export interface EnvelopeConfig {
  total: number;
  cadencia: 'semanal' | 'quinzenal' | 'mensal' | 'fds';
}

export interface AppState {
  salario: {
    proventos: PayrollItem[];
    descontos: PayrollItem[];
    bruto: number;
    descontosTotal: number;
    liquido: number;
  };
  historicoContracheques: HistoricalPayroll[];
  bancos: BankAccount[];
  caixinhas: Caixinha[];
  cartoes: CreditCard[];
  dividas: DebtItem[];
  competenciaAtual: string;
  despesasFixasMolde: RecurringExpenseTemplate[];
  despesasPorMes: Record<string, ExpenseItem[]>;
  configPagamento: {
    tipo: 'quintoDiaUtil' | 'diaFixo' | 'dataExata';
    diaFixo: number;
    dataExata: string | null;
  };
  envelopes: {
    supermercado: EnvelopeConfig;
    lazer: EnvelopeConfig;
    combustivel: EnvelopeConfig;
  };
  configuracoes: {
    taxaCdiAnual: number;
    swrAnualPct: number;
    jurosReaisAnualPct: number;
  };
}

export const DEFAULT_STATE: AppState = {
  salario: {
    proventos: [],
    descontos: [],
    bruto: 0,
    descontosTotal: 0,
    liquido: 0,
  },
  historicoContracheques: [],
  bancos: [],
  caixinhas: [],
  cartoes: [],
  dividas: [],
  competenciaAtual: new Date().toISOString().slice(0, 7),
  despesasFixasMolde: [],
  despesasPorMes: {},
  configPagamento: {
    tipo: 'quintoDiaUtil',
    diaFixo: 5,
    dataExata: null,
  },
  envelopes: {
    supermercado: { total: 0, cadencia: 'semanal' },
    lazer: { total: 0, cadencia: 'fds' },
    combustivel: { total: 0, cadencia: 'semanal' },
  },
  configuracoes: {
    taxaCdiAnual: 10.75,
    swrAnualPct: 4.0,
    jurosReaisAnualPct: 5.0,
  },
};

export function safeJsonParse(jsonString: string): any {
  return JSON.parse(jsonString, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}

/**
 * Sanitiza célula individual de CSV contra Injeção de Fórmulas (CWE-1236)
 * e escapa aspas duplas internas conforme RFC 4180.
 */
export function sanitizeCsvCell(val: unknown): string {
  let str = String(val ?? '').replace(/\r?\n|\r/g, ' ').trim();
  if (/^[=+\-@\t\r|]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = safeJsonParse(raw);
    return normalizeState(parsed);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Erro ao salvar estado no localStorage:', e);
  }
}

function extractSourcePayload(raw: any): any {
  if (raw.schemaVersion !== '3.4') return raw;
  return {
    bancos: raw.contasBancarias,
    caixinhas: raw.caixinhasEReservas,
    cartoes: raw.cartoesCredito,
    salario: raw.salarioEContracheque?.salarioAtual,
    historicoContracheques: raw.salarioEContracheque?.historicoContracheques,
    despesasFixasMolde: raw.despesasFixasRecorrentes,
    despesasPorMes: raw.despesasPorCompetencia,
    envelopes: raw.envelopesOrcamentarios,
    competenciaAtual: raw.configuracoes?.competenciaAtual,
    configPagamento: raw.configuracoes?.configPagamento,
    configuracoes: raw.configuracoes,
  };
}

function parseBanks(rawBancos: unknown, fallback: BankAccount[]): BankAccount[] {
  if (!Array.isArray(rawBancos)) return fallback;
  return rawBancos.map((b: any, i: number) => {
    const rendeJuros = Boolean(b.rendeJuros);
    return {
      id: String(b.id || `b_${i + 1}`),
      nome: String(b.nome || 'Conta'),
      tipo: b.tipo || 'Conta Digital',
      saldo: Number(b.saldo) || 0,
      rendeJuros,
      pctCDI: Number(b.pctCDI) || (rendeJuros ? 100 : 0),
    };
  });
}

function parseCaixinhas(rawCaixinhas: unknown, fallback: Caixinha[]): Caixinha[] {
  if (!Array.isArray(rawCaixinhas)) return fallback;
  return rawCaixinhas.map((c: any, i: number) => ({
    id: String(c.id || `cx_${i + 1}`),
    nome: String(c.nome || 'Caixinha'),
    saldo: Number(c.saldo) || 0,
    aporteMensal: Number(c.aporteMensal) || 0,
    meta: Number(c.meta) || 0,
    tipo: c.tipo || 'outros',
    instituicao: String(c.instituicao || 'Banco'),
    pctCDI: Number(c.pctCDI) || 100,
  }));
}

function parseCartoes(rawCartoes: unknown, fallback: CreditCard[]): CreditCard[] {
  if (!Array.isArray(rawCartoes)) return fallback;
  return rawCartoes.map((c: any, i: number) => ({
    id: String(c.id || `c_${i + 1}`),
    nome: String(c.nome || 'Cartão'),
    diaCorte: Number(c.diaCorte) || 10,
    diaVencimento: Number(c.diaVencimento) || 17,
    beneficio: c.beneficio || 'SemAnuidade',
    limiteTotal: Number(c.limiteTotal) || 5000,
    faturaAtual: Number(c.faturaAtual) || 0,
  }));
}

function parseDividas(rawDividas: unknown, fallback: DebtItem[]): DebtItem[] {
  if (!Array.isArray(rawDividas)) return fallback;
  return rawDividas.map((d: any, i: number) => ({
    id: String(d.id || `div_${i + 1}`),
    nome: String(d.nome || 'Dívida'),
    saldoDevedor: Math.max(0, Number(d.saldoDevedor) || 0),
    taxaJurosMensal: Math.max(0, Number(d.taxaJurosMensal) || 0),
    parcelaMinima: Math.max(0, Number(d.parcelaMinima) || 0),
  }));
}

function parsePayrollItems(rawItems: unknown, prefix: string, defaultLabel: string, fallback: PayrollItem[]): PayrollItem[] {
  if (!Array.isArray(rawItems)) return fallback;
  return rawItems.map((item: any, idx: number) => ({
    id: String(item.id || `${prefix}_${idx + 1}`),
    nome: String(item.nome || item.descricao || defaultLabel),
    valor: Math.max(0, Number(item.valor) || 0),
  }));
}

function parseSalario(rawSalario: any, fallback: AppState['salario']): AppState['salario'] {
  if (!rawSalario || typeof rawSalario !== 'object') return fallback;
  const proventos = parsePayrollItems(rawSalario.proventos, 'p', 'Provento', fallback.proventos);
  const descontos = parsePayrollItems(rawSalario.descontos, 'd', 'Desconto', fallback.descontos);
  const bruto = proventos.reduce((s, p) => s + p.valor, 0);
  const descontosTotal = descontos.reduce((s, d) => s + d.valor, 0);
  return {
    proventos,
    descontos,
    bruto,
    descontosTotal,
    liquido: Math.max(0, bruto - descontosTotal),
  };
}

function parseDespesasMolde(
  rawMolde: unknown,
  fallback: RecurringExpenseTemplate[]
): RecurringExpenseTemplate[] {
  if (!Array.isArray(rawMolde)) return fallback;
  return rawMolde.map((m: any, i: number) => ({
    id: String(m.id || `m_${i + 1}`),
    descricao: String(m.descricao || 'Despesa Fixa'),
    valorPadrao: Math.max(0, Number(m.valorPadrao) || 0),
    diaVencimento: Math.min(31, Math.max(1, Number(m.diaVencimento) || 10)),
    categoria: m.categoria || 'Moradia',
    ativa: m.ativa !== false,
  }));
}

function parseSingleExpenseItem(d: any, compKey: string, idx: number): ExpenseItem {
  return {
    id: String(d.id || `d_${compKey.replace('-', '')}_${idx + 1}`),
    moldeId: d.moldeId ? String(d.moldeId) : null,
    descricao: String(d.descricao || 'Despesa'),
    valor: Math.max(0, Number(d.valor) || 0),
    diaVencimento: Math.min(31, Math.max(1, Number(d.diaVencimento) || 10)),
    paga: Boolean(d.paga),
    categoria: d.categoria || 'Outros',
    natureza: d.natureza,
    dataPagamento: d.dataPagamento ? String(d.dataPagamento) : null,
    contaOrigem: d.contaOrigem ? String(d.contaOrigem) : null,
    contaOrigemId: d.contaOrigemId ? String(d.contaOrigemId) : null,
    formaPagamento: d.formaPagamento ? String(d.formaPagamento) : undefined,
  };
}

function parseDespesasPorMes(
  rawMeses: any,
  fallback: Record<string, ExpenseItem[]>
): Record<string, ExpenseItem[]> {
  if (!rawMeses || typeof rawMeses !== 'object') return fallback;
  const cleanMes: Record<string, ExpenseItem[]> = {};
  for (const [k, list] of Object.entries(rawMeses)) {
    if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(list)) {
      cleanMes[k] = list.map((d: any, idx: number) => parseSingleExpenseItem(d, k, idx));
    }
  }
  return Object.keys(cleanMes).length > 0 ? cleanMes : fallback;
}

function parseConfigPagamento(
  rawCfg: any,
  fallback: AppState['configPagamento']
): AppState['configPagamento'] {
  if (!rawCfg || typeof rawCfg !== 'object') return fallback;
  const tipoValido: AppState['configPagamento']['tipo'] = ['quintoDiaUtil', 'diaFixo', 'dataExata'].includes(rawCfg.tipo)
    ? rawCfg.tipo
    : 'quintoDiaUtil';
  return {
    tipo: tipoValido,
    diaFixo: Math.min(31, Math.max(1, Number(rawCfg.diaFixo) || 5)),
    dataExata: rawCfg.dataExata ? String(rawCfg.dataExata) : null,
  };
}

function parseConfiguracoes(
  rawConfig: any,
  fallback: AppState['configuracoes']
): AppState['configuracoes'] {
  if (!rawConfig || typeof rawConfig !== 'object') return fallback;
  return {
    taxaCdiAnual: Number(rawConfig.taxaCdiAnual) || 10.75,
    swrAnualPct: Number(rawConfig.swrAnualPct) || 4.0,
    jurosReaisAnualPct: Number(rawConfig.jurosReaisAnualPct) || 5.0,
  };
}

export function normalizeState(raw: any): AppState {
  const base = structuredClone(DEFAULT_STATE);
  if (!raw || typeof raw !== 'object') return base;

  const src = extractSourcePayload(raw);

  base.bancos = parseBanks(src.bancos, base.bancos);
  base.caixinhas = parseCaixinhas(src.caixinhas, base.caixinhas);
  base.cartoes = parseCartoes(src.cartoes, base.cartoes);
  base.dividas = parseDividas(src.dividas, base.dividas);
  base.salario = parseSalario(src.salario, base.salario);

  if (Array.isArray(src.historicoContracheques)) {
    base.historicoContracheques = src.historicoContracheques;
  }
  if (typeof src.competenciaAtual === 'string' && /^\d{4}-\d{2}$/.test(src.competenciaAtual)) {
    base.competenciaAtual = src.competenciaAtual;
  }

  base.despesasFixasMolde = parseDespesasMolde(src.despesasFixasMolde, base.despesasFixasMolde);
  base.despesasPorMes = parseDespesasPorMes(src.despesasPorMes, base.despesasPorMes);
  base.configPagamento = parseConfigPagamento(src.configPagamento, base.configPagamento);

  if (src.envelopes && typeof src.envelopes === 'object') {
    base.envelopes = {
      supermercado: src.envelopes.supermercado || base.envelopes.supermercado,
      lazer: src.envelopes.lazer || base.envelopes.lazer,
      combustivel: src.envelopes.combustivel || base.envelopes.combustivel,
    };
  }

  base.configuracoes = parseConfiguracoes(src.configuracoes, base.configuracoes);

  return base;
}

export function fmtBRL(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatMonthYear(compKey: string): string {
  if (!compKey) return '';
  const parts = compKey.split('-');
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const names = [
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
  return `${names[monthIdx] || compKey} de ${year}`;
}
