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

function decodeXmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g,
    (match, entity: string) => {
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
          if (Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff) {
            return String.fromCodePoint(codePoint);
          }
          return match;
        }
      }
    }
  );
}

function stripCdataAndClean(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  return decodeXmlEntities(withoutCdata).replace(/\s+/g, ' ').trim();
}

function extractXmlBlock(xml: string, tagNames: string[]): string | null {
  for (const tag of tagNames) {
    const regex = new RegExp(
      `<(?:[a-zA-Z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tag}>`,
      'i'
    );
    const match = regex.exec(xml);
    if (match && match[1] !== undefined) {
      return match[1];
    }
  }
  return null;
}

function extractXmlText(xml: string, tagNames: string[]): string {
  const block = extractXmlBlock(xml, tagNames);
  if (block === null) return '';
  // Remove eventuais subtags se a tag alvo contiver texto simples
  const plain = block.replace(/<[^>]+>/g, ' ');
  return stripCdataAndClean(plain);
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
 * Parser determinístico e seguro de XML de NFS-e (Padrão Nacional + ABRASF 2.04).
 * 100% offline, imune a XXE/execução de scripts, tolerante a namespaces XML e com limite de 2 MB.
 */
export function parseNfseXml(xmlText: string): ParsedNfseResult {
  if (typeof xmlText !== 'string' || !xmlText.trim()) {
    return { ok: false, error: 'XML vazio ou inválido.' };
  }

  const byteLength = new TextEncoder().encode(xmlText).byteLength;
  if (byteLength > MAX_NFSE_XML_BYTES) {
    return { ok: false, error: 'Arquivo XML excede o limite máximo de 2 MB.' };
  }

  const trimmed = xmlText.trim();
  if (!trimmed.startsWith('<') || !trimmed.includes('>')) {
    return { ok: false, error: 'Conteúdo não parece ser um documento XML válido.' };
  }

  // Defesa contra XXE / entidades externas / scripts embutidos
  if (/<!(?:DOCTYPE|ENTITY)\b/i.test(trimmed)) {
    return { ok: false, error: 'XML rejeitado por conter declarações DOCTYPE/ENTITY não permitidas.' };
  }

  // Remove comentários XML e possíveis blocos <script> antes da leitura de campos
  const sanitizedXml = trimmed
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const hasValidElementPair =
    /<(?:[a-zA-Z0-9_-]+:)?([a-zA-Z_][\w.-]*)(?:\s[^>]*)?>[\s\S]*?<\/(?:[a-zA-Z0-9_-]+:)?\1>/i.test(
      sanitizedXml
    );
  if (!hasValidElementPair) {
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

  const prestadorBlock =
    extractXmlBlock(sanitizedXml, ['emit', 'PrestadorServico', 'prest', 'Prestador']) ?? '';
  const tomadorBlock =
    extractXmlBlock(sanitizedXml, ['toma', 'TomadorServico', 'Tomador']) ?? '';

  const numero = extractXmlText(sanitizedXml, ['nNFSe', 'Numero', 'nDPS']);
  const dataEmissao = extractXmlText(sanitizedXml, ['dhEmi', 'dhProc', 'DataEmissao', 'dCompet']);

  const prestadorNome = extractXmlText(prestadorBlock, ['xNome', 'RazaoSocial', 'NomeFantasia']);
  const prestadorCnpj = extractXmlText(prestadorBlock, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']);

  const tomadorNome = extractXmlText(tomadorBlock, ['xNome', 'RazaoSocial', 'NomeFantasia']);
  const tomadorDocumento = extractXmlText(tomadorBlock, ['CNPJ', 'Cnpj', 'CPF', 'Cpf']);

  const discriminacao = extractXmlText(sanitizedXml, ['xDescServ', 'Discriminacao', 'xServ']);
  const codigoServico = extractXmlText(sanitizedXml, [
    'cTribNac',
    'ItemListaServico',
    'CodigoTributacaoMunicipio',
    'cServ',
  ]);

  const valorServicos = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vServ', 'ValorServicos'])))
  );
  const valorIss = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vISSQN', 'ValorIss', 'vISS'])))
  );
  const aliquotaIss = roundPct(
    parseXmlDecimal(extractXmlText(sanitizedXml, ['pAliq', 'pAliqAplic', 'Aliquota'])),
    4
  );

  const issRetidoRaw = extractXmlText(sanitizedXml, ['tpRetISSQN', 'IssRetido']);
  const issRetido = parseIssRetidoFlag(issRetidoRaw, isNacional);

  const valorCbs = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vCBS', 'ValorCbs', 'vCbs'])))
  );
  const valorIbs = fromCents(
    toCents(parseXmlDecimal(extractXmlText(sanitizedXml, ['vIBS', 'ValorIbs', 'vIbs'])))
  );

  const valorLiquidoRaw = extractXmlText(sanitizedXml, ['vLiq', 'ValorLiquidoNfse']);
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
