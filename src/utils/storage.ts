import {
  BankAccount,
  Caixinha,
  CreditCard,
  DebtItem,
  ExpenseItem,
  ExtraIncomeItem,
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

function finiteNum(val: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof val === 'boolean' || val === null || val === undefined || val === '') {
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

const VALID_EXPENSE_CATEGORIES: ReadonlySet<ExpenseItem['categoria']> = new Set([
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
  const result: BankAccount[] = [];
  for (let i = 0; i < rawBancos.length; i++) {
    const b = rawBancos[i];
    if (!b || typeof b !== 'object') continue;
    const rendeJuros = Boolean(b.rendeJuros);
    const tipo = VALID_BANK_TYPES.has(b.tipo) ? b.tipo : 'Conta Digital';
    result.push({
      id: String(b.id || `b_${i + 1}`),
      nome: String(b.nome || 'Conta'),
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
  const result: Caixinha[] = [];
  for (let i = 0; i < rawCaixinhas.length; i++) {
    const c = rawCaixinhas[i];
    if (!c || typeof c !== 'object') continue;
    const tipo = VALID_CAIXINHA_TYPES.has(c.tipo) ? c.tipo : 'outros';
    result.push({
      id: String(c.id || `cx_${i + 1}`),
      nome: String(c.nome || 'Caixinha'),
      saldo: finiteNum(c.saldo, 0, 0),
      aporteMensal: finiteNum(c.aporteMensal, 0, 0),
      meta: finiteNum(c.meta, 0, 0),
      tipo,
      instituicao: String(c.instituicao || 'Banco'),
      pctCDI: finiteNum(c.pctCDI, 100, 0),
    });
  }
  return result;
}

function parseCartoes(rawCartoes: unknown, fallback: CreditCard[]): CreditCard[] {
  if (!Array.isArray(rawCartoes)) return fallback;
  const result: CreditCard[] = [];
  for (let i = 0; i < rawCartoes.length; i++) {
    const c = rawCartoes[i];
    if (!c || typeof c !== 'object') continue;
    const beneficio = VALID_CARD_BENEFITS.has(c.beneficio) ? c.beneficio : 'SemAnuidade';
    result.push({
      id: String(c.id || `c_${i + 1}`),
      nome: String(c.nome || 'Cartão'),
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
  const result: DebtItem[] = [];
  for (let i = 0; i < rawDividas.length; i++) {
    const d = rawDividas[i];
    if (!d || typeof d !== 'object') continue;
    result.push({
      id: String(d.id || `div_${i + 1}`),
      nome: String(d.nome || 'Dívida'),
      saldoDevedor: finiteNum(d.saldoDevedor, 0, 0),
      taxaJurosMensal: finiteNum(d.taxaJurosMensal, 0, 0),
      parcelaMinima: finiteNum(d.parcelaMinima, 0, 0),
    });
  }
  return result;
}

function parsePayrollItems(rawItems: unknown, prefix: string, defaultLabel: string, fallback: PayrollItem[]): PayrollItem[] {
  if (!Array.isArray(rawItems)) return fallback;
  const result: PayrollItem[] = [];
  for (let idx = 0; idx < rawItems.length; idx++) {
    const item = rawItems[idx];
    if (!item || typeof item !== 'object') continue;
    result.push({
      id: String(item.id || `${prefix}_${idx + 1}`),
      nome: String(item.nome || item.descricao || defaultLabel),
      valor: finiteNum(item.valor, 0, 0),
    });
  }
  return result;
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

function parseHistoricoContracheques(rawHist: unknown, fallback: HistoricalPayroll[]): HistoricalPayroll[] {
  if (!Array.isArray(rawHist)) return fallback;
  const result: HistoricalPayroll[] = [];
  for (let i = 0; i < rawHist.length; i++) {
    const h = rawHist[i];
    if (!h || typeof h !== 'object') continue;
    const proventos = parsePayrollItems(h.proventos, 'hp', 'Provento', []);
    const descontos = parsePayrollItems(h.descontos, 'hd', 'Desconto', []);
    const bruto = finiteNum(h.bruto, proventos.reduce((s, p) => s + p.valor, 0), 0);
    const descontosTotal = finiteNum(h.descontosTotal, descontos.reduce((s, d) => s + d.valor, 0), 0);
    const liquido = finiteNum(h.liquido, Math.max(0, bruto - descontosTotal), 0);
    result.push({
      id: String(h.id || `hist_${i + 1}`),
      competencia: typeof h.competencia === 'string' && /^\d{4}-\d{2}$/.test(h.competencia)
        ? h.competencia
        : getLocalMonthKey(),
      mesLabel: String(h.mesLabel || ''),
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
  const result: RecurringExpenseTemplate[] = [];
  for (let i = 0; i < rawMolde.length; i++) {
    const m = rawMolde[i];
    if (!m || typeof m !== 'object') continue;
    const categoria = VALID_EXPENSE_CATEGORIES.has(m.categoria) ? m.categoria : 'Moradia';
    result.push({
      id: String(m.id || `m_${i + 1}`),
      descricao: String(m.descricao || 'Despesa Fixa'),
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
      ? Math.max(1, Math.trunc(finiteNum(d.parcelaAtual, 1, 1)))
      : undefined;
  const totalParcelas =
    d.totalParcelas !== undefined && d.totalParcelas !== null
      ? Math.max(1, Math.trunc(finiteNum(d.totalParcelas, 1, 1)))
      : undefined;
  const grupoParcelamentoId = d.grupoParcelamentoId ? String(d.grupoParcelamentoId) : undefined;
  return {
    id: String(d.id || `d_${compKey.replace('-', '')}_${idx + 1}`),
    moldeId: d.moldeId ? String(d.moldeId) : null,
    descricao: String(d.descricao || 'Despesa'),
    valor: finiteNum(d.valor, 0, 0),
    diaVencimento: Math.trunc(finiteNum(d.diaVencimento, 10, 1, 31)),
    paga: Boolean(d.paga),
    categoria,
    natureza,
    dataPagamento: d.dataPagamento ? String(d.dataPagamento) : null,
    contaOrigem: d.contaOrigem ? String(d.contaOrigem) : null,
    contaOrigemId: d.contaOrigemId ? String(d.contaOrigemId) : null,
    formaPagamento: d.formaPagamento ? String(d.formaPagamento) : undefined,
    ...(parcelaAtual !== undefined ? { parcelaAtual } : {}),
    ...(totalParcelas !== undefined ? { totalParcelas } : {}),
    ...(grupoParcelamentoId !== undefined ? { grupoParcelamentoId } : {}),
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
      const items: ExpenseItem[] = [];
      for (let idx = 0; idx < list.length; idx++) {
        const d = list[idx];
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
  for (const [k, list] of Object.entries(rawMeses)) {
    if (/^\d{4}-\d{2}$/.test(k) && Array.isArray(list)) {
      const items: ExtraIncomeItem[] = [];
      for (let idx = 0; idx < list.length; idx++) {
        const r = list[idx];
        if (!r || typeof r !== 'object') continue;
        items.push({
          id: String(r.id || `rec_${k.replace('-', '')}_${idx + 1}`),
          descricao: String(r.descricao || 'Receita Extra'),
          valor: finiteNum(r.valor, 0, 0),
          categoria: String(r.categoria || 'Outros'),
          data: typeof r.data === 'string' && r.data ? r.data : `${k}-01`,
          recebida: Boolean(r.recebida),
          contaDestinoId: r.contaDestinoId ? String(r.contaDestinoId) : null,
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
    dataExata: rawCfg.dataExata ? String(rawCfg.dataExata) : null,
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
  if (typeof rawText !== 'string' || !rawText.trim()) {
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
