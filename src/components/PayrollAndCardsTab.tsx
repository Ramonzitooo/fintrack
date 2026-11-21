import React, { useState } from 'react';
import { AppState, fmtBRL } from '../utils/storage';
import {
  CreditCard,
  annualToMonthlyRate,
  calculateCreditCardGraceDays,
  calculateOfficialPayrollTaxes,
  simulateCashVsInstallments,
} from '../utils/financeMath';
import {
  Plus,
  Trash2,
  Calculator,
  Save,
  Wallet,
  Pencil,
} from 'lucide-react';

interface PayrollTabProps {
  state: AppState;
  onAddProvento: (nome: string, valor: number) => void;
  onUpdateProvento: (id: string, field: 'nome' | 'valor', val: string | number) => void;
  onRemoveProvento: (id: string) => void;
  onAddDesconto: (nome: string, valor: number) => void;
  onUpdateDesconto: (id: string, field: 'nome' | 'valor', val: string | number) => void;
  onRemoveDesconto: (id: string) => void;
  onApplyOfficialTaxes: (inss: number, irrf: number) => void;
  onOpenReceiveSalaryModal: () => void;
  onSavePayrollToHistory: () => void;
  onLoadHistoryPayroll: (id: string) => void;
  onDeleteHistoryPayroll: (id: string) => void;
}

export const PayrollTab: React.FC<PayrollTabProps> = ({
  state,
  onAddProvento,
  onUpdateProvento,
  onRemoveProvento,
  onAddDesconto,
  onUpdateDesconto,
  onRemoveDesconto,
  onApplyOfficialTaxes,
  onOpenReceiveSalaryModal,
  onSavePayrollToHistory,
  onLoadHistoryPayroll,
  onDeleteHistoryPayroll,
}) => {
  const [antiImpulsoPreco, setAntiImpulsoPreco] = useState<number>(350);
  const [antiImpulsoJornada, setAntiImpulsoJornada] = useState<number>(220);
  const [dependents, setDependents] = useState<number>(0);
  const [historyFilter, setHistoryFilter] = useState<'6' | '12' | 'todos'>('6');

  const bruto = state.salario.bruto || 0;
  const descontosTotal = state.salario.descontosTotal || 0;
  const liquido = state.salario.liquido || 0;

  // Cálculo Oficial INSS + IRRF Progressivo
  const officialTaxes = calculateOfficialPayrollTaxes(bruto, dependents);

  // Calculadora Anti-Impulso
  const horasPorDiaMap: Record<number, number> = { 150: 6, 180: 6, 200: 8, 220: 8 };
  const horasPorDia = horasPorDiaMap[antiImpulsoJornada] || 8;
  const valorHora = liquido > 0 ? liquido / antiImpulsoJornada : 0;
  const totalHorasItem = valorHora > 0 ? antiImpulsoPreco / valorHora : 0;
  const totalMinutes = Math.round(totalHorasItem * 60);
  const totalHoursRounded = Math.floor(totalMinutes / 60);
  const minRest = totalMinutes % 60;
  const diasTrab = Math.floor(totalHoursRounded / horasPorDia);
  const horasRest = totalHoursRounded % horasPorDia;

  // Histórico ordenado cronologicamente por competência descendente e filtrado
  const sortedHistory = [...state.historicoContracheques].sort((a, b) =>
    (b.competencia || '').localeCompare(a.competencia || '')
  );
  const histList =
    historyFilter === '6'
      ? sortedHistory.slice(0, 6)
      : historyFilter === '12'
      ? sortedHistory.slice(0, 12)
      : sortedHistory;

  const totalLiquidoPeriodo = histList.reduce((s, h) => s + (h.liquido || 0), 0);
  const totalDescontosPeriodo = histList.reduce((s, h) => s + (h.descontosTotal || 0), 0);
  let totalAcrescimosPeriodo = 0;
  histList.forEach((h) => {
    (h.proventos || []).forEach((p) => {
      if (!p.nome.toLowerCase().includes('salário base') && !p.nome.toLowerCase().includes('salario base')) {
        totalAcrescimosPeriodo += p.valor || 0;
      }
    });
  });

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Contracheque & Folha de Pagamento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adicione seus proventos e descontos ou calcule o INSS e IRRF progressivo oficial automaticamente com 1 clique.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onSavePayrollToHistory}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Mês no Histórico</span>
            </button>
            <button
              onClick={onOpenReceiveSalaryModal}
              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Distribuir Salário na Conta</span>
            </button>
          </div>
        </div>

        {/* ASSISTENTE AUTOMÁTICO DE INSS & IRRF OFICIAL (NOVIDADE PARA LEIGOS) */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Calculadora Automática de INSS e IRRF Oficial (Tabela Progressiva CLT)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 privacy-val">
              Para o seu Bruto de <strong className="font-mono">{fmtBRL(bruto)}</strong>: INSS oficial estimado em{' '}
              <strong className="font-mono text-rose-600 dark:text-rose-400">{fmtBRL(officialTaxes.inss)}</strong> · IRRF
              em <strong className="font-mono text-rose-600 dark:text-rose-400">{fmtBRL(officialTaxes.irrf)}</strong>{' '}
              (Alíquota efetiva total: {officialTaxes.effectiveTaxRatePct}%).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <label htmlFor="payroll-dependents" className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span>Dependentes:</span>
              <input
                id="payroll-dependents"
                type="number"
                min={0}
                max={10}
                value={dependents}
                onChange={(e) => setDependents(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 font-mono tabular-nums text-center text-xs"
              />
            </label>
            <button
              onClick={() => onApplyOfficialTaxes(officialTaxes.inss, officialTaxes.irrf)}
              className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap shrink-0"
            >
              Aplicar INSS e IRRF Oficiais
            </button>
          </div>
        </div>

        {/* Duas Colunas: Proventos vs Descontos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Ganhos */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                Ganhos & Proventos (+)
              </h3>
              <button
                onClick={() => onAddProvento('Hora Extra / Bônus', 0)}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                + Adicionar Ganho
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['Salário Base', 'Hora Extra 50%', 'Bônus / PLR', 'Comissão', 'Adicional Noturno'].map((sug) => (
                <button
                  key={sug}
                  onClick={() => onAddProvento(sug, 0)}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  + {sug}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {state.salario.proventos.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.nome}
                    onChange={(e) => onUpdateProvento(p.id, 'nome', e.target.value)}
                    aria-label="Descrição do ganho"
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={p.valor}
                    onChange={(e) => onUpdateProvento(p.id, 'valor', parseFloat(e.target.value) || 0)}
                    aria-label={`Valor de ${p.nome}`}
                    className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-right text-slate-900 dark:text-white privacy-val"
                  />
                  <button
                    onClick={() => onRemoveProvento(p.id)}
                    aria-label={`Remover ganho ${p.nome}`}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Total de Ganhos Brutos:</span>
              <strong className="font-mono text-base text-emerald-700 dark:text-emerald-400 privacy-val">
                {fmtBRL(bruto)}
              </strong>
            </div>
          </div>

          {/* Coluna Descontos */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                Descontos em Folha (-)
              </h3>
              <button
                onClick={() => onAddDesconto('Novo Desconto', 0)}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
              >
                + Adicionar Desconto
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {['INSS', 'IRRF', 'Plano de Saúde', 'Vale Transporte', 'Consignado', 'Previdência'].map((sug) => (
                <button
                  key={sug}
                  onClick={() => onAddDesconto(sug, 0)}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
                >
                  + {sug}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {state.salario.descontos.map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={d.nome}
                    onChange={(e) => onUpdateDesconto(d.id, 'nome', e.target.value)}
                    aria-label="Descrição do desconto"
                    className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={d.valor}
                    onChange={(e) => onUpdateDesconto(d.id, 'valor', parseFloat(e.target.value) || 0)}
                    aria-label={`Valor de ${d.nome}`}
                    className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-right text-slate-900 dark:text-white privacy-val"
                  />
                  <button
                    onClick={() => onRemoveDesconto(d.id)}
                    aria-label={`Remover desconto ${d.nome}`}
                    className="min-h-[44px] min-w-[44px] p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Total de Descontos:</span>
              <strong className="font-mono text-base text-rose-600 dark:text-rose-400 privacy-val">
                {fmtBRL(descontosTotal)}
              </strong>
            </div>
          </div>
        </div>

        {/* Banner Salário Líquido Apurado */}
        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Salário Líquido Real Disponível
            </span>
            <div className="font-mono text-2xl font-extrabold text-emerald-900 dark:text-white mt-0.5 privacy-val">
              {fmtBRL(liquido)}
            </div>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 privacy-val">
              50% Essenciais ({fmtBRL(liquido * 0.5)}) · 30% Estilo de Vida ({fmtBRL(liquido * 0.3)}) · 20% Futuro (
              {fmtBRL(liquido * 0.2)})
            </span>
          </div>
          <button
            onClick={onOpenReceiveSalaryModal}
            className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer shrink-0"
          >
            Creditar Salário & Alimentar Caixinhas
          </button>
        </div>
      </div>

      {/* CALCULADORA ANTI-IMPULSO (HORAS DE VIDA) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Calculadora Anti-Impulso: Quantas Horas de Vida Custa?
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Converte qualquer compra desejada em horas reais de trabalho líquido para evitar compras por impulso.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="anti-impulso-preco" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Preço do Produto / Desejo (R$)
            </label>
            <input
              id="anti-impulso-preco"
              type="number"
              step="10"
              value={antiImpulsoPreco}
              onChange={(e) => setAntiImpulsoPreco(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="anti-impulso-jornada" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Jornada Mensal de Trabalho
            </label>
            <select
              id="anti-impulso-jornada"
              value={antiImpulsoJornada}
              onChange={(e) => setAntiImpulsoJornada(parseInt(e.target.value, 10) || 220)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
            >
              <option value={220}>220 horas (44h semanais CLT com DSR)</option>
              <option value={200}>200 horas (40h semanais seg-sex)</option>
              <option value={180}>180 horas (Escala 12x36)</option>
              <option value={150}>150 horas (30h semanais - 6h/dia)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400">Esforço Real de Trabalho Exigido:</span>
            <div className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {liquido <= 0
                ? 'Cadastre seu salário líquido acima para calcular'
                : diasTrab > 0
                ? `${diasTrab}d de ${horasPorDia}h + ${horasRest}h ${minRest}min`
                : `${horasRest}h e ${minRest}min de trabalho`}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sua hora líquida vale <strong className="font-mono tabular-nums privacy-val">{fmtBRL(valorHora)}/h</strong>
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 max-w-xs">
            {liquido <= 0
              ? 'Informe seus proventos e descontos para descobrir quanto tempo de vida cada compra custa.'
              : <>Vale a pena trocar <strong>{totalHorasItem.toFixed(1)} horas</strong> da sua vida profissional por essa compra hoje?</>}
          </div>
        </div>
      </div>

      {/* LEVANTAMENTO ANUAL / HISTÓRICO DE CONTRACHEQUES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Levantamento Acumulado de Folhas Salvas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Soma de horas extras, PLR e impostos retidos nos meses registrados.
            </p>
          </div>
          <select
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value as '6' | '12' | 'todos')}
            aria-label="Filtrar período do histórico de contracheques"
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="6">Últimos 6 Meses</option>
            <option value="12">Últimos 12 Meses</option>
            <option value="todos">Todo o Histórico</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Extras & Bônus Acumulados</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(totalAcrescimosPeriodo)}
            </div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Descontado no Período</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-rose-600 dark:text-rose-400 privacy-val">
              {fmtBRL(totalDescontosPeriodo)}
            </div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Líquido Acumulado ({histList.length} meses)</span>
            <div className="mt-1 font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(totalLiquidoPeriodo)}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
          {histList.map((folha) => (
            <div key={folha.id} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{folha.mesLabel}</span>
                <span className="text-slate-600 dark:text-slate-400 mx-2">·</span>
                <span className="text-slate-500 dark:text-slate-400 privacy-val">
                  Bruto: <span className="font-mono tabular-nums">{fmtBRL(folha.bruto)}</span> · Descontos:{' '}
                  <span className="font-mono tabular-nums">{fmtBRL(folha.descontosTotal)}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
                  {fmtBRL(folha.liquido)}
                </span>
                <button
                  onClick={() => onLoadHistoryPayroll(folha.id)}
                  className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold cursor-pointer inline-flex items-center justify-center text-xs"
                >
                  Carregar
                </button>
                <button
                  onClick={() => onDeleteHistoryPayroll(folha.id)}
                  aria-label={`Remover histórico ${folha.mesLabel}`}
                  className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer inline-flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface CardsTabProps {
  state: AppState;
  onOpenNewCard: () => void;
  onRequestEditCardInvoice: (cardId: string, cardNome: string, currentInvoice: number) => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard?: (card: CreditCard) => void;
}

export const CardsTab: React.FC<CardsTabProps> = ({
  state,
  onOpenNewCard,
  onRequestEditCardInvoice,
  onDeleteCard,
  onUpdateCard,
}) => {
  const cdiAnual = state.configuracoes.taxaCdiAnual ?? 10.75;
  const defaultMonthlyNetRate = Math.round(annualToMonthlyRate(cdiAnual) * 0.825 * 10000) / 100;

  const [simValor, setSimValor] = useState<number>(1200);
  const [simDesconto, setSimDesconto] = useState<number>(5);
  const [simParcelas, setSimParcelas] = useState<number>(10);
  const [simTaxaCdi, setSimTaxaCdi] = useState<number>(defaultMonthlyNetRate);

  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState('');
  const [editCardLimit, setEditCardLimit] = useState('');
  const [editCardCutoff, setEditCardCutoff] = useState('');
  const [editCardDue, setEditCardDue] = useState('');
  const [editCardBenefit, setEditCardBenefit] = useState<CreditCard['beneficio']>('Cashback');
  const [editCardError, setEditCardError] = useState<string | null>(null);

  const startEditCard = (card: CreditCard) => {
    setEditingCardId(card.id);
    setEditCardName(card.nome);
    setEditCardLimit(String(card.limiteTotal ?? 5000));
    setEditCardCutoff(String(card.diaCorte));
    setEditCardDue(String(card.diaVencimento));
    setEditCardBenefit(card.beneficio);
    setEditCardError(null);
  };

  const handleSaveCard = (card: CreditCard) => {
    const nome = editCardName.trim();
    const limiteTotal = parseFloat(editCardLimit);
    const diaCorte = parseInt(editCardCutoff, 10);
    const diaVencimento = parseInt(editCardDue, 10);

    if (!nome) {
      setEditCardError('Informe o nome do cartão.');
      return;
    }
    if (!Number.isFinite(limiteTotal) || limiteTotal <= 0) {
      setEditCardError('Informe um limite total maior que zero.');
      return;
    }
    if (!Number.isFinite(diaCorte) || diaCorte < 1 || diaCorte > 31) {
      setEditCardError('Informe um dia de corte entre 1 e 31.');
      return;
    }
    if (!Number.isFinite(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) {
      setEditCardError('Informe um dia de vencimento entre 1 e 31.');
      return;
    }

    onUpdateCard?.({
      ...card,
      nome,
      limiteTotal,
      diaCorte,
      diaVencimento,
      beneficio: editCardBenefit,
    });
    setEditingCardId(null);
    setEditCardError(null);
  };

  const simResult = simulateCashVsInstallments(simValor, simDesconto, simParcelas, simTaxaCdi);

  return (
    <div className="space-y-6">
      {/* GESTÃO DE CARTÕES COM LIMITE, FATURA ATUAL E PRAZO EXATO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Cartões de Crédito, Faturas & Janela de Prazo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Controle a fatura aberta, o uso do limite e veja quantos dias exatos você ganha comprando hoje.
            </p>
          </div>
          <button
            onClick={onOpenNewCard}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Cartão</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.cartoes.map((card) => {
            const grace = calculateCreditCardGraceDays(card.diaCorte, card.diaVencimento);
            const limite = card.limiteTotal || 5000;
            const fatura = card.faturaAtual || 0;
            const usoPct = limite > 0 ? Math.min(100, Math.round((fatura / limite) * 100)) : 0;

            return (
              <div
                key={card.id}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{card.nome}</h3>
                      <span className="text-slate-600 dark:text-slate-400" aria-hidden="true">·</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{card.beneficio}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Fecha dia <strong>{card.diaCorte}</strong> · Vence dia <strong>{card.diaVencimento}</strong> ·{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {grace.daysToPay} dias de prazo comprando hoje ({grace.statusLabel})
                      </strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        editingCardId === card.id ? setEditingCardId(null) : startEditCard(card)
                      }
                      aria-label={`Editar cartão ${card.nome}`}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => onDeleteCard(card.id)}
                      aria-label={`Remover cartão ${card.nome}`}
                      className="min-h-[44px] min-w-[44px] p-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer inline-flex items-center justify-center rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {editingCardId === card.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveCard(card);
                    }}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor={`edit-card-name-${card.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Nome do Cartão
                        </label>
                        <input
                          id={`edit-card-name-${card.id}`}
                          type="text"
                          value={editCardName}
                          onChange={(e) => {
                            setEditCardName(e.target.value);
                            if (editCardError) setEditCardError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-card-limit-${card.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Limite Total (R$)
                        </label>
                        <input
                          id={`edit-card-limit-${card.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={editCardLimit}
                          onChange={(e) => {
                            setEditCardLimit(e.target.value);
                            if (editCardError) setEditCardError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-card-benefit-${card.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Benefício
                        </label>
                        <select
                          id={`edit-card-benefit-${card.id}`}
                          value={editCardBenefit}
                          onChange={(e) => setEditCardBenefit(e.target.value as CreditCard['beneficio'])}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                        >
                          <option value="Cashback">Cashback</option>
                          <option value="Milhas">Milhas</option>
                          <option value="SemAnuidade">SemAnuidade</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-card-cutoff-${card.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Dia de Corte
                        </label>
                        <input
                          id={`edit-card-cutoff-${card.id}`}
                          type="number"
                          min="1"
                          max="31"
                          value={editCardCutoff}
                          onChange={(e) => {
                            setEditCardCutoff(e.target.value);
                            if (editCardError) setEditCardError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`edit-card-due-${card.id}`}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1"
                        >
                          Dia de Vencimento
                        </label>
                        <input
                          id={`edit-card-due-${card.id}`}
                          type="number"
                          min="1"
                          max="31"
                          value={editCardDue}
                          onChange={(e) => {
                            setEditCardDue(e.target.value);
                            if (editCardError) setEditCardError(null);
                          }}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {editCardError && (
                      <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        {editCardError}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCardId(null)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs privacy-val">
                    <span className="text-slate-500 dark:text-slate-400">
                      Fatura Aberta: <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{fmtBRL(fatura)}</strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {usoPct}% do limite ({fmtBRL(limite)})
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-label={`Uso do limite de ${card.nome}`}
                    aria-valuenow={usoPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full ${
                        usoPct > 70 ? 'bg-rose-500' : usoPct > 40 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${usoPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 privacy-val">
                    Limite disponível: <strong className="font-mono tabular-nums">{fmtBRL(Math.max(0, limite - fatura))}</strong>
                  </span>
                  <button
                    onClick={() => {
                      if (onRequestEditCardInvoice) {
                        onRequestEditCardInvoice(card.id, card.nome, fatura);
                      }
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center"
                  >
                    Atualizar Fatura
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SIMULADOR DE DECISÃO DE COMPRA: À VISTA COM DESCONTO VS. PARCELADO + CDI */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Simulador Matemático: Pagar à Vista com Desconto vs. Parcelar sem Juros + CDI
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Calcula o rendimento real do dinheiro aplicado no CDI enquanto paga as parcelas mês a mês, revelando também o{' '}
            <strong>Desconto Mínimo de Equilíbrio (Break-Even)</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="sim-valor" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Valor da Compra (R$)
            </label>
            <input
              id="sim-valor"
              type="number"
              step="50"
              value={simValor}
              onChange={(e) => setSimValor(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="sim-desconto" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Desconto à Vista no Pix (%)
            </label>
            <input
              id="sim-desconto"
              type="number"
              step="0.5"
              value={simDesconto}
              onChange={(e) => setSimDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="sim-parcelas" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Parcelas sem Juros
            </label>
            <select
              id="sim-parcelas"
              value={simParcelas}
              onChange={(e) => setSimParcelas(parseInt(e.target.value, 10) || 10)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
            >
              {[2, 3, 4, 5, 6, 8, 10, 12, 18].map((n) => (
                <option key={n} value={n}>
                  {n}x sem juros
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="sim-taxa-cdi" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Rendimento Líquido CDI (% a.m.)
            </label>
            <input
              id="sim-taxa-cdi"
              type="number"
              step="0.05"
              value={simTaxaCdi}
              onChange={(e) => setSimTaxaCdi(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Veredito Matemático Auditado
              </span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {simResult.verdict === 'PARCELAR' ? (
                  <>
                    Compensa PARCELAR em {simParcelas}x de{' '}
                    <span className="font-mono tabular-nums privacy-val">{fmtBRL(simResult.installmentValue)}</span> e
                    investir no CDI!
                  </>
                ) : simResult.verdict === 'A_VISTA' ? (
                  <>
                    Compensa PAGAR À VISTA por{' '}
                    <span className="font-mono tabular-nums privacy-val">{fmtBRL(simResult.cashPrice)}</span>!
                  </>
                ) : (
                  'Empate técnico entre pagar à vista ou parcelar.'
                )}
              </h4>
            </div>
            <div className="font-mono tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              Vantagem real: + {fmtBRL(Math.max(0, Math.abs(simResult.netAdvantageForInstallments)))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <div>
              Preço à Vista ({simDesconto}%):{' '}
              <strong className="font-mono tabular-nums privacy-val">{fmtBRL(simResult.cashPrice)}</strong>
            </div>
            <div>
              Desconto imediato:{' '}
              <strong className="font-mono tabular-nums privacy-val">{fmtBRL(simResult.immediateDiscountValue)}</strong>
            </div>
            <div>
              Juros ganhos no CDI:{' '}
              <strong className="font-mono tabular-nums privacy-val">
                +{fmtBRL(Math.max(0, simResult.totalInterestEarned))}
              </strong>
            </div>
            <div>
              Desconto de equilíbrio: <strong className="font-mono tabular-nums">{simResult.breakEvenDiscountPct}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
