import React, { useState } from 'react';
import { AppState, fmtBRL } from '../utils/storage';
import {
  annualToMonthlyRate,
  calculateBudget503020,
  calculateCreditCardGraceDays,
  calculateOfficialPayrollTaxes,
  simulateCashVsInstallments,
} from '../utils/financeMath';
import {
  Plus,
  Trash2,
  Calculator,
  Clock,
  Save,
  Wallet,
  CreditCard as CardIcon,
  CheckCircle2,
  RotateCcw,
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
  const valorHora = liquido > 0 ? liquido / antiImpulsoJornada : 0;
  const totalHorasItem = valorHora > 0 ? antiImpulsoPreco / valorHora : 0;
  const diasTrab = Math.floor(totalHorasItem / 8);
  const horasRest = Math.floor(totalHorasItem % 8);
  const minRest = Math.round((totalHorasItem % 1) * 60);

  // Histórico filtrado
  const histList =
    historyFilter === '6'
      ? state.historicoContracheques.slice(0, 6)
      : historyFilter === '12'
      ? state.historicoContracheques.slice(0, 12)
      : state.historicoContracheques;

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
            <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <span>Dependentes:</span>
              <input
                type="number"
                min={0}
                max={10}
                value={dependents}
                onChange={(e) => setDependents(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 font-mono text-center text-xs"
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
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Preço do Produto / Desejo (R$)
            </label>
            <input
              type="number"
              step="10"
              value={antiImpulsoPreco}
              onChange={(e) => setAntiImpulsoPreco(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Jornada Mensal de Trabalho
            </label>
            <select
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
            <div className="font-mono text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {diasTrab > 0
                ? `${diasTrab}d de 8h + ${horasRest}h ${minRest}min`
                : `${horasRest}h e ${minRest}min de trabalho`}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Sua hora líquida vale <strong className="font-mono privacy-val">{fmtBRL(valorHora)}/h</strong>
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 max-w-xs">
            Vale a pena trocar <strong>{totalHorasItem.toFixed(1)} horas</strong> da sua vida profissional por essa
            compra hoje?
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
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="6">Últimos 6 Meses</option>
            <option value="12">Últimos 12 Meses</option>
            <option value="todos">Todo o Histórico</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500">Extras & Bônus Acumulados</span>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
              {fmtBRL(totalAcrescimosPeriodo)}
            </div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500">Total Descontado no Período</span>
            <div className="mt-1 font-mono text-lg font-bold text-rose-600 dark:text-rose-400 privacy-val">
              {fmtBRL(totalDescontosPeriodo)}
            </div>
          </div>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-500">Líquido Acumulado ({histList.length} meses)</span>
            <div className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white privacy-val">
              {fmtBRL(totalLiquidoPeriodo)}
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
          {histList.map((folha) => (
            <div key={folha.id} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">{folha.mesLabel}</span>
                <span className="text-slate-400 mx-2">·</span>
                <span className="text-slate-500 privacy-val">
                  Bruto: <span className="font-mono">{fmtBRL(folha.bruto)}</span> · Descontos:{' '}
                  <span className="font-mono">{fmtBRL(folha.descontosTotal)}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 privacy-val">
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
                  className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center justify-center"
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
}

export const CardsTab: React.FC<CardsTabProps> = ({
  state,
  onOpenNewCard,
  onRequestEditCardInvoice,
  onDeleteCard,
}) => {
  const cdiAnual = state.configuracoes.taxaCdiAnual || 10.75;
  const defaultMonthlyNetRate = Math.round(annualToMonthlyRate(cdiAnual) * 0.825 * 10000) / 100;

  const [simValor, setSimValor] = useState<number>(1200);
  const [simDesconto, setSimDesconto] = useState<number>(5);
  const [simParcelas, setSimParcelas] = useState<number>(10);
  const [simTaxaCdi, setSimTaxaCdi] = useState<number>(defaultMonthlyNetRate);

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
                      <span className="text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{card.beneficio}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Fecha dia <strong>{card.diaCorte}</strong> · Vence dia <strong>{card.diaVencimento}</strong> ·{' '}
                      <strong className="text-emerald-700 dark:text-emerald-400">
                        {grace.daysToPay} dias de prazo comprando hoje ({grace.statusLabel})
                      </strong>
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteCard(card.id)}
                    aria-label={`Remover cartão ${card.nome}`}
                    className="min-h-[44px] min-w-[44px] p-2 text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center justify-center rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs privacy-val">
                    <span className="text-slate-500">
                      Fatura Aberta: <strong className="font-mono text-slate-900 dark:text-white">{fmtBRL(fatura)}</strong>
                    </span>
                    <span className="text-slate-500 font-mono">
                      {usoPct}% do limite ({fmtBRL(limite)})
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        usoPct > 70 ? 'bg-rose-500' : usoPct > 40 ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${usoPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 privacy-val">
                    Limite disponível: <strong className="font-mono">{fmtBRL(Math.max(0, limite - fatura))}</strong>
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
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Valor da Compra (R$)
            </label>
            <input
              type="number"
              step="50"
              value={simValor}
              onChange={(e) => setSimValor(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Desconto à Vista no Pix (%)
            </label>
            <input
              type="number"
              step="0.5"
              value={simDesconto}
              onChange={(e) => setSimDesconto(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Parcelas sem Juros
            </label>
            <select
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
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
              Rendimento Líquido CDI (% a.m.)
            </label>
            <input
              type="number"
              step="0.05"
              value={simTaxaCdi}
              onChange={(e) => setSimTaxaCdi(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
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
                {simResult.verdict === 'PARCELAR'
                  ? `Compensa PARCELAR em ${simParcelas}x de ${fmtBRL(simResult.installmentValue)} e investir no CDI!`
                  : simResult.verdict === 'A_VISTA'
                  ? `Compensa PAGAR À VISTA por ${fmtBRL(simResult.cashPrice)}!`
                  : 'Empate técnico entre pagar à vista ou parcelar.'}
              </h4>
            </div>
            <div className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
              Vantagem real: + {fmtBRL(Math.abs(simResult.netAdvantageForInstallments))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            <div>
              Preço à Vista ({simDesconto}%): <strong className="font-mono">{fmtBRL(simResult.cashPrice)}</strong>
            </div>
            <div>
              Desconto imediato: <strong className="font-mono">{fmtBRL(simResult.immediateDiscountValue)}</strong>
            </div>
            <div>
              Juros ganhos no CDI: <strong className="font-mono">+{fmtBRL(simResult.totalInterestEarned)}</strong>
            </div>
            <div>
              Desconto de equilíbrio: <strong className="font-mono">{simResult.breakEvenDiscountPct}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
