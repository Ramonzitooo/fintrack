import {
  BankAccount,
  Caixinha,
  CreditCard,
  DebtItem,
  ExpenseItem,
  ExtraIncomeItem,
  MAX_INSTALLMENTS,
  MAX_SAFE_MONEY,
  PayrollItem,
  RecurringExpenseTemplate,
} from './financeMath';

export const STORAGE_KEY = 'APP_FINANCEIRO_V2_DATA';
export const MAX_BACKUP_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_COLLECTION_ITEMS = 2000;
export const MAX_STRING_LEN = 300;
const MAX_MONTH_BUCKETS = 240;

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
  receitasPorMes: Record<string, ExtraIncomeItem[]>;
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

export function getLocalMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  competenciaAtual: getLocalMonthKey(),
  despesasFixasMolde: [],
  despesasPorMes: {},
  receitasPorMes: {},
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
 * Sanitiza célula individual de CSV contra Injeção de Fórmulas (CWE-1236),
 * removendo caracteres de controle C0/C1 e Bidi overrides (bloqueando bypass
 * como "\x01=CMD|' /C calc'!A0") e quebras de linha antes de testar prefixos,
 * além de escapar aspas duplas internas conforme RFC 4180.
 */
export function sanitizeCsvCell(val: unknown): string {
  let str = String(val ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u202A-\u202E\u2066-\u2069\u061C]+/g, '')
    .replace(/\r?\n|\r/g, ' ')
    .trim();
  if (/^[=+\-@\t\r|]/.test(str)) {
    str = `'${str}`;
  }
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export type LoadAppStateStatus = 'ok' | 'empty' | 'vault_locked' | 'corrupt';

export interface LoadAppStateResult {
  state: AppState;
  status: LoadAppStateStatus;
  error?: string;
}

export function isVaultPayload(obj: unknown): boolean {
  return Boolean(obj && typeof obj === 'object' && (obj as Record<string, unknown>).__vault === true);
}

export function safeGetStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadAppStateDetailed(): LoadAppStateResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return {
      state: structuredClone(DEFAULT_STATE),
      status: 'corrupt',
      error: e instanceof Error ? e.message : 'Erro ao acessar armazenamento local.',
    };
  }

  if (!raw) {
    return { state: structuredClone(DEFAULT_STATE), status: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = safeJsonParse(raw);
  } catch (e) {
    try {
      localStorage.setItem(`${STORAGE_KEY}_corrupt_backup`, raw);
    } catch {
      // Ignora falha ao gravar backup de diagnóstico (ex: QuotaExceededError)
    }
    return {
      state: structuredClone(DEFAULT_STATE),
      status: 'corrupt',
      error: e instanceof Error ? e.message : 'Dados corrompidos no armazenamento local.',
    };
  }

  if (isVaultPayload(parsed)) {
    return {
      state: structuredClone(DEFAULT_STATE),
      status: 'vault_locked',
      error: 'Cofre criptografado v3.4 detectado no armazenamento local.',
    };
  }

  return {
    state: normalizeState(parsed),
    status: 'ok',
  };
}

export function loadAppState(): AppState {
  return loadAppStateDetailed().state;
}

export function saveAppState(state: AppState): { ok: boolean; error?: string } {
  const currentRaw = safeGetStorageItem(STORAGE_KEY);
  if (currentRaw) {
    try {
      const currentParsed = safeJsonParse(currentRaw);
      if (isVaultPayload(currentParsed)) {
        return { ok: false, error: 'Cofre legado protegido' };
      }
    } catch {
      // Conteúdo atual não é JSON válido; permite sobrescrever com estado novo válido
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao salvar estado no localStorage.';
    return { ok: false, error: message };
  }
}

// eslint-disable-next-line no-control-regex
const UNSAFE_TEXT_CHARS_RE = /[\x00-\x1F\x7F-\x9F\u202A-\u202E\u2066-\u2069\u061C]+/g;

export function safeStr(val: unknown, fallback = '', maxLen = MAX_STRING_LEN): string {
  if (val === null || val === undefined || typeof val === 'object' || typeof val === 'symbol') {
    return fallback;
  }
  const limit = Math.max(0, Math.trunc(maxLen));
  const cleaned = String(val)
    .replace(UNSAFE_TEXT_CHARS_RE, '')
    .trim()
    .slice(0, limit)
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

function finiteNum(
  val: unknown,
  fallback: number,
  min = -MAX_SAFE_MONEY,
  max = MAX_SAFE_MONEY
): number {
  if (
    typeof val === 'boolean' ||
    typeof val === 'object' ||
    typeof val === 'symbol' ||
    val === null ||
    val === undefined ||
    val === ''
  ) {
    return Math.min(max, Math.max(min, fallback));
  }
  const n = Number(val);
  if (!Number.isFinite(n)) {
    return Math.min(max, Math.max(min, fallback));
  }
  return Math.min(max, Math.max(min, n));
}

const VALID_BANK_TYPES: ReadonlySet<BankAccount['tipo']> = new Set([
  'Conta Digital',
  'Conta Corrente',
  'Investimento',
  'Dinheiro Físico',
]);

const VALID_CAIXINHA_TYPES: ReadonlySet<Caixinha['tipo']> = new Set([
  'emergencia',
  'viagem',
  'aposentadoria',
  'outros',
]);

const VALID_CARD_BENEFITS: ReadonlySet<CreditCard['beneficio']> = new Set([
  'Cashback',
  'Milhas',
  'SemAnuidade',
]);

const VALID_EXPENSE_CATEGORIES: ReadonlySet<string> = new Set([
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
]);

const VALID_ENVELOPE_CADENCIAS: ReadonlySet<EnvelopeConfig['cadencia']> = new Set([
  'semanal',
  'quinzenal',
  'mensal',
  'fds',
]);

function extractSourcePayload(raw: any): any {
  if (raw.schemaVersion !== '3.4') return raw;
  return {
    bancos: raw.contasBancarias,
    caixinhas: raw.caixinhasEReservas,
    cartoes: raw.cartoesCredito,
    dividas: raw.dividas ?? raw.dividasAtivas,
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
  const limited = rawBancos.slice(0, MAX_COLLECTION_ITEMS);
  const result: BankAccount[] = [];
  for (let i = 0; i < limited.length; i++) {
    const b = limited[i];
    if (!b || typeof b !== 'object') continue;
    const rendeJuros = Boolean(b.rendeJuros);
    const tipo = VALID_BANK_TYPES.has(b.tipo) ? b.tipo : 'Conta Digital';
    result.push({
      id: safeStr(b.id, `b_${i + 1}`),
      nome: safeStr(b.nome, 'Conta'),
      tipo,
      saldo: finiteNum(b.saldo, 0),
      rendeJuros,
      pctCDI: finiteNum(b.pctCDI, rendeJuros ? 100 : 0, 0),
    });
  }
  return result;
}

function parseCaixinhas(rawCaixinhas: unknown, fallback: Caixinha[]): Caixinha[] {
  if (!Array.isArray(rawCaixinhas)) return fallback;
  const limited = rawCaixinhas.slice(0, MAX_COLLECTION_ITEMS);
  const result: Caixinha[] = [];
  for (let i = 0; i < limited.length; i++) {
    const c = limited[i];
    if (!c || typeof c !== 'object') continue;
    const tipo = VALID_CAIXINHA_TYPES.has(c.tipo) ? c.tipo : 'outros';
    result.push({
      id: safeStr(c.id, `cx_${i + 1}`),
      nome: safeStr(c.nome, 'Caixinha'),
      saldo: finiteNum(c.saldo, 0, 0),
      aporteMensal: finiteNum(c.aporteMensal, 0, 0),
      meta: finiteNum(c.meta, 0, 0),
      tipo,
      instituicao: safeStr(c.instituicao, 'Banco'),
      pctCDI: finiteNum(c.pctCDI, 100, 0),
    });
  }
  return result;
}

function parseCartoes(rawCartoes: unknown, fallback: CreditCard[]): CreditCard[] {
  if (!Array.isArray(rawCartoes)) return fallback;
  const limited = rawCartoes.slice(0, MAX_COLLECTION_ITEMS);
  const result: CreditCard[] = [];
  for (let i = 0; i < limited.length; i++) {
    const c = limited[i];
    if (!c || typeof c !== 'object') continue;
    const beneficio = VALID_CARD_BENEFITS.has(c.beneficio) ? c.beneficio : 'SemAnuidade';
    result.push({
      id: safeStr(c.id, `c_${i + 1}`),
      nome: safeStr(c.nome, 'Cartão'),
      diaCorte: Math.trunc(finiteNum(c.diaCorte, 10, 1, 31)),
      diaVencimento: Math.trunc(finiteNum(c.diaVencimento, 17, 1, 31)),
      beneficio,
      limiteTotal: finiteNum(c.limiteTotal, 5000, 0),
      faturaAtual: finiteNum(c.faturaAtual, 0, 0),
    });
  }
  return result;
}

function parseDividas(rawDividas: unknown, fallback: DebtItem[]): DebtItem[] {
  if (!Array.isArray(rawDividas)) return fallback;
  const limited = rawDividas.slice(0, MAX_COLLECTION_ITEMS);
  const result: DebtItem[] = [];
  for (let i = 0; i < limited.length; i++) {
    const d = limited[i];
    if (!d || typeof d !== 'object') continue;
    result.push({
      id: safeStr(d.id, `div_${i + 1}`),
      nome: safeStr(d.nome, 'Dívida'),
      saldoDevedor: finiteNum(d.saldoDevedor, 0, 0),
      taxaJurosMensal: finiteNum(d.taxaJurosMensal, 0, 0),
      parcelaMinima: finiteNum(d.parcelaMinima, 0, 0),
    });
  }
  return result;
}

function parsePayrollItems(rawItems: unknown, prefix: string, defaultLabel: string, fallback: PayrollItem[]): PayrollItem[] {
  if (!Array.isArray(rawItems)) return fallback;
  const limited = rawItems.slice(0, MAX_COLLECTION_ITEMS);
  const result: PayrollItem[] = [];
  for (let idx = 0; idx < limited.length; idx++) {
    const item = limited[idx];
    if (!item || typeof item !== 'object') continue;
    result.push({
      id: safeStr(item.id, `${prefix}_${idx + 1}`),
      nome: safeStr(item.nome, '') || safeStr(item.descricao, defaultLabel),
      valor: finiteNum(item.valor, 0, 0),
    });
  }
  return result;
}

function parseSalario(rawSalario: any, fallback: AppState['salario']): AppState['salario'] {
  if (!rawSalario || typeof rawSalario !== 'object') return fallback;
  const proventos = parsePayrollItems(rawSalario.proventos, 'p', 'Provento', fallback.proventos);
  const descontos = parsePayrollItems(rawSalario.descontos, 'd', 'Desconto', fallback.descontos);
  const bruto = finiteNum(
    proventos.reduce((s, p) => s + p.valor, 0),
    0,
    0
  );
  const descontosTotal = finiteNum(
    descontos.reduce((s, d) => s + d.valor, 0),
    0,
    0
  );
  return {
    proventos,
    descontos,
    bruto,
    descontosTotal,
    liquido: finiteNum(Math.max(0, bruto - descontosTotal), 0, 0),
  };
}

function parseHistoricoContracheques(rawHist: unknown, fallback: HistoricalPayroll[]): HistoricalPayroll[] {
  if (!Array.isArray(rawHist)) return fallback;
  const limited = rawHist.slice(0, MAX_COLLECTION_ITEMS);
  const result: HistoricalPayroll[] = [];
  for (let i = 0; i < limited.length; i++) {
    const h = limited[i];
    if (!h || typeof h !== 'object') continue;
    const proventos = parsePayrollItems(h.proventos, 'hp', 'Provento', []);
    const descontos = parsePayrollItems(h.descontos, 'hd', 'Desconto', []);
    const brutoFallback = finiteNum(
      proventos.reduce((s, p) => s + p.valor, 0),
      0,
      0
    );
    const descontosFallback = finiteNum(
      descontos.reduce((s, d) => s + d.valor, 0),
      0,
      0
    );
    const bruto = finiteNum(h.bruto, brutoFallback, 0);
    const descontosTotal = finiteNum(h.descontosTotal, descontosFallback, 0);
    const liquido = finiteNum(h.liquido, Math.max(0, bruto - descontosTotal), 0);
    result.push({
      id: safeStr(h.id, `hist_${i + 1}`),
      competencia: typeof h.competencia === 'string' && /^\d{4}-\d{2}$/.test(h.competencia)
        ? h.competencia
        : getLocalMonthKey(),
      mesLabel: safeStr(h.mesLabel, ''),
      proventos,
      descontos,
      bruto,
      descontosTotal,
      liquido,
    });
  }
  return result;
}

function parseDespesasMolde(
  rawMolde: unknown,
  fallback: RecurringExpenseTemplate[]
): RecurringExpenseTemplate[] {
  if (!Array.isArray(rawMolde)) return fallback;
  const limited = rawMolde.slice(0, MAX_COLLECTION_ITEMS);
  const result: RecurringExpenseTemplate[] = [];
  for (let i = 0; i < limited.length; i++) {
    const m = limited[i];
    if (!m || typeof m !== 'object') continue;
    const categoria = VALID_EXPENSE_CATEGORIES.has(m.categoria) ? m.categoria : 'Moradia';
    result.push({
      id: safeStr(m.id, `m_${i + 1}`),
      descricao: safeStr(m.descricao, 'Despesa Fixa'),
      valorPadrao: finiteNum(m.valorPadrao, 0, 0),
      diaVencimento: Math.trunc(finiteNum(m.diaVencimento, 10, 1, 31)),
      categoria,
      ativa: m.ativa !== false,
    });
  }
  return result;
}

function parseSingleExpenseItem(d: any, compKey: string, idx: number): ExpenseItem {
  const categoria = VALID_EXPENSE_CATEGORIES.has(d.categoria) ? d.categoria : 'Outros';
  const natureza = d.natureza === 'essencial' || d.natureza === 'estilo_vida' ? d.natureza : undefined;
  const parcelaAtual =
    d.parcelaAtual !== undefined && d.parcelaAtual !== null
      ? Math.trunc(finiteNum(d.parcelaAtual, 1, 1, MAX_INSTALLMENTS))
      : undefined;
  const totalParcelas =
    d.totalParcelas !== undefined && d.totalParcelas !== null
      ? Math.trunc(finiteNum(d.totalParcelas, 1, 1, MAX_INSTALLMENTS))
      : undefined;
  const grupoParcelamentoId = safeStr(d.grupoParcelamentoId, '') || undefined;
  return {
    id: safeStr(d.id, `d_${compKey.replace('-', '')}_${idx + 1}`),
    moldeId: safeStr(d.moldeId, '') || null,
    descricao: safeStr(d.descricao, 'Despesa'),
    valor: finiteNum(d.valor, 0, 0),
    diaVencimento: Math.trunc(finiteNum(d.diaVencimento, 10, 1, 31)),
    paga: Boolean(d.paga),
    categoria,
    natureza,
    dataPagamento: safeStr(d.dataPagamento, '') || null,
    contaOrigem: safeStr(d.contaOrigem, '') || null,
    contaOrigemId: safeStr(d.contaOrigemId, '') || null,
    formaPagamento: safeStr(d.formaPagamento, '') || undefined,
    ...(parcelaAtual !== undefined ? { parcelaAtual } : {}),
    ...(totalParcelas !== undefined ? { totalParcelas } : {}),
    ...(grupoParcelamentoId !== undefined ? { grupoParcelamentoId } : {}),
  };
}

function parseDespesasPorMes(
  rawMeses: any,
  fallback: Record<string, ExpenseItem[]>
): Record<string, ExpenseItem[]> {
  if (!rawMeses || typeof rawMeses !== 'object' || Array.isArray(rawMeses)) return fallback;
  const cleanMes: Record<string, ExpenseItem[]> = {};
  for (const [k, list] of Object.entries(rawMeses).slice(0, MAX_MONTH_BUCKETS)) {
    if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(list)) {
      const limited = list.slice(0, MAX_COLLECTION_ITEMS);
      const items: ExpenseItem[] = [];
      for (let idx = 0; idx < limited.length; idx++) {
        const d = limited[idx];
        if (!d || typeof d !== 'object') continue;
        items.push(parseSingleExpenseItem(d, k, idx));
      }
      cleanMes[k] = items;
    }
  }
  return Object.keys(cleanMes).length > 0 ? cleanMes : fallback;
}

function parseReceitasPorMes(
  rawMeses: any,
  fallback: Record<string, ExtraIncomeItem[]>
): Record<string, ExtraIncomeItem[]> {
  if (!rawMeses || typeof rawMeses !== 'object' || Array.isArray(rawMeses)) return fallback;
  const cleanMes: Record<string, ExtraIncomeItem[]> = {};
  for (const [k, list] of Object.entries(rawMeses).slice(0, MAX_MONTH_BUCKETS)) {
    if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(list)) {
      const limited = list.slice(0, MAX_COLLECTION_ITEMS);
      const items: ExtraIncomeItem[] = [];
      for (let idx = 0; idx < limited.length; idx++) {
        const r = limited[idx];
        if (!r || typeof r !== 'object') continue;
        items.push({
          id: safeStr(r.id, `rec_${k.replace('-', '')}_${idx + 1}`),
          descricao: safeStr(r.descricao, 'Receita Extra'),
          valor: finiteNum(r.valor, 0, 0),
          categoria: safeStr(r.categoria, 'Outros'),
          data: typeof r.data === 'string' ? safeStr(r.data, `${k}-01`) : `${k}-01`,
          recebida: Boolean(r.recebida),
          contaDestinoId: safeStr(r.contaDestinoId, '') || null,
        });
      }
      cleanMes[k] = items;
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
    diaFixo: Math.trunc(finiteNum(rawCfg.diaFixo, 5, 1, 31)),
    dataExata: safeStr(rawCfg.dataExata, '') || null,
  };
}

function parseSingleEnvelope(rawEnv: any, fallback: EnvelopeConfig): EnvelopeConfig {
  if (!rawEnv || typeof rawEnv !== 'object') return fallback;
  const cadencia = VALID_ENVELOPE_CADENCIAS.has(rawEnv.cadencia) ? rawEnv.cadencia : fallback.cadencia;
  return {
    total: finiteNum(rawEnv.total, fallback.total, 0),
    cadencia,
  };
}

function parseConfiguracoes(
  rawConfig: any,
  fallback: AppState['configuracoes']
): AppState['configuracoes'] {
  if (!rawConfig || typeof rawConfig !== 'object') return fallback;
  return {
    taxaCdiAnual: finiteNum(rawConfig.taxaCdiAnual, 10.75, 0),
    swrAnualPct: finiteNum(rawConfig.swrAnualPct, 4.0, 0),
    jurosReaisAnualPct: finiteNum(rawConfig.jurosReaisAnualPct, 5.0, 0),
  };
}

export function normalizeState(raw: any): AppState {
  const base = structuredClone(DEFAULT_STATE);
  base.competenciaAtual = getLocalMonthKey();
  if (!raw || typeof raw !== 'object') return base;

  const src = extractSourcePayload(raw);

  base.bancos = parseBanks(src.bancos, base.bancos);
  base.caixinhas = parseCaixinhas(src.caixinhas, base.caixinhas);
  base.cartoes = parseCartoes(src.cartoes, base.cartoes);
  base.dividas = parseDividas(src.dividas, base.dividas);
  base.salario = parseSalario(src.salario, base.salario);
  base.historicoContracheques = parseHistoricoContracheques(
    src.historicoContracheques,
    base.historicoContracheques
  );

  if (typeof src.competenciaAtual === 'string' && /^\d{4}-\d{2}$/.test(src.competenciaAtual)) {
    base.competenciaAtual = src.competenciaAtual;
  }

  base.despesasFixasMolde = parseDespesasMolde(src.despesasFixasMolde, base.despesasFixasMolde);
  base.despesasPorMes = parseDespesasPorMes(src.despesasPorMes, base.despesasPorMes);
  base.receitasPorMes = parseReceitasPorMes(src.receitasPorMes, base.receitasPorMes);
  base.configPagamento = parseConfigPagamento(src.configPagamento, base.configPagamento);

  if (src.envelopes && typeof src.envelopes === 'object') {
    base.envelopes = {
      supermercado: parseSingleEnvelope(src.envelopes.supermercado, base.envelopes.supermercado),
      lazer: parseSingleEnvelope(src.envelopes.lazer, base.envelopes.lazer),
      combustivel: parseSingleEnvelope(src.envelopes.combustivel, base.envelopes.combustivel),
    };
  }

  base.configuracoes = parseConfiguracoes(src.configuracoes, base.configuracoes);

  return base;
}

const RECOGNIZED_IMPORT_KEYS = [
  'bancos',
  'caixinhas',
  'cartoes',
  'despesasPorMes',
  'receitasPorMes',
  'salario',
  'despesasFixasMolde',
  'dividas',
] as const;

export function validateImportJson(
  rawText: string
): { ok: true; state: AppState } | { ok: false; error: string } {
  if (typeof rawText !== 'string') {
    return { ok: false, error: 'Arquivo vazio ou formato inválido.' };
  }

  if (rawText.length > MAX_BACKUP_FILE_BYTES) {
    return {
      ok: false,
      error: `O arquivo excede o limite máximo de ${Math.round(MAX_BACKUP_FILE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  if (
    rawText.length > MAX_BACKUP_FILE_BYTES / 4 &&
    typeof TextEncoder !== 'undefined' &&
    new TextEncoder().encode(rawText).byteLength > MAX_BACKUP_FILE_BYTES
  ) {
    return {
      ok: false,
      error: `O arquivo excede o limite máximo de ${Math.round(MAX_BACKUP_FILE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  if (!rawText.trim()) {
    return { ok: false, error: 'Arquivo vazio ou formato inválido.' };
  }

  let parsed: unknown;
  try {
    parsed = safeJsonParse(rawText);
  } catch {
    return { ok: false, error: 'JSON inválido ou corrompido.' };
  }

  if (isVaultPayload(parsed)) {
    return {
      ok: false,
      error:
        'Backups .vault cifrados devem ser abertos na versão clássica v3.4 para exportação em JSON antes de importar.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Estrutura inválida: esperado um objeto JSON na raiz.' };
  }

  const src = extractSourcePayload(parsed);
  const hasRecognizedKey = RECOGNIZED_IMPORT_KEYS.some(
    (k) => src && typeof src === 'object' && k in src && src[k] !== undefined
  );

  if (!hasRecognizedKey) {
    return {
      ok: false,
      error: 'O arquivo não contém nenhuma estrutura reconhecida do FinTrack.',
    };
  }

  return { ok: true, state: normalizeState(parsed) };
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
