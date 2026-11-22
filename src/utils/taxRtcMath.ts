import { fromCents, toCents } from './financeMath';

export interface RtcTransitionYear {
  ano: number;
  cbsPct: number;
  ibsPct: number;
  fase: string;
  descricao: string;
  compensavelTeste: boolean;
}

/**
 * Cronograma oficial de transição da Reforma Tributária do Consumo (EC 132/2023 + LC 214/2025).
 * Alíquotas de referência: CBS plena 8,8% (a partir de 2027) e IBS pleno 17,7% (em 2033) = 26,5%.
 */
export const RTC_TRANSITION_SCHEDULE: readonly RtcTransitionYear[] = [
  {
    ano: 2026,
    cbsPct: 0.9,
    ibsPct: 0.1,
    fase: 'Ano-Teste',
    descricao: 'Alíquota-teste compensável com PIS/COFINS.',
    compensavelTeste: true,
  },
  {
    ano: 2027,
    cbsPct: 8.8,
    ibsPct: 0.1,
    fase: 'CBS Plena',
    descricao: 'Extinção de PIS/COFINS; entrada da CBS cheia e IBS teste.',
    compensavelTeste: false,
  },
  {
    ano: 2028,
    cbsPct: 8.8,
    ibsPct: 0.1,
    fase: 'CBS Plena',
    descricao: 'Manutenção da CBS cheia e IBS teste.',
    compensavelTeste: false,
  },
  {
    ano: 2029,
    cbsPct: 8.8,
    ibsPct: 1.77,
    fase: 'Transição IBS (10%)',
    descricao: '10% da alíquota cheia de IBS com redução proporcional de ICMS/ISS.',
    compensavelTeste: false,
  },
  {
    ano: 2030,
    cbsPct: 8.8,
    ibsPct: 3.54,
    fase: 'Transição IBS (20%)',
    descricao: '20% da alíquota cheia de IBS com redução proporcional de ICMS/ISS.',
    compensavelTeste: false,
  },
  {
    ano: 2031,
    cbsPct: 8.8,
    ibsPct: 5.31,
    fase: 'Transição IBS (30%)',
    descricao: '30% da alíquota cheia de IBS com redução proporcional de ICMS/ISS.',
    compensavelTeste: false,
  },
  {
    ano: 2032,
    cbsPct: 8.8,
    ibsPct: 7.08,
    fase: 'Transição IBS (40%)',
    descricao: '40% da alíquota cheia de IBS com redução proporcional de ICMS/ISS.',
    compensavelTeste: false,
  },
  {
    ano: 2033,
    cbsPct: 8.8,
    ibsPct: 17.7,
    fase: 'Vigência Plena',
    descricao: 'Extinção de ICMS/ISS; CBS e IBS plenos (26,5% referência).',
    compensavelTeste: false,
  },
] as const;

export type RtcReductionPresetId =
  | 'padrao'
  | 'profissao_regulamentada'
  | 'saude_educacao'
  | 'cesta_basica';

export interface RtcReductionPreset {
  id: RtcReductionPresetId;
  label: string;
  reducaoPct: number;
  descricao: string;
}

export const RTC_REDUCTION_PRESETS: Readonly<Record<RtcReductionPresetId, RtcReductionPreset>> = {
  padrao: {
    id: 'padrao',
    label: 'Alíquota Padrão (0% redução)',
    reducaoPct: 0,
    descricao: 'Bens e serviços em geral sujeitos à alíquota cheia de CBS e IBS.',
  },
  profissao_regulamentada: {
    id: 'profissao_regulamentada',
    label: 'Profissão Regulamentada (-30%)',
    reducaoPct: 30,
    descricao: 'Serviços de profissões intelectuais regulamentadas (LC 214/2025).',
  },
  saude_educacao: {
    id: 'saude_educacao',
    label: 'Saúde, Educação & Transporte (-60%)',
    reducaoPct: 60,
    descricao: 'Serviços de saúde, educação, transporte coletivo, agro e cultura.',
  },
  cesta_basica: {
    id: 'cesta_basica',
    label: 'Cesta Básica Nacional (-100%)',
    reducaoPct: 100,
    descricao: 'Alíquota zero para itens da Cesta Básica Nacional de Alimentos.',
  },
} as const;

export interface RegimeRegularInput {
  valorOperacao: number;
  ano: number;
  reducaoPct: number;
  creditosInsumos: number;
  aliquotaIS?: number;
  cbsCustomPct?: number;
  ibsCustomPct?: number;
}

export interface RegimeRegularResult {
  ano: number;
  fase: string;
  valorOperacao: number;
  aliquotaCbsBase: number;
  aliquotaIbsBase: number;
  reducaoPct: number;
  aliquotaCbsEfetiva: number;
  aliquotaIbsEfetiva: number;
  aliquotaISEfetiva: number;
  valorCbsBruto: number;
  valorIbsBruto: number;
  valorIS: number;
  creditoAproveitado: number;
  creditoExcedente: number;
  totalTributosBruto: number;
  totalTributosLiquido: number;
  cargaEfetivaPct: number;
  valorLiquidoOperacao: number;
}

function safeNonNegative(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function roundPct(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

/**
 * Retorna a entrada do cronograma de transição RTC para o ano informado
 * (anos anteriores a 2026 caem em 2026; posteriores a 2033 caem em 2033).
 */
export function getRtcScheduleForYear(ano: number): RtcTransitionYear {
  const numericYear = Number.isFinite(ano) ? Math.trunc(ano) : 2026;
  if (numericYear <= 2026) return RTC_TRANSITION_SCHEDULE[0];
  if (numericYear >= 2033) return RTC_TRANSITION_SCHEDULE[RTC_TRANSITION_SCHEDULE.length - 1];
  return (
    RTC_TRANSITION_SCHEDULE.find((item) => item.ano === numericYear) ?? RTC_TRANSITION_SCHEDULE[0]
  );
}

/**
 * Calcula CBS, IBS e Imposto Seletivo (IS) no Regime Regular da Reforma Tributária (LC 214/2025),
 * utilizando aritmética inteira em centavos e não-cumulatividade plena (crédito limitado ao débito CBS+IBS).
 */
export function calculateRegimeRegularRtc(input: RegimeRegularInput): RegimeRegularResult {
  const schedule = getRtcScheduleForYear(input.ano);
  const valorOperacaoCents = toCents(safeNonNegative(input.valorOperacao));
  const valorOperacao = fromCents(valorOperacaoCents);

  const aliquotaCbsBase =
    input.cbsCustomPct !== undefined && Number.isFinite(input.cbsCustomPct)
      ? Math.max(0, input.cbsCustomPct)
      : schedule.cbsPct;
  const aliquotaIbsBase =
    input.ibsCustomPct !== undefined && Number.isFinite(input.ibsCustomPct)
      ? Math.max(0, input.ibsCustomPct)
      : schedule.ibsPct;

  const reducaoPct = Math.min(100, safeNonNegative(input.reducaoPct));
  const fatorReducao = Math.max(0, 1 - reducaoPct / 100);

  const aliquotaCbsEfetiva = roundPct(aliquotaCbsBase * fatorReducao);
  const aliquotaIbsEfetiva = roundPct(aliquotaIbsBase * fatorReducao);
  const aliquotaISEfetiva = roundPct(safeNonNegative(input.aliquotaIS ?? 0));

  const valorCbsBrutoCents = Math.round(valorOperacaoCents * (aliquotaCbsEfetiva / 100));
  const valorIbsBrutoCents = Math.round(valorOperacaoCents * (aliquotaIbsEfetiva / 100));
  const valorISCents = Math.round(valorOperacaoCents * (aliquotaISEfetiva / 100));

  const debitoCbsIbsCents = valorCbsBrutoCents + valorIbsBrutoCents;
  const creditosInsumosCents = toCents(safeNonNegative(input.creditosInsumos));
  const creditoAproveitadoCents = Math.min(creditosInsumosCents, debitoCbsIbsCents);
  const creditoExcedenteCents = Math.max(0, creditosInsumosCents - creditoAproveitadoCents);

  const totalTributosBrutoCents = valorCbsBrutoCents + valorIbsBrutoCents + valorISCents;
  const totalTributosLiquidoCents = Math.max(0, totalTributosBrutoCents - creditoAproveitadoCents);
  const valorLiquidoOperacaoCents = Math.max(0, valorOperacaoCents - totalTributosLiquidoCents);

  const cargaEfetivaPct =
    valorOperacaoCents > 0
      ? roundPct((totalTributosLiquidoCents / valorOperacaoCents) * 100, 2)
      : 0;

  return {
    ano: schedule.ano,
    fase: schedule.fase,
    valorOperacao,
    aliquotaCbsBase,
    aliquotaIbsBase,
    reducaoPct,
    aliquotaCbsEfetiva,
    aliquotaIbsEfetiva,
    aliquotaISEfetiva,
    valorCbsBruto: fromCents(valorCbsBrutoCents),
    valorIbsBruto: fromCents(valorIbsBrutoCents),
    valorIS: fromCents(valorISCents),
    creditoAproveitado: fromCents(creditoAproveitadoCents),
    creditoExcedente: fromCents(creditoExcedenteCents),
    totalTributosBruto: fromCents(totalTributosBrutoCents),
    totalTributosLiquido: fromCents(totalTributosLiquidoCents),
    cargaEfetivaPct,
    valorLiquidoOperacao: fromCents(valorLiquidoOperacaoCents),
  };
}

export type SimplesAnexo = 'I' | 'II' | 'III' | 'IV' | 'V';
export type SimplesRtcModo = 'das' | 'por_fora';

export interface SimplesFaixa {
  faixa: number;
  limiteSuperior: number;
  aliquotaNominalPct: number;
  parcelaDeduzir: number;
  /** Participação média estimada de tributos sobre consumo (PIS/COFINS/ICMS/ISS) dentro do DAS */
  parcelaConsumoPct: number;
}

export interface SimplesAnexoInfo {
  codigo: SimplesAnexo;
  nome: string;
  descricao: string;
  faixas: readonly SimplesFaixa[];
}

/**
 * Tabelas oficiais do Simples Nacional — Anexos I a V (LC 123/2006 com redação da LC 155/2016).
 */
export const SIMPLES_ANEXOS: Readonly<Record<SimplesAnexo, SimplesAnexoInfo>> = {
  I: {
    codigo: 'I',
    nome: 'Anexo I — Comércio',
    descricao: 'Lojas, varejo, atacado e revenda de mercadorias.',
    faixas: [
      { faixa: 1, limiteSuperior: 180000, aliquotaNominalPct: 4.0, parcelaDeduzir: 0, parcelaConsumoPct: 49.5 },
      { faixa: 2, limiteSuperior: 360000, aliquotaNominalPct: 7.3, parcelaDeduzir: 5940, parcelaConsumoPct: 49.5 },
      { faixa: 3, limiteSuperior: 720000, aliquotaNominalPct: 9.5, parcelaDeduzir: 13860, parcelaConsumoPct: 49.0 },
      { faixa: 4, limiteSuperior: 1800000, aliquotaNominalPct: 10.7, parcelaDeduzir: 22500, parcelaConsumoPct: 49.0 },
      { faixa: 5, limiteSuperior: 3600000, aliquotaNominalPct: 14.3, parcelaDeduzir: 87300, parcelaConsumoPct: 49.0 },
      { faixa: 6, limiteSuperior: 4800000, aliquotaNominalPct: 19.0, parcelaDeduzir: 378000, parcelaConsumoPct: 34.5 },
    ],
  },
  II: {
    codigo: 'II',
    nome: 'Anexo II — Indústria',
    descricao: 'Fábricas, manufatura e indústrias em geral.',
    faixas: [
      { faixa: 1, limiteSuperior: 180000, aliquotaNominalPct: 4.5, parcelaDeduzir: 0, parcelaConsumoPct: 45.0 },
      { faixa: 2, limiteSuperior: 360000, aliquotaNominalPct: 7.8, parcelaDeduzir: 5940, parcelaConsumoPct: 45.0 },
      { faixa: 3, limiteSuperior: 720000, aliquotaNominalPct: 10.0, parcelaDeduzir: 13860, parcelaConsumoPct: 45.0 },
      { faixa: 4, limiteSuperior: 1800000, aliquotaNominalPct: 11.2, parcelaDeduzir: 22500, parcelaConsumoPct: 45.0 },
      { faixa: 5, limiteSuperior: 3600000, aliquotaNominalPct: 14.7, parcelaDeduzir: 85500, parcelaConsumoPct: 45.0 },
      { faixa: 6, limiteSuperior: 4800000, aliquotaNominalPct: 30.0, parcelaDeduzir: 720000, parcelaConsumoPct: 31.0 },
    ],
  },
  III: {
    codigo: 'III',
    nome: 'Anexo III — Serviços (ou Anexo V com Fator R >= 28%)',
    descricao: 'Prestação de serviços gerais, manutenção, saúde e TI com Fator R >= 28%.',
    faixas: [
      { faixa: 1, limiteSuperior: 180000, aliquotaNominalPct: 6.0, parcelaDeduzir: 0, parcelaConsumoPct: 49.1 },
      { faixa: 2, limiteSuperior: 360000, aliquotaNominalPct: 11.2, parcelaDeduzir: 9360, parcelaConsumoPct: 49.0 },
      { faixa: 3, limiteSuperior: 720000, aliquotaNominalPct: 13.5, parcelaDeduzir: 17640, parcelaConsumoPct: 49.0 },
      { faixa: 4, limiteSuperior: 1800000, aliquotaNominalPct: 16.0, parcelaDeduzir: 35640, parcelaConsumoPct: 49.0 },
      { faixa: 5, limiteSuperior: 3600000, aliquotaNominalPct: 21.0, parcelaDeduzir: 125640, parcelaConsumoPct: 49.0 },
      { faixa: 6, limiteSuperior: 4800000, aliquotaNominalPct: 33.0, parcelaDeduzir: 648000, parcelaConsumoPct: 20.0 },
    ],
  },
  IV: {
    codigo: 'IV',
    nome: 'Anexo IV — Serviços (CPP fora do DAS)',
    descricao: 'Construção civil, advocacia, vigilância e limpeza.',
    faixas: [
      { faixa: 1, limiteSuperior: 180000, aliquotaNominalPct: 4.5, parcelaDeduzir: 0, parcelaConsumoPct: 66.0 },
      { faixa: 2, limiteSuperior: 360000, aliquotaNominalPct: 9.0, parcelaDeduzir: 8100, parcelaConsumoPct: 64.5 },
      { faixa: 3, limiteSuperior: 720000, aliquotaNominalPct: 10.2, parcelaDeduzir: 12420, parcelaConsumoPct: 64.5 },
      { faixa: 4, limiteSuperior: 1800000, aliquotaNominalPct: 14.0, parcelaDeduzir: 39780, parcelaConsumoPct: 64.5 },
      { faixa: 5, limiteSuperior: 3600000, aliquotaNominalPct: 22.0, parcelaDeduzir: 183780, parcelaConsumoPct: 62.5 },
      { faixa: 6, limiteSuperior: 4800000, aliquotaNominalPct: 33.0, parcelaDeduzir: 828000, parcelaConsumoPct: 26.5 },
    ],
  },
  V: {
    codigo: 'V',
    nome: 'Anexo V — Serviços Intelectuais (Fator R < 28%)',
    descricao: 'Engenharia, tecnologia, consultoria e auditoria com Fator R abaixo de 28%.',
    faixas: [
      { faixa: 1, limiteSuperior: 180000, aliquotaNominalPct: 15.5, parcelaDeduzir: 0, parcelaConsumoPct: 30.0 },
      { faixa: 2, limiteSuperior: 360000, aliquotaNominalPct: 18.0, parcelaDeduzir: 4500, parcelaConsumoPct: 33.0 },
      { faixa: 3, limiteSuperior: 720000, aliquotaNominalPct: 19.5, parcelaDeduzir: 9900, parcelaConsumoPct: 35.0 },
      { faixa: 4, limiteSuperior: 1800000, aliquotaNominalPct: 20.5, parcelaDeduzir: 17100, parcelaConsumoPct: 36.5 },
      { faixa: 5, limiteSuperior: 3600000, aliquotaNominalPct: 23.0, parcelaDeduzir: 62100, parcelaConsumoPct: 39.0 },
      { faixa: 6, limiteSuperior: 4800000, aliquotaNominalPct: 30.5, parcelaDeduzir: 540000, parcelaConsumoPct: 20.0 },
    ],
  },
} as const;

export interface SimplesNacionalInput {
  faturamentoMes: number;
  rbt12: number;
  anexo: SimplesAnexo;
  folha12m?: number;
  ano?: number;
  modoRecolhimentoRtc?: SimplesRtcModo;
}

export interface SimplesNacionalResult {
  anexoInformado: SimplesAnexo;
  anexoEfetivo: SimplesAnexo;
  migradoPorFatorR: boolean;
  fatorRPct: number;
  faixa: number;
  aliquotaNominalPct: number;
  parcelaDeduzir: number;
  aliquotaEfetivaPct: number;
  faturamentoMes: number;
  valorDasEstimado: number;
  anoRtc: number;
  modoRecolhimentoRtc: SimplesRtcModo;
  aliquotaCbsIbsRefPct: number;
  valorCbsIbsNoDas: number;
  valorCbsIbsPorFora: number;
  creditoTransferivelPj: number;
  totalTributosMes: number;
  cargaEfetivaTotalPct: number;
  diferencaPorForaVsDas: number;
  receitaLiquidaEstimada: number;
}

/**
 * Calcula o Simples Nacional (Anexos I a V, LC 123/2006) com regra automática do Fator R
 * (Anexo V -> Anexo III quando folha12m / rbt12 >= 28%) e comparativo RTC (CBS/IBS dentro do DAS vs por fora).
 */
export function calculateSimplesNacionalRtc(input: SimplesNacionalInput): SimplesNacionalResult {
  const faturamentoCents = toCents(safeNonNegative(input.faturamentoMes));
  const faturamentoMes = fromCents(faturamentoCents);
  const rbt12 = safeNonNegative(input.rbt12);
  const folha12m = safeNonNegative(input.folha12m ?? 0);

  const anexoInformado: SimplesAnexo = SIMPLES_ANEXOS[input.anexo] ? input.anexo : 'III';
  const fatorRPct = rbt12 > 0 ? roundPct((folha12m / rbt12) * 100, 2) : 0;
  const migradoPorFatorR = anexoInformado === 'V' && fatorRPct >= 28;
  const anexoEfetivo: SimplesAnexo = migradoPorFatorR ? 'III' : anexoInformado;

  const tabela = SIMPLES_ANEXOS[anexoEfetivo].faixas;
  const faixaInfo =
    rbt12 <= 0
      ? tabela[0]
      : (tabela.find((f) => rbt12 <= f.limiteSuperior) ?? tabela[tabela.length - 1]);

  const aliquotaNominalPct = faixaInfo.aliquotaNominalPct;
  const parcelaDeduzir = faixaInfo.parcelaDeduzir;

  const aliquotaEfetivaPct =
    rbt12 <= 0
      ? aliquotaNominalPct
      : roundPct(
          Math.max(0, ((rbt12 * (aliquotaNominalPct / 100) - parcelaDeduzir) / rbt12) * 100),
          4
        );

  const valorDasCents = Math.round(faturamentoCents * (aliquotaEfetivaPct / 100));

  const schedule = getRtcScheduleForYear(input.ano ?? 2026);
  const modoRecolhimentoRtc: SimplesRtcModo =
    input.modoRecolhimentoRtc === 'por_fora' ? 'por_fora' : 'das';
  const aliquotaCbsIbsRefPct = roundPct(schedule.cbsPct + schedule.ibsPct, 4);

  // Parcela estimada de tributos sobre consumo dentro do DAS (transferível como crédito no modo DAS)
  const valorCbsIbsNoDasCents = Math.round(valorDasCents * (faixaInfo.parcelaConsumoPct / 100));
  const dasSemConsumoCents = Math.max(0, valorDasCents - valorCbsIbsNoDasCents);

  // Cenário híbrido "por fora": paga CBS + IBS pela alíquota de referência do ano e abate a parcela de consumo do DAS
  const valorCbsIbsPorForaCents = Math.round(faturamentoCents * (aliquotaCbsIbsRefPct / 100));
  const totalModoPorForaCents = dasSemConsumoCents + valorCbsIbsPorForaCents;
  const diferencaPorForaVsDasCents = totalModoPorForaCents - valorDasCents;

  const totalTributosMesCents =
    modoRecolhimentoRtc === 'por_fora' ? totalModoPorForaCents : valorDasCents;
  const creditoTransferivelPjCents =
    modoRecolhimentoRtc === 'por_fora' ? valorCbsIbsPorForaCents : valorCbsIbsNoDasCents;
  const receitaLiquidaCents = Math.max(0, faturamentoCents - totalTributosMesCents);
  const cargaEfetivaTotalPct =
    faturamentoCents > 0 ? roundPct((totalTributosMesCents / faturamentoCents) * 100, 2) : 0;

  return {
    anexoInformado,
    anexoEfetivo,
    migradoPorFatorR,
    fatorRPct,
    faixa: faixaInfo.faixa,
    aliquotaNominalPct,
    parcelaDeduzir,
    aliquotaEfetivaPct,
    faturamentoMes,
    valorDasEstimado: fromCents(valorDasCents),
    anoRtc: schedule.ano,
    modoRecolhimentoRtc,
    aliquotaCbsIbsRefPct,
    valorCbsIbsNoDas: fromCents(valorCbsIbsNoDasCents),
    valorCbsIbsPorFora: fromCents(valorCbsIbsPorForaCents),
    creditoTransferivelPj: fromCents(creditoTransferivelPjCents),
    totalTributosMes: fromCents(totalTributosMesCents),
    cargaEfetivaTotalPct,
    diferencaPorForaVsDas: fromCents(diferencaPorForaVsDasCents),
    receitaLiquidaEstimada: fromCents(receitaLiquidaCents),
  };
}

export const MAX_NFSE_XML_BYTES = 2 * 1024 * 1024; // 2 MB

export interface ParsedNfseData {
  formato: 'nacional' | 'abrasf' | 'generico';
  numero: string;
  dataEmissao: string;
  prestadorNome: string;
  prestadorCnpj: string;
  tomadorNome: string;
  tomadorDocumento: string;
  discriminacao: string;
  codigoServico: string;
  valorServicos: number;
  valorIss: number;
  aliquotaIss: number;
  issRetido: boolean;
  valorCbs: number;
  valorIbs: number;
  valorLiquido: number;
}

export type ParsedNfseResult =
  | { ok: true; data: ParsedNfseData }
  | { ok: false; error: string };

export type SanitizedNfseXmlResult =
  | { ok: true; xml: string }
  | { ok: false; error: string };

const FORBIDDEN_XML_CONSTRUCTS_REGEX =
  /<!(?:DOCTYPE|ENTITY|ATTLIST|NOTATION)\b|<\?xml-stylesheet\b|<(?:[a-zA-Z0-9_-]+:)?include\b/i;

// Remove controles C0 (exceto \t, \n, \r), DEL/C1 (0x7F-0x9F), Unicode Bidi overrides/isolates/ALM e não-caracteres XML
const UNSAFE_XML_TEXT_CHARS_REGEX =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u202A-\u202E\u2066-\u2069\uFFFE\uFFFF]/g;

/**
 * Converte apenas letras ASCII (A-Z -> a-z), preservando estritamente o comprimento da string
 * (evita deslocamento de índices causado por Unicode case-folding como U+0130 'İ' -> 'i\u0307').
 */
function toAsciiLower(str: string): string {
  return str.replace(/[A-Z]+/g, (m) => m.toLowerCase());
}

function isAsciiWs(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function isXmlPrefixCharCode(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    (code >= 48 && code <= 57) || // 0-9
    code === 95 || // _
    code === 45 // -
  );
}

function isXmlNameStartCharCode(code: number): boolean {
  return (
    (code >= 97 && code <= 122) || // a-z
    (code >= 65 && code <= 90) || // A-Z
    code === 95 // _
  );
}

function isXmlNameCharCode(code: number): boolean {
  return isXmlPrefixCharCode(code) || code === 46; // .
}

function isUnsafeXmlCodePoint(cp: number): boolean {
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff) return true;
  // Surrogates UTF-16 isolados
  if (cp >= 0xd800 && cp <= 0xdfff) return true;
  // Controles C0 (exceto \t, \n, \r)
  if (cp <= 0x1f && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) return true;
  // DEL e controles C1
  if (cp >= 0x7f && cp <= 0x9f) return true;
  // Unicode Bidi overrides / isolates / ALM
  if (
    cp === 0x061c ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2066 && cp <= 0x2069)
  ) {
    return true;
  }
  // Não-caracteres proibidos pelo XML 1.0
  if (cp === 0xfffe || cp === 0xffff) return true;
  return false;
}

function stripLoneSurrogates(text: string): string {
  let hasSurrogate = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      hasSurrogate = true;
      break;
    }
  }
  if (!hasSurrogate) return text;

  const parts: string[] = [];
  let segStart = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++; // Par surrogate válido: preserva
      } else {
        if (i > segStart) parts.push(text.slice(segStart, i));
        parts.push(' ');
        segStart = i + 1;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      if (i > segStart) parts.push(text.slice(segStart, i));
      parts.push(' ');
      segStart = i + 1;
    }
  }
  if (segStart < text.length) {
    parts.push(text.slice(segStart));
  }
  return parts.join('');
}

/**
 * Detecta construções XML perigosas: XXE (DOCTYPE/ENTITY/ATTLIST/NOTATION),
 * folhas de estilo XSLT externas (<?xml-stylesheet) e inclusões W3C XInclude (<xi:include / <include).
 */
export function hasForbiddenXmlConstructs(xmlText: string): boolean {
  if (typeof xmlText !== 'string') return false;
  return FORBIDDEN_XML_CONSTRUCTS_REGEX.test(xmlText);
}

/**
 * Remove comentários XML (<!-- ... -->) em tempo estritamente linear O(N), sem backtracking.
 * Comentários não fechados são descartados até o final da string.
 */
export function stripXmlCommentsLinear(xml: string): string {
  if (!xml.includes('<!--')) return xml;
  const parts: string[] = [];
  let pos = 0;
  while (pos < xml.length) {
    const start = xml.indexOf('<!--', pos);
    if (start === -1) {
      parts.push(xml.slice(pos));
      break;
    }
    if (start > pos) {
      parts.push(xml.slice(pos, start));
    }
    const end = xml.indexOf('-->', start + 4);
    if (end === -1) {
      break;
    }
    pos = end + 3;
  }
  return parts.join('');
}

/**
 * Remove blocos <script>...</script> (inclusive com prefixo de namespace, auto-fechados ou não fechados)
 * em tempo estritamente linear O(N) case-insensitive, substituindo por espaço para impedir rejunção de tags.
 */
export function stripScriptBlocksLinear(xml: string): string {
  const lower = toAsciiLower(xml);
  if (!lower.includes('script')) return xml;

  const parts: string[] = [];
  let pos = 0;
  let scan = 0;

  while (scan < lower.length) {
    const idx = lower.indexOf('script', scan);
    if (idx === -1) break;

    const afterChar = lower[idx + 6];
    const hasValidAfter =
      afterChar === undefined || afterChar === '>' || afterChar === '/' || isAsciiWs(afterChar);
    if (!hasValidAfter) {
      scan = idx + 6;
      continue;
    }

    // Verifica se precede '<' ou '<prefix:'
    let tagStart = -1;
    if (idx >= pos + 1 && lower[idx - 1] === '<') {
      tagStart = idx - 1;
    } else if (idx >= pos + 2 && lower[idx - 1] === ':') {
      let k = idx - 2;
      while (k >= pos && isXmlPrefixCharCode(lower.charCodeAt(k))) {
        k--;
      }
      if (k >= pos && lower[k] === '<' && k < idx - 2) {
        tagStart = k;
      }
    }

    if (tagStart === -1) {
      scan = idx + 6;
      continue;
    }

    if (tagStart > pos) {
      parts.push(xml.slice(pos, tagStart));
    }
    parts.push(' ');

    const openEnd = lower.indexOf('>', idx + 6);
    if (openEnd === -1) {
      pos = xml.length;
      break;
    }

    // Verifica tag auto-fechada <script .../>
    let beforeGt = openEnd - 1;
    while (beforeGt > idx + 5 && isAsciiWs(lower[beforeGt])) {
      beforeGt--;
    }
    if (lower[beforeGt] === '/') {
      pos = openEnd + 1;
      scan = pos;
      continue;
    }

    // Busca tag de fechamento </[prefix:]script\s*> linearmente
    let closeScan = openEnd + 1;
    let foundCloseEnd = -1;
    while (closeScan < lower.length) {
      const closeSlash = lower.indexOf('</', closeScan);
      if (closeSlash === -1) break;

      let k = closeSlash + 2;
      const prefixStart = k;
      while (k < lower.length && isXmlPrefixCharCode(lower.charCodeAt(k))) {
        k++;
      }
      if (k > prefixStart && lower[k] === ':') {
        k++;
      } else {
        k = prefixStart;
      }

      if (lower.startsWith('script', k)) {
        let afterClose = k + 6;
        while (afterClose < lower.length && isAsciiWs(lower[afterClose])) {
          afterClose++;
        }
        if (lower[afterClose] === '>') {
          foundCloseEnd = afterClose;
          break;
        }
      }
      closeScan = closeSlash + 2;
    }

    if (foundCloseEnd === -1) {
      // <script> não fechado: descarta até o fim sem backtracking
      pos = xml.length;
      break;
    }

    pos = foundCloseEnd + 1;
    scan = pos;
  }

  if (pos < xml.length) {
    parts.push(xml.slice(pos));
  }
  return parts.join('');
}

function parseXmlTagLocalNameAt(
  lowerXml: string,
  start: number
): { localName: string; end: number } | null {
  const len = lowerXml.length;
  let p = start;
  while (p < len && isXmlPrefixCharCode(lowerXml.charCodeAt(p))) {
    p++;
  }
  let localStart = start;
  if (p > start && lowerXml[p] === ':') {
    localStart = p + 1;
  }
  if (localStart >= len || !isXmlNameStartCharCode(lowerXml.charCodeAt(localStart))) {
    return null;
  }
  let end = localStart + 1;
  while (end < len && isXmlNameCharCode(lowerXml.charCodeAt(end))) {
    end++;
  }
  return { localName: lowerXml.slice(localStart, end), end };
}

/**
 * Verifica em tempo linear O(N) (sem regex com backreference \1) se o XML contém
 * ao menos uma tag de abertura <tag...> acompanhada posteriormente de sua tag de fechamento </tag>.
 */
export function hasValidElementPairLinear(xml: string): boolean {
  const lower = toAsciiLower(xml);
  const len = lower.length;
  const openedTags = new Set<string>();
  let pos = 0;

  while (pos < len) {
    const lt = lower.indexOf('<', pos);
    if (lt === -1 || lt + 1 >= len) break;

    const next = lower[lt + 1];

    // Pula blocos <![CDATA[...]]>
    if (next === '!' && lower.startsWith('<![cdata[', lt)) {
      const cdataEnd = lower.indexOf(']]>', lt + 9);
      if (cdataEnd === -1) break;
      pos = cdataEnd + 3;
      continue;
    }

    // Pula instruções de processamento <?...?> e declarações <!...>
    if (next === '?' || next === '!') {
      const gt = lower.indexOf('>', lt + 2);
      if (gt === -1) break;
      pos = gt + 1;
      continue;
    }

    // Tag de fechamento </[prefix:]tag>
    if (next === '/') {
      const parsed = parseXmlTagLocalNameAt(lower, lt + 2);
      if (!parsed) {
        pos = lt + 2;
        continue;
      }
      let i = parsed.end;
      while (i < len && isAsciiWs(lower[i])) {
        i++;
      }
      if (i < len && lower[i] === '>') {
        if (openedTags.has(parsed.localName)) {
          return true;
        }
        pos = i + 1;
      } else {
        pos = Math.max(lt + 2, i);
      }
      continue;
    }

    // Tag de abertura <[prefix:]tag ...>
    const parsed = parseXmlTagLocalNameAt(lower, lt + 1);
    if (!parsed) {
      pos = lt + 1;
      continue;
    }

    const afterName = parsed.end;
    if (afterName >= len) break;

    const chAfter = lower[afterName];
    if (chAfter === '>') {
      openedTags.add(parsed.localName);
      pos = afterName + 1;
      continue;
    }

    if (chAfter === '/' && lower[afterName + 1] === '>') {
      // Tag auto-fechada <tag/>
      pos = afterName + 2;
      continue;
    }

    if (!isAsciiWs(chAfter)) {
      pos = afterName;
      continue;
    }

    // Varre atributos até '>' ou '<' (linear, sem jamais revisitar caracteres)
    let i = afterName + 1;
    let lastNonWs = '';
    while (i < len) {
      const ch = lower[i];
      if (ch === '>' || ch === '<') break;
      if (!isAsciiWs(ch)) {
        lastNonWs = ch;
      }
      i++;
    }

    if (i < len && lower[i] === '>') {
      if (lastNonWs !== '/') {
        openedTags.add(parsed.localName);
      }
      pos = i + 1;
    } else {
      // Encontrou outro '<' ou EOF sem fechar '>'
      pos = i;
    }
  }

  return false;
}

/**
 * Extrai o conteúdo interno do primeiro bloco <[ns:]tagName ...>...</[ns:]tagName>
 * em tempo estritamente linear O(N) usando indexOf (zero backtracking quadrático).
 */
export function extractXmlBlock(
  xml: string,
  tagName: string,
  precomputedLowerXml?: string
): string | null {
  if (!xml || !tagName || xml.length > MAX_NFSE_XML_BYTES) return null;
  const target = toAsciiLower(tagName);
  if (!target) return null;

  const lower =
    precomputedLowerXml && precomputedLowerXml.length === xml.length
      ? precomputedLowerXml
      : toAsciiLower(xml);
  const len = lower.length;
  const targetLen = target.length;

  let pos = 0;
  let contentStart = -1;

  // 1. Localiza a primeira tag de abertura válida <[prefix:]target ...> (não auto-fechada)
  while (pos < len) {
    const idx = lower.indexOf(target, pos);
    if (idx === -1) return null;

    // Verifica limite à esquerda: '<' ou '<prefix:'
    let validOpenLeft = false;
    if (idx >= 1 && lower[idx - 1] === '<') {
      validOpenLeft = true;
    } else if (idx >= 2 && lower[idx - 1] === ':') {
      let k = idx - 2;
      while (k >= 0 && isXmlPrefixCharCode(lower.charCodeAt(k))) {
        k--;
      }
      if (k >= 0 && lower[k] === '<' && k < idx - 2) {
        validOpenLeft = true;
      }
    }

    if (!validOpenLeft) {
      pos = idx + targetLen;
      continue;
    }

    // Verifica limite à direita: '>', '/', ou espaço em branco
    const afterIdx = idx + targetLen;
    if (afterIdx >= len) return null;
    const chAfter = lower[afterIdx];

    if (chAfter === '>') {
      contentStart = afterIdx + 1;
      break;
    }

    if (chAfter === '/' && lower[afterIdx + 1] === '>') {
      // Tag auto-fechada <tag/>: pula e continua procurando
      pos = afterIdx + 2;
      continue;
    }

    if (!isAsciiWs(chAfter)) {
      pos = afterIdx;
      continue;
    }

    // Varre atributos até '>' ou '<' (linear, sem rescan)
    let i = afterIdx + 1;
    let lastNonWs = '';
    while (i < len) {
      const ch = lower[i];
      if (ch === '>' || ch === '<') break;
      if (!isAsciiWs(ch)) {
        lastNonWs = ch;
      }
      i++;
    }

    if (i >= len) return null;
    if (lower[i] === '<') {
      pos = i;
      continue;
    }
    if (lastNonWs === '/') {
      pos = i + 1;
      continue;
    }

    contentStart = i + 1;
    break;
  }

  if (contentStart === -1) return null;

  // 2. Localiza a primeira tag de fechamento válida </[prefix:]target\s*> após contentStart
  let closeScan = contentStart;
  while (closeScan < len) {
    const cIdx = lower.indexOf(target, closeScan);
    if (cIdx === -1) return null;

    // Verifica limite à esquerda: '</' ou '</prefix:'
    let closeTagStart = -1;
    if (cIdx >= contentStart + 2 && lower[cIdx - 1] === '/' && lower[cIdx - 2] === '<') {
      closeTagStart = cIdx - 2;
    } else if (cIdx >= contentStart + 3 && lower[cIdx - 1] === ':') {
      let k = cIdx - 2;
      while (k >= contentStart && isXmlPrefixCharCode(lower.charCodeAt(k))) {
        k--;
      }
      if (k >= contentStart + 1 && lower[k] === '/' && lower[k - 1] === '<' && k < cIdx - 2) {
        closeTagStart = k - 1;
      }
    }

    if (closeTagStart === -1) {
      closeScan = cIdx + targetLen;
      continue;
    }

    // Verifica espaços opcionais e '>' à direita
    let afterClose = cIdx + targetLen;
    while (afterClose < len && isAsciiWs(lower[afterClose])) {
      afterClose++;
    }
    if (afterClose < len && lower[afterClose] === '>') {
      return xml.slice(contentStart, closeTagStart);
    }

    closeScan = afterClose;
  }

  return null;
}

function extractFirstXmlBlock(
  xml: string,
  tagNames: readonly string[],
  precomputedLowerXml?: string
): string | null {
  for (const tag of tagNames) {
    const block = extractXmlBlock(xml, tag, precomputedLowerXml);
    if (block !== null) return block;
  }
  return null;
}

function decodeXmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g,
    (_match, entity: string) => {
      switch (entity) {
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        default: {
          const codePoint = entity.startsWith('#x')
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
          if (isUnsafeXmlCodePoint(codePoint)) {
            return ' ';
          }
          return String.fromCodePoint(codePoint);
        }
      }
    }
  );
}

function unwrapCdataAndStripSubtagsLinear(raw: string): string {
  if (!raw.includes('<![CDATA[')) {
    return decodeXmlEntities(raw.replace(/<[^<>]+>/g, ' '));
  }

  const parts: string[] = [];
  let pos = 0;

  while (pos < raw.length) {
    const start = raw.indexOf('<![CDATA[', pos);
    if (start === -1) {
      const tail = raw.slice(pos);
      if (tail) {
        parts.push(decodeXmlEntities(tail.replace(/<[^<>]+>/g, ' ')));
      }
      break;
    }

    if (start > pos) {
      const before = raw.slice(pos, start);
      parts.push(decodeXmlEntities(before.replace(/<[^<>]+>/g, ' ')));
    }

    const end = raw.indexOf(']]>', start + 9);
    if (end === -1) {
      parts.push(raw.slice(start + 9));
      break;
    }

    parts.push(raw.slice(start + 9, end));
    pos = end + 3;
  }

  return parts.join('');
}

function sanitizeExtractedXmlText(raw: string): string {
  const unwrapped = unwrapCdataAndStripSubtagsLinear(raw);
  const withoutScripts = stripScriptBlocksLinear(unwrapped);
  const withoutAngleBrackets = withoutScripts.replace(/[<>]/g, '');
  const withoutSurrogates = stripLoneSurrogates(withoutAngleBrackets);
  return withoutSurrogates.replace(UNSAFE_XML_TEXT_CHARS_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

function extractXmlText(
  xml: string,
  tagNames: readonly string[],
  precomputedLowerXml?: string
): string {
  const block = extractFirstXmlBlock(xml, tagNames, precomputedLowerXml);
  if (block === null) return '';
  return sanitizeExtractedXmlText(block);
}

function parseXmlDecimal(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.trim().replace(/[^\d.,-]/g, '');
  if (!cleaned) return 0;
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function parseIssRetidoFlag(raw: string, isNacional: boolean): boolean {
  if (!raw) return false;
  const val = raw.trim().toLowerCase();
  if (isNacional) {
    // Padrão Nacional tpRetISSQN: 1 = Não Retido, 2 = Retido pelo Tomador, 3 = Retido pelo Intermediário
    return val === '2' || val === '3' || val === 'true' || val === 'sim';
  }
  // ABRASF IssRetido: 1 = Sim, 2 = Não
  return val === '1' || val === 'true' || val === 'sim' || val === 's';
}

/**
 * Valida e higieniza o XML de NFS-e antes do envio ao serviço local DANFSe (Receita Federal).
 * Garante limite <= 2 MB (com checagem pré-TextEncoder), bloqueio contra XXE/ATTLIST/NOTATION/XSLT/XInclude
 * e remoção linear O(N) de comentários XML e blocos <script>.
 */
export function sanitizeNfseXmlForLocalService(xmlText: string): SanitizedNfseXmlResult {
  if (typeof xmlText !== 'string' || !xmlText.trim()) {
    return { ok: false, error: 'XML vazio ou inválido.' };
  }

  // Checagem rápida O(1) antes de alocar Uint8Array em TextEncoder
  if (xmlText.length > MAX_NFSE_XML_BYTES) {
    return { ok: false, error: 'Arquivo XML excede o limite máximo de 2 MB.' };
  }

  const byteLength = new TextEncoder().encode(xmlText).byteLength;
  if (byteLength > MAX_NFSE_XML_BYTES) {
    return { ok: false, error: 'Arquivo XML excede o limite máximo de 2 MB.' };
  }

  const trimmed = xmlText.trim();
  if (!trimmed.startsWith('<') || !trimmed.includes('>')) {
    return { ok: false, error: 'Conteúdo não parece ser um documento XML válido.' };
  }

  if (hasForbiddenXmlConstructs(trimmed)) {
    return {
      ok: false,
      error:
        'XML rejeitado por conter construções proibidas (DOCTYPE, ENTITY, ATTLIST, NOTATION, xml-stylesheet ou XInclude).',
    };
  }

  const withoutComments = stripXmlCommentsLinear(trimmed);
  const withoutScripts = stripScriptBlocksLinear(withoutComments).trim();

  if (!withoutScripts || !withoutScripts.startsWith('<') || !withoutScripts.includes('>')) {
    return { ok: false, error: 'Conteúdo não parece ser um documento XML válido.' };
  }

  // Segunda checagem pós-remoção de comentários/scripts contra smuggling fragmentado
  if (hasForbiddenXmlConstructs(withoutScripts)) {
    return {
      ok: false,
      error:
        'XML rejeitado por conter construções proibidas (DOCTYPE, ENTITY, ATTLIST, NOTATION, xml-stylesheet ou XInclude).',
    };
  }

  return { ok: true, xml: withoutScripts };
}

/**
 * Parser determinístico e seguro de XML de NFS-e (Padrão Nacional + ABRASF 2.04).
 * 100% offline, estritamente linear O(N) contra ReDoS, imune a XXE/XInclude/XSLT/scripts,
 * preserva blocos <![CDATA[...]]> e sanitiza entidades perigosas/Bidi, com limite de 2 MB.
 */
export function parseNfseXml(xmlText: string): ParsedNfseResult {
  const sanitized = sanitizeNfseXmlForLocalService(xmlText);
  if (!sanitized.ok) {
    return sanitized;
  }

  const sanitizedXml = sanitized.xml;

  if (!hasValidElementPairLinear(sanitizedXml)) {
    return { ok: false, error: 'XML malformado: nenhuma estrutura de tags balanceada encontrada.' };
  }

  const isNacional =
    /<(?:[a-zA-Z0-9_-]+:)?(?:DPS|infDPS|nNFSe|vServPrest|xDescServ|cTribNac|tpRetISSQN)\b/i.test(
      sanitizedXml
    );
  const isAbrasf =
    !isNacional &&
    /<(?:[a-zA-Z0-9_-]+:)?(?:CompNfse|InfNfse|PrestadorServico|TomadorServico|ValorServicos)\b/i.test(
      sanitizedXml
    );

  const hasKnownNfseField =
    isNacional ||
    isAbrasf ||
    /<(?:[a-zA-Z0-9_-]+:)?(?:NFSe|Nfse|ValorLiquidoNfse|Discriminacao|xDescServ)\b/i.test(
      sanitizedXml
    );

  if (!hasKnownNfseField) {
    return {
      ok: false,
      error: 'XML não reconhecido como NFS-e (Padrão Nacional ou ABRASF).',
    };
  }

  const formato: ParsedNfseData['formato'] = isNacional
    ? 'nacional'
    : isAbrasf
      ? 'abrasf'
      : 'generico';

  const lowerXml = toAsciiLower(sanitizedXml);

  const prestadorBlock =
    extractFirstXmlBlock(
      sanitizedXml,
      ['emit', 'PrestadorServico', 'prest', 'Prestador'],
      lowerXml
    ) ?? '';
  const tomadorBlock =
    extractFirstXmlBlock(sanitizedXml, ['toma', 'TomadorServico', 'Tomador'], lowerXml) ?? '';

  const numero = extractXmlText(sanitizedXml, ['nNFSe', 'Numero', 'nDPS'], lowerXml);
  const dataEmissao = extractXmlText(
    sanitizedXml,
    ['dhEmi', 'dhProc', 'DataEmissao', 'dCompet'],
    lowerXml
  );

  const prestadorNome = extractXmlText(prestadorBlock, ['xNome', 'RazaoSocial', 'NomeFantasia']);
  const prestadorCnpj = extractXmlText(prestadorBlock, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']);

  const tomadorNome = extractXmlText(tomadorBlock, ['xNome', 'RazaoSocial', 'NomeFantasia']);
  const tomadorDocumento = extractXmlText(tomadorBlock, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']);

  const discriminacao = extractXmlText(
    sanitizedXml,
    ['xDescServ', 'Discriminacao', 'xServ'],
    lowerXml
  );
  const codigoServico = extractXmlText(
    sanitizedXml,
    ['cTribNac', 'ItemListaServico', 'CodigoTributacaoMunicipio', 'cServ'],
    lowerXml
  );

  const valorServicos = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vServ', 'ValorServicos'], lowerXml)))
  );
  const valorIss = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vISSQN', 'ValorIss', 'vISS'], lowerXml)))
  );
  const aliquotaIss = roundPct(
    parseXmlDecimal(extractXmlText(sanitizedXml, ['pAliq', 'pAliqAplic', 'Aliquota'], lowerXml)),
    4
  );

  const issRetidoRaw = extractXmlText(sanitizedXml, ['tpRetISSQN', 'IssRetido'], lowerXml);
  const issRetido = parseIssRetidoFlag(issRetidoRaw, isNacional);

  const valorCbs = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vCBS', 'ValorCbs', 'vCbs'], lowerXml)))
  );
  const valorIbs = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vIBS', 'ValorIbs', 'vIbs'], lowerXml)))
  );

  const valorLiquidoRaw = extractXmlText(sanitizedXml, ['vLiq', 'ValorLiquidoNfse'], lowerXml);
  const valorLiquidoParsed = fromCents(toCents(parseXmlDecimal(valorLiquidoRaw)));
  const valorLiquido =
    valorLiquidoParsed > 0
      ? valorLiquidoParsed
      : fromCents(Math.max(0, toCents(valorServicos) - (issRetido ? toCents(valorIss) : 0)));

  return {
    ok: true,
    data: {
      formato,
      numero,
      dataEmissao,
      prestadorNome,
      prestadorCnpj,
      tomadorNome,
      tomadorDocumento,
      discriminacao,
      codigoServico,
      valorServicos,
      valorIss,
      aliquotaIss,
      issRetido,
      valorCbs,
      valorIbs,
      valorLiquido,
    },
  };
}
