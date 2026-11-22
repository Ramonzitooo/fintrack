import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileCode2,
  PlusCircle,
  Printer,
  RefreshCw,
  Scale,
  Server,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { fmtBRL, formatMonthYear } from '../utils/storage';
import { fromCents, toCents } from '../utils/financeMath';
import {
  calculateRegimeRegularRtc,
  calculateSimplesNacionalRtc,
  getRtcScheduleForYear,
  MAX_NFSE_XML_BYTES,
  parseNfseXml,
  RTC_REDUCTION_PRESETS,
  RTC_TRANSITION_SCHEDULE,
  RtcReductionPresetId,
  sanitizeNfseXmlForLocalService,
  SIMPLES_ANEXOS,
  SimplesAnexo,
  SimplesRtcModo,
} from '../utils/taxRtcMath';
import {
  checkLocalRtcHealth,
  DEFAULT_LOCAL_RTC_ENDPOINTS,
  generateOfficialDanfsePdfLocal,
  isAllowedLocalRtcUrl,
  LocalRtcHealthResult,
} from '../utils/taxRtcClient';

export interface TaxExpenseLaunchPayload {
  descricao: string;
  valor: number;
  categoria: 'Impostos';
}

export interface TaxRtcTabProps {
  competenciaAtual: string;
  onLaunchTaxExpense: (payload: TaxExpenseLaunchPayload) => void;
}

type RtcSubTabId = 'regular' | 'simples' | 'danfse';

const SUB_TABS: readonly { id: RtcSubTabId; label: string; shortLabel: string }[] = [
  { id: 'regular', label: 'Regime Regular (CBS / IBS / IS)', shortLabel: 'Regime Regular' },
  { id: 'simples', label: 'Simples Nacional (RTC + Fator R)', shortLabel: 'Simples Nacional' },
  { id: 'danfse', label: 'XML NFS-e & DANFSe', shortLabel: 'XML & DANFSe' },
] as const;

const fmtPct = (value: number, decimals = 2): string =>
  `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;

const parseNumericInput = (raw: string): number => {
  const cleaned = raw.trim().replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function formatDocumentId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return raw || 'Não informado';
}

function formatNfseDate(raw: string): string {
  if (!raw) return 'Não informada';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(raw.trim());
  if (!match) return raw;
  const [, yyyy, mm, dd, hh, min] = match;
  return hh && min ? `${dd}/${mm}/${yyyy} ${hh}:${min}` : `${dd}/${mm}/${yyyy}`;
}

export const TaxRtcTab: React.FC<TaxRtcTabProps> = ({ competenciaAtual, onLaunchTaxExpense }) => {
  const [activeSubTab, setActiveSubTab] = useState<RtcSubTabId>('regular');
  const subTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // --- Sub-aba 1: Regime Regular (CBS / IBS / IS) ---
  const [regValorOperacao, setRegValorOperacao] = useState<string>('10000');
  const [regAno, setRegAno] = useState<number>(2026);
  const [regPresetId, setRegPresetId] = useState<RtcReductionPresetId>('padrao');
  const [regCreditos, setRegCreditos] = useState<string>('0');
  const [regAliquotaIS, setRegAliquotaIS] = useState<string>('0');

  // --- Sub-aba 2: Simples Nacional (RTC + Fator R) ---
  const [simpFaturamento, setSimpFaturamento] = useState<string>('15000');
  const [simpRbt12, setSimpRbt12] = useState<string>('180000');
  const [simpAnexo, setSimpAnexo] = useState<SimplesAnexo>('V');
  const [simpFolha12m, setSimpFolha12m] = useState<string>('54000');
  const [simpAno, setSimpAno] = useState<number>(2026);
  const [simpModoRtc, setSimpModoRtc] = useState<SimplesRtcModo>('das');

  // --- Sub-aba 3: XML NFS-e & DANFSe ---
  const [xmlText, setXmlText] = useState<string>('');
  const [xmlFileName, setXmlFileName] = useState<string | null>(null);
  const [xmlUploadError, setXmlUploadError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<boolean>(false);
  const [pdfFeedback, setPdfFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(
    null
  );

  // --- Conector Local Receita Federal (Opcional — MIT) ---
  const [connectorOpen, setConnectorOpen] = useState<boolean>(false);
  const [endpoints, setEndpoints] = useState({
    regimeRegular: String(DEFAULT_LOCAL_RTC_ENDPOINTS.regimeRegular),
    simplesNacional: String(DEFAULT_LOCAL_RTC_ENDPOINTS.simplesNacional),
    geradorDanfse: String(DEFAULT_LOCAL_RTC_ENDPOINTS.geradorDanfse),
  });
  const [healthBusy, setHealthBusy] = useState<boolean>(false);
  const [healthStatus, setHealthStatus] = useState<{
    regimeRegular?: LocalRtcHealthResult;
    simplesNacional?: LocalRtcHealthResult;
    geradorDanfse?: LocalRtcHealthResult;
  }>({});

  // Navegação acessível por teclado no tablist de sub-abas (WAI-ARIA APG)
  const handleSubTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let targetIdx = idx;
    if (e.key === 'ArrowRight') {
      targetIdx = (idx + 1) % SUB_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      targetIdx = (idx - 1 + SUB_TABS.length) % SUB_TABS.length;
    } else if (e.key === 'Home') {
      targetIdx = 0;
    } else if (e.key === 'End') {
      targetIdx = SUB_TABS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setActiveSubTab(SUB_TABS[targetIdx].id);
    subTabRefs.current[targetIdx]?.focus();
  };

  // Cálculos determinísticos — Sub-aba 1
  const regSchedule = useMemo(() => getRtcScheduleForYear(regAno), [regAno]);
  const regPreset = RTC_REDUCTION_PRESETS[regPresetId];
  const regResult = useMemo(
    () =>
      calculateRegimeRegularRtc({
        valorOperacao: parseNumericInput(regValorOperacao),
        ano: regAno,
        reducaoPct: regPreset.reducaoPct,
        creditosInsumos: parseNumericInput(regCreditos),
        aliquotaIS: parseNumericInput(regAliquotaIS),
      }),
    [regValorOperacao, regAno, regPreset.reducaoPct, regCreditos, regAliquotaIS]
  );

  // Rateio determinístico do crédito aproveitado entre CBS e IBS para exibição líquida exata em centavos
  const { cbsLiquido, ibsLiquido } = useMemo(() => {
    const cbsBrutoCents = toCents(regResult.valorCbsBruto);
    const ibsBrutoCents = toCents(regResult.valorIbsBruto);
    const debitoCbsIbsCents = cbsBrutoCents + ibsBrutoCents;
    const credCents = toCents(regResult.creditoAproveitado);
    if (debitoCbsIbsCents <= 0 || credCents <= 0) {
      return {
        cbsLiquido: regResult.valorCbsBruto,
        ibsLiquido: regResult.valorIbsBruto,
      };
    }
    const credCbsCents = Math.min(
      cbsBrutoCents,
      Math.round((credCents * cbsBrutoCents) / debitoCbsIbsCents)
    );
    const credIbsCents = Math.min(ibsBrutoCents, Math.max(0, credCents - credCbsCents));
    return {
      cbsLiquido: fromCents(Math.max(0, cbsBrutoCents - credCbsCents)),
      ibsLiquido: fromCents(Math.max(0, ibsBrutoCents - credIbsCents)),
    };
  }, [regResult.valorCbsBruto, regResult.valorIbsBruto, regResult.creditoAproveitado]);

  // Cálculos determinísticos — Sub-aba 2
  const simpResult = useMemo(
    () =>
      calculateSimplesNacionalRtc({
        faturamentoMes: parseNumericInput(simpFaturamento),
        rbt12: parseNumericInput(simpRbt12),
        anexo: simpAnexo,
        folha12m: parseNumericInput(simpFolha12m),
        ano: simpAno,
        modoRecolhimentoRtc: simpModoRtc,
      }),
    [simpFaturamento, simpRbt12, simpAnexo, simpFolha12m, simpAno, simpModoRtc]
  );

  // Parser determinístico — Sub-aba 3
  const parsedNfse = useMemo(() => {
    if (!xmlText.trim()) return null;
    return parseNfseXml(xmlText);
  }, [xmlText]);

  const totalTributosNota = useMemo(() => {
    if (!parsedNfse || !parsedNfse.ok) return 0;
    const { valorIss, valorCbs, valorIbs } = parsedNfse.data;
    return fromCents(toCents(valorIss) + toCents(valorCbs) + toCents(valorIbs));
  }, [parsedNfse]);

  const handleXmlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlUploadError(null);
    setPdfFeedback(null);
    if (file.size > MAX_NFSE_XML_BYTES) {
      setXmlUploadError('Arquivo XML excede o limite máximo de 2 MB.');
      e.target.value = '';
      return;
    }
    try {
      const content = await file.text();
      setXmlFileName(file.name);
      setXmlText(content);
    } catch {
      setXmlUploadError('Não foi possível ler o arquivo XML selecionado.');
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateOfficialDanfsePdf = async () => {
    if (!xmlText.trim() || !parsedNfse?.ok) return;
    const sanitized = sanitizeNfseXmlForLocalService(xmlText);
    if (!sanitized.ok) {
      setPdfFeedback({ type: 'error', message: sanitized.error });
      return;
    }
    setPdfBusy(true);
    setPdfFeedback(null);
    try {
      const result = await generateOfficialDanfsePdfLocal(endpoints.geradorDanfse, sanitized.xml);
      if (!result.ok) {
        setPdfFeedback({ type: 'error', message: result.error });
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      const safeNum = (parsedNfse.data.numero || 'nota').replace(/[^a-zA-Z0-9_-]/g, '');
      a.href = url;
      a.download = `DANFSe_${safeNum}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPdfFeedback({
        type: 'ok',
        message: 'PDF oficial DANFSe gerado pelo serviço local da Receita Federal.',
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const handleTestLocalHealth = async () => {
    setHealthBusy(true);
    try {
      const [regRes, simpRes, danfseRes] = await Promise.all([
        checkLocalRtcHealth(endpoints.regimeRegular),
        checkLocalRtcHealth(endpoints.simplesNacional),
        checkLocalRtcHealth(endpoints.geradorDanfse),
      ]);
      setHealthStatus({
        regimeRegular: regRes,
        simplesNacional: simpRes,
        geradorDanfse: danfseRes,
      });
    } finally {
      setHealthBusy(false);
    }
  };

  const renderHealthBadge = (res?: LocalRtcHealthResult, url?: string) => {
    const validLocal = url ? isAllowedLocalRtcUrl(url) : true;
    if (!validLocal) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
          Bloqueada (não local)
        </span>
      );
    }
    if (!res) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          Não testado
        </span>
      );
    }
    if (res.online) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
          Online {res.status ? `(HTTP ${res.status})` : ''}
        </span>
      );
    }
    return (
      <span
        title={res.error || 'Serviço local indisponível'}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
      >
        <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
        Offline
      </span>
    );
  };

  const danfseUrlValid = isAllowedLocalRtcUrl(endpoints.geradorDanfse);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Aba */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Impostos & Reforma Tributária (RTC)
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Simulador determinístico 100% offline para CBS, IBS, Imposto Seletivo (2026–2033), Simples Nacional com Fator R e leitura local de XML NFS-e / DANFSe.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Competência: {formatMonthYear(competenciaAtual)}
            </span>
          </div>
        </div>

        {/* Sub-abas Acessíveis (WAI-ARIA APG) */}
        <div
          role="tablist"
          aria-label="Módulos da Reforma Tributária"
          aria-orientation="horizontal"
          className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 dark:border-slate-800 pt-4"
        >
          {SUB_TABS.map((tab, idx) => {
            const isSelected = activeSubTab === tab.id;
            const Icon =
              tab.id === 'regular' ? Scale : tab.id === 'simples' ? Building2 : FileCode2;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  subTabRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                id={`rtc-subtab-${tab.id}`}
                aria-selected={isSelected}
                aria-controls={`rtc-panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveSubTab(tab.id)}
                onKeyDown={(e) => handleSubTabKeyDown(e, idx)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* SUB-ABA 1: REGIME REGULAR (CBS / IBS / IS — 2026 A 2033) */}
      <section
        role="tabpanel"
        id="rtc-panel-regular"
        aria-labelledby="rtc-subtab-regular"
        hidden={activeSubTab !== 'regular'}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Formulário */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Parâmetros da Operação (LC 214/2025)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Não-cumulatividade plena com aproveitamento integral de créditos de insumos sobre CBS e IBS.
              </p>
            </div>

            <div className="space-y-3.5">
              <div>
                <label
                  htmlFor="rtc-reg-valor"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Valor da Operação (R$)
                </label>
                <input
                  id="rtc-reg-valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={regValorOperacao}
                  onChange={(e) => setRegValorOperacao(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums text-slate-900 dark:text-white privacy-val"
                />
              </div>

              <div>
                <label
                  htmlFor="rtc-reg-ano"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Ano da Transição (2026–2033)
                </label>
                <select
                  id="rtc-reg-ano"
                  value={regAno}
                  onChange={(e) => setRegAno(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {RTC_TRANSITION_SCHEDULE.map((item) => (
                    <option key={item.ano} value={item.ano}>
                      {item.ano} — {item.fase} (CBS {fmtPct(item.cbsPct, 1)} + IBS{' '}
                      {fmtPct(item.ibsPct, 2)})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  <strong className="text-slate-700 dark:text-slate-300">{regSchedule.fase}:</strong>{' '}
                  {regSchedule.descricao}
                </p>
              </div>

              <div>
                <label
                  htmlFor="rtc-reg-preset"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Regime / Redução de Alíquota
                </label>
                <select
                  id="rtc-reg-preset"
                  value={regPresetId}
                  onChange={(e) => setRegPresetId(e.target.value as RtcReductionPresetId)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {Object.values(RTC_REDUCTION_PRESETS).map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  {regPreset.descricao}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rtc-reg-creditos"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Créditos de Insumos (R$)
                  </label>
                  <input
                    id="rtc-reg-creditos"
                    type="number"
                    min="0"
                    step="0.01"
                    value={regCreditos}
                    onChange={(e) => setRegCreditos(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums text-slate-900 dark:text-white privacy-val"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rtc-reg-is"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Imposto Seletivo — IS (%)
                  </label>
                  <input
                    id="rtc-reg-is"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={regAliquotaIS}
                    onChange={(e) => setRegAliquotaIS(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Resultados Regime Regular */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Apuração Estimada — {regResult.ano} ({regResult.fase})
                </h2>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold tabular-nums">
                  Alíquota CBS {fmtPct(regResult.aliquotaCbsEfetiva, 2)} • IBS{' '}
                  {fmtPct(regResult.aliquotaIbsEfetiva, 2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    CBS Líquido (Federal)
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-1">
                    {fmtBRL(cbsLiquido)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Bruto: <span className="privacy-val">{fmtBRL(regResult.valorCbsBruto)}</span> (
                    {fmtPct(regResult.aliquotaCbsEfetiva, 2)})
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    IBS Líquido (Estados/Municípios)
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-1">
                    {fmtBRL(ibsLiquido)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Bruto: <span className="privacy-val">{fmtBRL(regResult.valorIbsBruto)}</span> (
                    {fmtPct(regResult.aliquotaIbsEfetiva, 2)})
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Imposto Seletivo (IS)
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-1">
                    {fmtBRL(regResult.valorIS)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Alíquota: {fmtPct(regResult.aliquotaISEfetiva, 2)}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5">
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    Crédito Aproveitado
                  </span>
                  <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300 tabular-nums privacy-val mt-1">
                    {fmtBRL(regResult.creditoAproveitado)}
                  </p>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {regResult.creditoExcedente > 0 ? (
                      <>
                        Saldo credor restante:{' '}
                        <span className="privacy-val">{fmtBRL(regResult.creditoExcedente)}</span>
                      </>
                    ) : (
                      'Abatido do débito CBS + IBS'
                    )}
                  </span>
                </div>
              </div>

              {/* Destaques Consolidados */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3.5">
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    Total de Tributos Líquido
                  </span>
                  <p className="text-xl font-extrabold text-rose-700 dark:text-rose-300 tabular-nums privacy-val mt-1">
                    {fmtBRL(regResult.totalTributosLiquido)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Carga Efetiva (%)
                  </span>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
                    {fmtPct(regResult.cargaEfetivaPct, 2)}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Valor Líquido da Operação
                  </span>
                  <p className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums privacy-val mt-1">
                    {fmtBRL(regResult.valorLiquidoOperacao)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lança o tributo líquido como despesa pendente na categoria <strong>Impostos</strong> em{' '}
                <strong>{formatMonthYear(competenciaAtual)}</strong>.
              </p>
              <button
                type="button"
                disabled={regResult.totalTributosLiquido <= 0}
                onClick={() =>
                  onLaunchTaxExpense({
                    descricao: `Tributos RTC ${regResult.ano} (CBS/IBS/IS)`,
                    valor: regResult.totalTributosLiquido,
                    categoria: 'Impostos',
                  })
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                Lançar tributo como despesa
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SUB-ABA 2: SIMPLES NACIONAL (RTC + FATOR R) */}
      <section
        role="tabpanel"
        id="rtc-panel-simples"
        aria-labelledby="rtc-subtab-simples"
        hidden={activeSubTab !== 'simples'}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Formulário Simples */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Simples Nacional (LC 123/2006 + RTC)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cálculo progressivo por faixa de RBT12, verificação automática do Fator R (28%) e comparativo CBS/IBS por fora.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rtc-simp-fat"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Faturamento do Mês (R$)
                  </label>
                  <input
                    id="rtc-simp-fat"
                    type="number"
                    min="0"
                    step="0.01"
                    value={simpFaturamento}
                    onChange={(e) => setSimpFaturamento(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums text-slate-900 dark:text-white privacy-val"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rtc-simp-rbt12"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    RBT12 — Receita 12 meses (R$)
                  </label>
                  <input
                    id="rtc-simp-rbt12"
                    type="number"
                    min="0"
                    step="0.01"
                    value={simpRbt12}
                    onChange={(e) => setSimpRbt12(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums text-slate-900 dark:text-white privacy-val"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="rtc-simp-anexo"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Anexo do Simples Nacional
                </label>
                <select
                  id="rtc-simp-anexo"
                  value={simpAnexo}
                  onChange={(e) => setSimpAnexo(e.target.value as SimplesAnexo)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {Object.values(SIMPLES_ANEXOS).map((anexo) => (
                    <option key={anexo.codigo} value={anexo.codigo}>
                      {anexo.nome}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {SIMPLES_ANEXOS[simpAnexo].descricao}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    htmlFor="rtc-simp-folha"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Folha de Salários 12m (R$)
                  </label>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    Fator R: {fmtPct(simpResult.fatorRPct, 2)}
                  </span>
                </div>
                <input
                  id="rtc-simp-folha"
                  type="number"
                  min="0"
                  step="0.01"
                  value={simpFolha12m}
                  onChange={(e) => setSimpFolha12m(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm tabular-nums text-slate-900 dark:text-white privacy-val"
                />
                {simpResult.migradoPorFatorR && (
                  <div
                    role="status"
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Fator R ≥ 28% ({fmtPct(simpResult.fatorRPct, 1)}): migrado automaticamente do Anexo V para o Anexo III!
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rtc-simp-ano"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Ano de Referência (RTC)
                  </label>
                  <select
                    id="rtc-simp-ano"
                    value={simpAno}
                    onChange={(e) => setSimpAno(Number(e.target.value))}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    {RTC_TRANSITION_SCHEDULE.map((item) => (
                      <option key={item.ano} value={item.ano}>
                        {item.ano} ({fmtPct(item.cbsPct + item.ibsPct, 2)} CBS+IBS)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="rtc-simp-modo"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    Modo RTC (CBS/IBS)
                  </label>
                  <select
                    id="rtc-simp-modo"
                    value={simpModoRtc}
                    onChange={(e) => setSimpModoRtc(e.target.value as SimplesRtcModo)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="das">Dentro do DAS (Padrão)</option>
                    <option value="por_fora">Recolher CBS/IBS por fora</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Resultados Simples */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Apuração Simples Nacional — Anexo {simpResult.anexoEfetivo} (Faixa {simpResult.faixa})
                </h2>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold tabular-nums">
                  Alíquota Efetiva DAS: {fmtPct(simpResult.aliquotaEfetivaPct, 2)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Faixa & Alíquota Efetiva
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                    Faixa {simpResult.faixa} • {fmtPct(simpResult.aliquotaEfetivaPct, 2)}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Nominal {fmtPct(simpResult.aliquotaNominalPct, 2)} • Deduzir{' '}
                    <span className="privacy-val">{fmtBRL(simpResult.parcelaDeduzir)}</span>
                  </span>
                </div>

                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3.5">
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    DAS Estimado (Modo Padrão)
                  </span>
                  <p className="text-lg font-extrabold text-rose-700 dark:text-rose-300 tabular-nums privacy-val mt-1">
                    {fmtBRL(simpResult.valorDasEstimado)}
                  </p>
                  <span className="text-[11px] text-rose-700/80 dark:text-rose-300/80 tabular-nums">
                    Total no modo selecionado:{' '}
                    <strong className="privacy-val">{fmtBRL(simpResult.totalTributosMes)}</strong> (
                    {fmtPct(simpResult.cargaEfetivaTotalPct, 2)})
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Estimativa CBS / IBS ({simpResult.anoRtc})
                  </span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-1">
                    {fmtBRL(
                      simpResult.modoRecolhimentoRtc === 'por_fora'
                        ? simpResult.valorCbsIbsPorFora
                        : simpResult.valorCbsIbsNoDas
                    )}
                  </p>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    Crédito transferível PJ:{' '}
                    <span className="privacy-val">{fmtBRL(simpResult.creditoTransferivelPj)}</span>
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Receita Líquida Estimada
                  </span>
                  <p className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums privacy-val mt-1">
                    {fmtBRL(simpResult.receitaLiquidaEstimada)}
                  </p>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
                    Diferença &quot;Por fora&quot; vs DAS:{' '}
                    <span className="privacy-val">
                      {simpResult.diferencaPorForaVsDas >= 0 ? '+' : ''}
                      {fmtBRL(simpResult.diferencaPorForaVsDas)}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lança o tributo mensal ({simpResult.modoRecolhimentoRtc === 'por_fora' ? 'DAS + CBS/IBS por fora' : 'DAS'}) na categoria <strong>Impostos</strong>.
              </p>
              <button
                type="button"
                disabled={simpResult.totalTributosMes <= 0}
                onClick={() =>
                  onLaunchTaxExpense({
                    descricao: `DAS Simples Nacional (Anexo ${simpResult.anexoEfetivo} — ${formatMonthYear(competenciaAtual)})`,
                    valor: simpResult.totalTributosMes,
                    categoria: 'Impostos',
                  })
                }
                className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                Lançar DAS como despesa
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SUB-ABA 3: XML NFS-e & GERADOR DANFSe */}
      <section
        role="tabpanel"
        id="rtc-panel-danfse"
        aria-labelledby="rtc-subtab-danfse"
        hidden={activeSubTab !== 'danfse'}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Upload + Área de Colar XML */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Importar XML de NFS-e (100% Offline)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Compatível com Padrão Nacional (DPS/NFSe) e ABRASF 2.04. O arquivo é processado localmente no navegador sem envio externo.
              </p>
            </div>

            <div>
              <label
                htmlFor="nfse-xml-file"
                className="flex flex-col items-center justify-center gap-2 min-h-[112px] p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:border-emerald-500 dark:hover:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 transition-colors cursor-pointer text-center"
              >
                <Upload className="w-6 h-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {xmlFileName ? `Arquivo carregado: ${xmlFileName}` : 'Clique ou pressione Enter para selecionar um arquivo .xml'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Limite de 2 MB • Proteção contra XXE e scripts embutidos
                </span>
                <input
                  id="nfse-xml-file"
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={handleXmlFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            {xmlUploadError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{xmlUploadError}</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="nfse-xml-paste"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Ou cole o conteúdo XML da NFS-e
                </label>
                {xmlText && (
                  <button
                    type="button"
                    onClick={() => {
                      setXmlText('');
                      setXmlFileName(null);
                      setXmlUploadError(null);
                      setPdfFeedback(null);
                    }}
                    className="min-h-[44px] px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Limpar XML
                  </button>
                )}
              </div>
              <textarea
                id="nfse-xml-paste"
                rows={7}
                value={xmlText}
                onChange={(e) => {
                  setXmlText(e.target.value);
                  setXmlFileName(null);
                  setXmlUploadError(null);
                  setPdfFeedback(null);
                }}
                placeholder="<NFSe>...</NFSe> ou <CompNfse>...</CompNfse>"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 privacy-val"
              />
            </div>
          </div>

          {/* Cartão Visual DANFSe */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-5">
            {!parsedNfse ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mb-3">
                  <FileCode2 className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Nenhum XML de NFS-e carregado
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                  Importe ou cole o XML da nota fiscal de serviço para visualizar o cartão DANFSe seguro, imprimir/salvar em PDF offline ou lançar os tributos em Despesas.
                </p>
              </div>
            ) : !parsedNfse.ok ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">Não foi possível interpretar o XML</p>
                  <p className="mt-0.5">{parsedNfse.error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Cabeçalho DANFSe */}
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        DANFSe — Documento Auxiliar da NFS-e ({parsedNfse.data.formato.toUpperCase()})
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        Nota nº {parsedNfse.data.numero || 'Não informado'}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Data de Emissão
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                        {formatNfseDate(parsedNfse.data.dataEmissao)}
                      </span>
                    </div>
                  </div>

                  {/* Prestador e Tomador */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Prestador de Serviços
                      </span>
                      <p className="font-semibold text-slate-900 dark:text-white mt-0.5 break-words privacy-val">
                        {parsedNfse.data.prestadorNome || 'Não informado'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5 privacy-val">
                        {formatDocumentId(parsedNfse.data.prestadorCnpj)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Tomador de Serviços
                      </span>
                      <p className="font-semibold text-slate-900 dark:text-white mt-0.5 break-words privacy-val">
                        {parsedNfse.data.tomadorNome || 'Não informado'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5 privacy-val">
                        {formatDocumentId(parsedNfse.data.tomadorDocumento)}
                      </p>
                    </div>
                  </div>

                  {/* Discriminação */}
                  <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Discriminação dos Serviços
                      </span>
                      {parsedNfse.data.codigoServico && (
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Cód. Serviço: {parsedNfse.data.codigoServico}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                      {parsedNfse.data.discriminacao || 'Sem discriminação informada no XML.'}
                    </p>
                  </div>

                  {/* Valores Fiscais */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                        Valor Serviços
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-0.5 block">
                        {fmtBRL(parsedNfse.data.valorServicos)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                        ISS {parsedNfse.data.issRetido ? '(Retido)' : ''}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-0.5 block">
                        {fmtBRL(parsedNfse.data.valorIss)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                        CBS
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-0.5 block">
                        {fmtBRL(parsedNfse.data.valorCbs)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                        IBS
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums privacy-val mt-0.5 block">
                        {fmtBRL(parsedNfse.data.valorIbs)}
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2.5">
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">
                        Valor Líquido
                      </span>
                      <span className="font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums privacy-val mt-0.5 block">
                        {fmtBRL(parsedNfse.data.valorLiquido)}
                      </span>
                    </div>
                  </div>
                </div>

                {pdfFeedback && (
                  <div
                    role={pdfFeedback.type === 'error' ? 'alert' : 'status'}
                    className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                      pdfFeedback.type === 'ok'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {pdfFeedback.type === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{pdfFeedback.message}</span>
                  </div>
                )}

                {/* Ações do DANFSe */}
                <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Imprimir / Salvar PDF (Offline)
                  </button>

                  <button
                    type="button"
                    disabled={pdfBusy || !danfseUrlValid}
                    onClick={handleGenerateOfficialDanfsePdf}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {pdfBusy ? 'Gerando PDF...' : 'Gerar PDF Oficial via Receita Local'}
                  </button>

                  <button
                    type="button"
                    disabled={totalTributosNota <= 0}
                    onClick={() =>
                      onLaunchTaxExpense({
                        descricao: `Tributos NFS-e #${parsedNfse.data.numero || 'S/N'}`,
                        valor: totalTributosNota,
                        categoria: 'Impostos',
                      })
                    }
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Lançar tributo da nota como despesa
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* PAINEL COLAPSÁVEL: CONECTOR LOCAL RECEITA FEDERAL (OPCIONAL — MIT) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          aria-expanded={connectorOpen}
          aria-controls="local-rtc-connector-panel"
          onClick={() => setConnectorOpen((prev) => !prev)}
          className="w-full min-h-[52px] px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Server className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Conector Local Receita Federal (Opcional — MIT)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                100% offline por padrão. Conecte apenas se estiver rodando os serviços oficiais MIT em localhost.
              </p>
            </div>
          </div>
          {connectorOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          )}
        </button>

        {connectorOpen && (
          <div
            id="local-rtc-connector-panel"
            className="border-t border-slate-200 dark:border-slate-800 p-5 space-y-4 bg-slate-50/40 dark:bg-slate-950/30"
          >
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              O FinTrack opera de forma autônoma e 100% offline. Opcionalmente, você pode apontar para os 3 repositórios oficiais de código aberto (licença MIT) da Receita Federal rodando localmente nas portas <code className="font-mono">8080</code> (Regime Regular), <code className="font-mono">8081</code> (Simples Nacional) e <code className="font-mono">8082</code> (Gerador DANFSe). Por segurança contra SSRF, apenas URLs <code className="font-mono">http://localhost</code> ou <code className="font-mono">http://127.0.0.1</code> são aceitas — nenhum dado é enviado à internet.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="rtc-url-regular"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    API Regime Regular
                  </label>
                  {renderHealthBadge(healthStatus.regimeRegular, endpoints.regimeRegular)}
                </div>
                <input
                  id="rtc-url-regular"
                  type="url"
                  value={endpoints.regimeRegular}
                  onChange={(e) =>
                    setEndpoints((prev) => ({ ...prev, regimeRegular: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="rtc-url-simples"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    API Simples Nacional
                  </label>
                  {renderHealthBadge(healthStatus.simplesNacional, endpoints.simplesNacional)}
                </div>
                <input
                  id="rtc-url-simples"
                  type="url"
                  value={endpoints.simplesNacional}
                  onChange={(e) =>
                    setEndpoints((prev) => ({ ...prev, simplesNacional: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="rtc-url-danfse"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Serviço Gerador DANFSe
                  </label>
                  {renderHealthBadge(healthStatus.geradorDanfse, endpoints.geradorDanfse)}
                </div>
                <input
                  id="rtc-url-danfse"
                  type="url"
                  value={endpoints.geradorDanfse}
                  onChange={(e) =>
                    setEndpoints((prev) => ({ ...prev, geradorDanfse: e.target.value }))
                  }
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div
              role="status"
              aria-live="polite"
              className="flex flex-wrap items-center justify-between gap-3 pt-2"
            >
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {healthBusy
                  ? 'Verificando disponibilidade dos serviços locais...'
                  : 'Clique para verificar se os serviços locais estão respondendo.'}
              </span>
              <button
                type="button"
                disabled={healthBusy}
                onClick={handleTestLocalHealth}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 shrink-0 ${healthBusy ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {healthBusy ? 'Testando...' : 'Testar Status Local'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default TaxRtcTab;
