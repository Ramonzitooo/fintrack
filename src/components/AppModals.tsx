import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppState, fmtBRL, formatMonthYear } from '../utils/storage';
import {
  ExpenseItem,
  parseQuickExpenseCommand,
  rubberbandOffset,
  shouldDismissSheetOnRelease,
} from '../utils/financeMath';
import { X, Search, Sparkles, Download, Upload, RotateCcw, Trash2, CheckCircle2 } from 'lucide-react';

export type ActiveModalType =
  | null
  | 'newBank'
  | 'pixTransfer'
  | 'newGoal'
  | 'fireConfig'
  | 'aporteGoal'
  | 'withdrawGoal'
  | 'newCard'
  | 'newExpense'
  | 'payExpense'
  | 'templateModal'
  | 'receiveSalary'
  | 'paydayConfig'
  | 'backup'
  | 'cmdk'
  | 'quickEditValue';

export interface QuickEditConfig {
  title: string;
  description: string;
  initialValue: number;
  allowNegative?: boolean;
  onConfirm: (val: number) => void;
}

interface AppModalsProps {
  activeModal: ActiveModalType;
  selectedId: string | null;
  state: AppState;
  quickEditConfig?: QuickEditConfig | null;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onSaveBank: (nome: string, tipo: any, saldo: number, rendeJuros: boolean, pctCDI: number) => void;
  onExecutePix: (origId: string, destId: string, valor: number) => void;
  onSaveGoal: (
    nome: string,
    tipo: 'emergencia' | 'viagem' | 'aposentadoria' | 'outros',
    saldo: number,
    aporteMensal: number,
    meta: number,
    instituicao: string
  ) => void;
  onSaveFireGoal: (nome: string, saldo: number, aporteMensal: number, instituicao: string) => void;
  onExecuteGoalTransfer: (caixinhaId: string, bankId: string, valor: number, mode: 'aporte' | 'withdraw') => void;
  onSaveCard: (
    nome: string,
    diaCorte: number,
    diaVencimento: number,
    beneficio: 'Cashback' | 'Milhas' | 'SemAnuidade',
    limiteTotal: number,
    faturaAtual: number
  ) => void;
  onSaveNewExpense: (
    descricao: string,
    valor: number,
    diaVencimento: number,
    categoria: ExpenseItem['categoria'],
    paga: boolean,
    bankId: string | null
  ) => void;
  onConfirmPayExpense: (expenseId: string, bankId: string | null) => void;
  onAddTemplateItem: (
    descricao: string,
    valorPadrao: number,
    diaVencimento: number,
    categoria: ExpenseItem['categoria']
  ) => void;
  onToggleTemplateItem: (id: string) => void;
  onDeleteTemplateItem: (id: string) => void;
  onConfirmReceiveSalary: (bankId: string, autoAportarCaixinhas: boolean) => void;
  onSavePaydayConfig: (tipo: 'quintoDiaUtil' | 'diaFixo' | 'dataExata', diaFixo: number, dataExata: string | null) => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImportJSON: (file: File) => void;
  onResetFactory: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  activeModal,
  selectedId,
  state,
  quickEditConfig,
  onClose,
  onNavigate,
  onSaveBank,
  onExecutePix,
  onSaveGoal,
  onSaveFireGoal,
  onExecuteGoalTransfer,
  onSaveCard,
  onSaveNewExpense,
  onConfirmPayExpense,
  onAddTemplateItem,
  onToggleTemplateItem,
  onDeleteTemplateItem,
  onConfirmReceiveSalary,
  onSavePaydayConfig,
  onExportJSON,
  onExportCSV,
  onImportJSON,
  onResetFactory,
}) => {
  // Bank form state
  const [bankNome, setBankNome] = useState('');
  const [bankTipo, setBankTipo] = useState<'Conta Digital' | 'Conta Corrente' | 'Investimento' | 'Dinheiro Físico'>('Conta Digital');
  const [bankSaldo, setBankSaldo] = useState('');
  const [bankRende, setBankRende] = useState(true);
  const [bankPctCdi, setBankPctCdi] = useState('100');

  // Pix state
  const [pixOrig, setPixOrig] = useState('');
  const [pixDest, setPixDest] = useState('');
  const [pixVal, setPixVal] = useState('');

  // Goal state
  const [goalNome, setGoalNome] = useState('');
  const [goalTipo, setGoalTipo] = useState<'emergencia' | 'viagem' | 'outros'>('emergencia');
  const [goalSaldo, setGoalSaldo] = useState('0');
  const [goalAporte, setGoalAporte] = useState('250');
  const [goalMeta, setGoalMeta] = useState('5000');
  const [goalInst, setGoalInst] = useState('Nubank (100% CDI)');

  // FIRE state
  const cxFire = state.caixinhas.find((c) => c.tipo === 'aposentadoria');
  const [fireNome, setFireNome] = useState('');
  const [fireSaldo, setFireSaldo] = useState('');
  const [fireAporte, setFireAporte] = useState('');
  const [fireInst, setFireInst] = useState('');

  // Aporte/Withdraw state
  const [transVal, setTransVal] = useState('');
  const [transBankId, setTransBankId] = useState('');

  // Card state
  const [cardNome, setCardNome] = useState('');
  const [cardCorte, setCardCorte] = useState('10');
  const [cardVenc, setCardVenc] = useState('17');
  const [cardBeneficio, setCardBeneficio] = useState<'Cashback' | 'Milhas' | 'SemAnuidade'>('Cashback');
  const [cardLimite, setCardLimite] = useState('5000');
  const [cardFatura, setCardFatura] = useState('0');

  // Expense state
  const [expDesc, setExpDesc] = useState('');
  const [expVal, setExpVal] = useState('');
  const [expDia, setExpDia] = useState('15');
  const [expCat, setExpCat] = useState<ExpenseItem['categoria']>('Alimentação');
  const [expPaga, setExpPaga] = useState(false);
  const [expBankId, setExpBankId] = useState('');

  // Pay Expense state
  const [payBankId, setPayBankId] = useState('');

  // Template new item
  const [tplDesc, setTplDesc] = useState('');
  const [tplVal, setTplVal] = useState('');
  const [tplDia, setTplDia] = useState('10');
  const [tplCat, setTplCat] = useState<ExpenseItem['categoria']>('Moradia');

  // Salary Sorter state
  const [salBankId, setSalBankId] = useState('');
  const [salAutoAporte, setSalAutoAporte] = useState(true);

  // Payday config state
  const [payType, setPayType] = useState<'quintoDiaUtil' | 'diaFixo' | 'dataExata'>('quintoDiaUtil');
  const [payFixedDay, setPayFixedDay] = useState('5');
  const [payExactDate, setPayExactDate] = useState('');

  // Command Palette state
  const [cmdkQuery, setCmdkQuery] = useState('');
  const [quickEditVal, setQuickEditVal] = useState('');
  const shouldReduceMotion = useReducedMotion();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Apple WWDC 2018 1:1 Sheet Drag & Velocity Handoff state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef({
    startY: 0,
    lastY: 0,
    lastTime: 0,
    velocityY: 0,
  });

  useEffect(() => {
    if (activeModal) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setDragOffsetY(0);
      setIsDragging(false);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus?.();
      previousFocusRef.current = null;
    }
  }, [activeModal]);

  useEffect(() => {
    if (!activeModal) return;
    const firstBankId = state.bancos[0]?.id || '';
    const secondBankId = state.bancos[1]?.id || firstBankId;

    setPixOrig(firstBankId);
    setPixDest(secondBankId);
    setTransBankId(firstBankId);
    setExpBankId(firstBankId);
    setPayBankId(firstBankId);
    setSalBankId(firstBankId);

    if (activeModal === 'fireConfig') {
      setFireNome(cxFire?.nome || 'Independência Financeira (Aposentadoria FIRE)');
      setFireSaldo(String(cxFire?.saldo ?? 5000));
      setFireAporte(String(cxFire?.aporteMensal ?? 300));
      setFireInst(cxFire?.instituicao || 'Tesouro IPCA+ / XP');
    }

    if (activeModal === 'aporteGoal' || activeModal === 'withdrawGoal') {
      const targetCx = state.caixinhas.find((c) => c.id === selectedId);
      setTransVal(String(targetCx?.aporteMensal || 200));
    }

    if (activeModal === 'paydayConfig') {
      setPayType(state.configPagamento.tipo);
      setPayFixedDay(String(state.configPagamento.diaFixo || 5));
      setPayExactDate(state.configPagamento.dataExata || '');
    }

    if (activeModal === 'cmdk') {
      setCmdkQuery('');
    }

    if (activeModal === 'quickEditValue') {
      setQuickEditVal(quickEditConfig ? String(quickEditConfig.initialValue) : '0');
    }
  }, [activeModal, selectedId, quickEditConfig]);

  const targetCaixinha = state.caixinhas.find((c) => c.id === selectedId);
  const despesasMes = state.despesasPorMes[state.competenciaAtual] || [];
  const targetExpense = despesasMes.find((d) => d.id === selectedId);
  const parsedQuick = parseQuickExpenseCommand(cmdkQuery);

  const handleSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const now = performance.now();
    dragStateRef.current = {
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: now,
      velocityY: 0,
    };
    setIsDragging(true);
  };

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const now = performance.now();
    const dt = Math.max(1, now - dragStateRef.current.lastTime);
    const instantVy = ((e.clientY - dragStateRef.current.lastY) / dt) * 1000;
    dragStateRef.current.velocityY = dragStateRef.current.velocityY * 0.35 + instantVy * 0.65;
    dragStateRef.current.lastY = e.clientY;
    dragStateRef.current.lastTime = now;

    const rawDelta = e.clientY - dragStateRef.current.startY;
    const nextOffset = rawDelta < 0 ? rubberbandOffset(rawDelta, 320, 0.55) : rawDelta;
    setDragOffsetY(nextOffset);
  };

  const handleSheetPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    if (shouldDismissSheetOnRelease(dragOffsetY, dragStateRef.current.velocityY, 110)) {
      setDragOffsetY(0);
      onClose();
    } else {
      setDragOffsetY(0);
    }
  };

  return (
    <AnimatePresence>
      {activeModal && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.1 : 0.2 }}
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key={activeModal}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: dragOffsetY, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
            transition={
              isDragging
                ? { duration: 0 }
                : shouldReduceMotion
                  ? { duration: 0.12 }
                  : { type: 'spring', bounce: 0, duration: 0.32 }
            }
            className="apple-glass-sheet rounded-2xl w-full max-w-lg px-6 pb-6 pt-3 max-h-[90vh] overflow-y-auto space-y-4"
          >
            {/* Apple WWDC §2 / §6: 1:1 Tactile Drag Handle with Momentum Projection & Rubber-banding */}
            <div
              aria-hidden="true"
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={handleSheetPointerUp}
              onPointerCancel={handleSheetPointerUp}
              className="w-full py-2 -mt-1 flex justify-center cursor-grab active:cursor-grabbing select-none touch-none"
            >
              <div className="w-10 h-1.5 rounded-full bg-slate-300/90 dark:bg-slate-700/90" />
            </div>

        {/* QUICK VALUE EDIT (M3 FLUID & ACCESSIBLE REPLACEMENT FOR PROMPT) */}
        {activeModal === 'quickEditValue' && quickEditConfig && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = parseFloat(quickEditVal.replace(',', '.')) || 0;
              const finalVal = quickEditConfig.allowNegative ? num : Math.max(0, num);
              quickEditConfig.onConfirm(Math.round(finalVal * 100) / 100);
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {quickEditConfig.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar janela"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {quickEditConfig.description}
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Novo Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                autoFocus
                required
                value={quickEditVal}
                onChange={(e) => setQuickEditVal(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvar Alteração</span>
              </button>
            </div>
          </form>
        )}

        {/* COMMAND PALETTE (CTRL+K) */}
        {activeModal === 'cmdk' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={cmdkQuery}
                onChange={(e) => setCmdkQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parsedQuick) {
                    e.preventDefault();
                    onSaveNewExpense(
                      parsedQuick.descricao,
                      parsedQuick.valor,
                      new Date().getDate(),
                      parsedQuick.categoria,
                      true,
                      state.bancos[0]?.id || null
                    );
                    onClose();
                  }
                }}
                placeholder="Digite um gasto (ex: 'Almoço 38,50 pix') ou busque uma aba..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded cursor-pointer"
              >
                ESC
              </button>
            </div>

            {parsedQuick && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Lançamento Rápido Detectado: {parsedQuick.descricao}</span>
                  </div>
                  <div className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Categoria: {parsedQuick.categoria} · Forma: {parsedQuick.formaPagamento}
                  </div>
                </div>
                <button
                  onClick={() => {
                    onSaveNewExpense(
                      parsedQuick.descricao,
                      parsedQuick.valor,
                      new Date().getDate(),
                      parsedQuick.categoria,
                      true,
                      state.bancos[0]?.id || null
                    );
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-mono text-xs font-bold shrink-0 cursor-pointer"
                >
                  Lançar {fmtBRL(parsedQuick.valor)} ↵
                </button>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 px-2">Navegação & Ações Rápidas</span>
              {[
                { label: 'Ir para Visão Geral (Cockpit)', action: () => { onNavigate('visao-geral'); onClose(); } },
                { label: 'Ir para Diagnóstico & Auditoria do App', action: () => { onNavigate('diagnostico'); onClose(); } },
                { label: 'Ir para Bancos & Saldos', action: () => { onNavigate('bancos'); onClose(); } },
                { label: 'Ir para Caixinhas & Aposentadoria FIRE', action: () => { onNavigate('caixinhas'); onClose(); } },
                { label: 'Ir para Contracheque & INSS/IRRF', action: () => { onNavigate('contracheque'); onClose(); } },
                { label: 'Ir para Cartões & Simulador', action: () => { onNavigate('cartoes'); onClose(); } },
                { label: 'Ir para Despesas & Envelopes', action: () => { onNavigate('despesas'); onClose(); } },
              ]
                .filter((item) => !cmdkQuery || item.label.toLowerCase().includes(cmdkQuery.toLowerCase()))
                .map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors block cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* MODAL: NOVA CONTA BANCÁRIA */}
        {activeModal === 'newBank' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!bankNome.trim()) return;
              onSaveBank(
                bankNome.trim(),
                bankTipo,
                parseFloat(bankSaldo) || 0,
                bankRende,
                bankRende ? parseFloat(bankPctCdi) || 100 : 0
              );
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Cadastrar Conta Bancária</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Nome da Instituição
              </label>
              <input
                type="text"
                required
                value={bankNome}
                onChange={(e) => setBankNome(e.target.value)}
                placeholder="Ex: Nubank, Itaú, Inter, Carteira"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Tipo de Conta
                </label>
                <select
                  value={bankTipo}
                  onChange={(e) => setBankTipo(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="Conta Digital">Conta Digital</option>
                  <option value="Conta Corrente">Conta Corrente</option>
                  <option value="Investimento">Corretora / Investimento</option>
                  <option value="Dinheiro Físico">Carteira (Espécie)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Saldo Atual (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={bankSaldo}
                  onChange={(e) => setBankSaldo(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bankRende}
                  onChange={(e) => setBankRende(e.target.checked)}
                />
                <span>O saldo desta conta rende automaticamente no CDI?</span>
              </label>
              {bankRende && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Percentual do CDI (%)</label>
                  <input
                    type="number"
                    value={bankPctCdi}
                    onChange={(e) => setBankPctCdi(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Conta
              </button>
            </div>
          </form>
        )}

        {/* MODAL: TRANSFERÊNCIA PIX */}
        {activeModal === 'pixTransfer' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onExecutePix(pixOrig, pixDest, parseFloat(pixVal) || 0);
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Transferência Pix entre Contas</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Conta de Origem (Sai de)
              </label>
              <select
                value={pixOrig}
                onChange={(e) => setPixOrig(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} ({fmtBRL(b.saldo)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Conta de Destino (Entra em)
              </label>
              <select
                value={pixDest}
                onChange={(e) => setPixDest(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} ({fmtBRL(b.saldo)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Valor da Transferência (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={pixVal}
                onChange={(e) => setPixVal(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmar Transferência
              </button>
            </div>
          </form>
        )}

        {/* MODAL: NOVA CAIXINHA / META */}
        {activeModal === 'newGoal' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!goalNome.trim()) return;
              onSaveGoal(
                goalNome.trim(),
                goalTipo,
                parseFloat(goalSaldo) || 0,
                parseFloat(goalAporte) || 0,
                parseFloat(goalMeta) || 0,
                goalInst.trim() || 'Nubank (100% CDI)'
              );
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Criar Nova Caixinha / Meta</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Nome do Objetivo
              </label>
              <input
                type="text"
                required
                value={goalNome}
                onChange={(e) => setGoalNome(e.target.value)}
                placeholder="Ex: Reserva de Emergência, Troca de Notebook, IPVA"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Categoria da Meta
                </label>
                <select
                  value={goalTipo}
                  onChange={(e) => setGoalTipo(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="emergencia">Reserva de Emergência</option>
                  <option value="viagem">Consumo Programado / Viagem</option>
                  <option value="outros">Outro Objetivo</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Onde fica guardado?
                </label>
                <input
                  type="text"
                  value={goalInst}
                  onChange={(e) => setGoalInst(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Saldo Já Guardado
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={goalSaldo}
                  onChange={(e) => setGoalSaldo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Aporte Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={goalAporte}
                  onChange={(e) => setGoalAporte(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Meta Final (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={goalMeta}
                  onChange={(e) => setGoalMeta(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Meta
              </button>
            </div>
          </form>
        )}

        {/* MODAL: CONFIGURAR APOSENTADORIA FIRE */}
        {activeModal === 'fireConfig' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveFireGoal(
                fireNome.trim() || 'Independência Financeira (Aposentadoria FIRE)',
                parseFloat(fireSaldo) || 0,
                parseFloat(fireAporte) || 0,
                fireInst.trim() || 'Tesouro IPCA+ / XP'
              );
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Configurar Plano de Independência Financeira (FIRE)
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Título do Pote de Longo Prazo
              </label>
              <input
                type="text"
                required
                value={fireNome}
                onChange={(e) => setFireNome(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Saldo Já Investido Hoje (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fireSaldo}
                  onChange={(e) => setFireSaldo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Aporte Mensal Planejado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fireAporte}
                  onChange={(e) => setFireAporte(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Corretora / Custódia
              </label>
              <input
                type="text"
                value={fireInst}
                onChange={(e) => setFireInst(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Plano FIRE
              </button>
            </div>
          </form>
        )}

        {/* MODAL: APORTAR OU RESGATAR DE CAIXINHA */}
        {(activeModal === 'aporteGoal' || activeModal === 'withdrawGoal') && targetCaixinha && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onExecuteGoalTransfer(
                targetCaixinha.id,
                transBankId,
                parseFloat(transVal) || 0,
                activeModal === 'aporteGoal' ? 'aporte' : 'withdraw'
              );
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {activeModal === 'aporteGoal'
                  ? `Aportar em ${targetCaixinha.nome}`
                  : `Resgatar de ${targetCaixinha.nome}`}
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Valor (R$) — Saldo na Caixinha: {fmtBRL(targetCaixinha.saldo)}
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={transVal}
                onChange={(e) => setTransVal(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                {activeModal === 'aporteGoal'
                  ? 'Debitar de qual Conta Bancária?'
                  : 'Creditar em qual Conta Bancária?'}
              </label>
              <select
                value={transBankId}
                onChange={(e) => setTransBankId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} (Saldo: {fmtBRL(b.saldo)})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmar Operação
              </button>
            </div>
          </form>
        )}

        {/* MODAL: NOVO CARTÃO DE CRÉDITO */}
        {activeModal === 'newCard' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!cardNome.trim()) return;
              onSaveCard(
                cardNome.trim(),
                parseInt(cardCorte, 10) || 10,
                parseInt(cardVenc, 10) || 17,
                cardBeneficio,
                parseFloat(cardLimite) || 5000,
                parseFloat(cardFatura) || 0
              );
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Cadastrar Cartão de Crédito</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Nome do Cartão
              </label>
              <input
                type="text"
                required
                value={cardNome}
                onChange={(e) => setCardNome(e.target.value)}
                placeholder="Ex: Nubank Ultravioleta, Itaú Click"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia de Fechamento
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cardCorte}
                  onChange={(e) => setCardCorte(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia de Vencimento
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={cardVenc}
                  onChange={(e) => setCardVenc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Limite Total (R$)
                </label>
                <input
                  type="number"
                  step="100"
                  value={cardLimite}
                  onChange={(e) => setCardLimite(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Fatura Aberta (R$)
                </label>
                <input
                  type="number"
                  step="10"
                  value={cardFatura}
                  onChange={(e) => setCardFatura(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Benefício
                </label>
                <select
                  value={cardBeneficio}
                  onChange={(e) => setCardBeneficio(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="Cashback">Cashback</option>
                  <option value="Milhas">Milhas / Pontos</option>
                  <option value="SemAnuidade">Sem Anuidade</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Cartão
              </button>
            </div>
          </form>
        )}

        {/* MODAL: REGISTRAR GASTO AVULSO */}
        {activeModal === 'newExpense' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!expDesc.trim()) return;
              onSaveNewExpense(
                expDesc.trim(),
                parseFloat(expVal) || 0,
                parseInt(expDia, 10) || 15,
                expCat,
                expPaga,
                expPaga ? expBankId || null : null
              );
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Registrar Gasto em {formatMonthYear(state.competenciaAtual)}
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Descrição do Gasto
              </label>
              <input
                type="text"
                required
                value={expDesc}
                onChange={(e) => setExpDesc(e.target.value)}
                placeholder="Ex: Supermercado, Farmácia, Almoço"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[25, 50, 100, 200, 350].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setExpVal(String(v))}
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  R$ {v}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={expVal}
                  onChange={(e) => setExpVal(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia Vencimento
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={expDia}
                  onChange={(e) => setExpDia(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Categoria
                </label>
                <select
                  value={expCat}
                  onChange={(e) => setExpCat(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                >
                  <option value="Alimentação">Alimentação (50%)</option>
                  <option value="Transporte">Transporte (50%)</option>
                  <option value="Moradia">Moradia (50%)</option>
                  <option value="Utilidades">Utilidades (50%)</option>
                  <option value="Saúde">Saúde (50%)</option>
                  <option value="Educação">Educação (50%)</option>
                  <option value="Lazer">Lazer (30%)</option>
                  <option value="Assinaturas">Assinaturas (30%)</option>
                  <option value="Imprevisto">Imprevisto (30%)</option>
                  <option value="Outros">Outros (30%)</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={expPaga}
                  onChange={(e) => setExpPaga(e.target.checked)}
                />
                <span>Já foi pago agora (debitar imediatamente do saldo bancário)</span>
              </label>
              {expPaga && (
                <select
                  value={expBankId}
                  onChange={(e) => setExpBankId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  {state.bancos.map((b) => (
                    <option key={b.id} value={b.id}>
                      Debitar de: {b.nome} ({fmtBRL(b.saldo)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Adicionar Gasto
              </button>
            </div>
          </form>
        )}

        {/* MODAL: QUITAR DESPESA */}
        {activeModal === 'payExpense' && targetExpense && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onConfirmPayExpense(targetExpense.id, payBankId || null);
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirmar Quitação de Conta</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-500">Despesa selecionada:</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {targetExpense.descricao}
              </div>
              <div className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                {fmtBRL(targetExpense.valor)}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Debitar de qual Conta Bancária?
              </label>
              <select
                value={payBankId}
                onChange={(e) => setPayBankId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="">Apenas marcar como paga (sem debitar de banco)</option>
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} (Saldo: {fmtBRL(b.saldo)})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmar Pagamento
              </button>
            </div>
          </form>
        )}

        {/* MODAL: MOLDE DE CONTAS RECORRENTES */}
        {activeModal === 'templateModal' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Molde Central de Despesas Fixas Recorrentes
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Toda conta ativa aqui é clonada automaticamente quando você avança para um novo mês.
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto border-t border-b border-slate-100 dark:border-slate-800">
              {state.despesasFixasMolde.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{m.descricao}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-500">
                      Dia {m.diaVencimento} · {fmtBRL(m.valorPadrao)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleTemplateItem(m.id)}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center ${
                        m.ativa
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {m.ativa ? 'Ativa' : 'Pausada'}
                    </button>
                    <button
                      onClick={() => onDeleteTemplateItem(m.id)}
                      aria-label={`Remover ${m.descricao} do molde`}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer inline-flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!tplDesc.trim()) return;
                onAddTemplateItem(
                  tplDesc.trim(),
                  parseFloat(tplVal) || 0,
                  parseInt(tplDia, 10) || 10,
                  tplCat
                );
                setTplDesc('');
                setTplVal('');
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2"
            >
              <input
                type="text"
                required
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
                placeholder="Nome da conta fixa"
                className="sm:col-span-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
              <input
                type="number"
                step="0.01"
                required
                value={tplVal}
                onChange={(e) => setTplVal(e.target.value)}
                placeholder="Valor (R$)"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
              <input
                type="number"
                min={1}
                max={31}
                value={tplDia}
                onChange={(e) => setTplDia(e.target.value)}
                placeholder="Dia venc."
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
              <select
                value={tplCat}
                onChange={(e) => setTplCat(e.target.value as any)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="Moradia">Moradia</option>
                <option value="Conectividade">Conectividade</option>
                <option value="Utilidades">Utilidades</option>
                <option value="Alimentação">Alimentação</option>
                <option value="Saúde">Saúde</option>
                <option value="Assinaturas">Assinaturas</option>
              </select>
              <button
                type="submit"
                className="bg-emerald-700 text-white rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
              >
                + Cadastrar Fixa
              </button>
            </form>
          </div>
        )}

        {/* MODAL: RECEBER SALÁRIO (SALARY SORTER) */}
        {activeModal === 'receiveSalary' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onConfirmReceiveSalary(salBankId, salAutoAporte);
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Orquestrador de Salário (Pague-se Primeiro)
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                Salário Líquido Apurado:
              </span>
              <div className="font-mono text-2xl font-extrabold text-emerald-900 dark:text-white mt-0.5">
                {fmtBRL(state.salario.liquido)}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Depositar em qual Conta Bancária?
              </label>
              <select
                value={salBankId}
                onChange={(e) => setSalBankId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nome} (Saldo atual: {fmtBRL(b.saldo)})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={salAutoAporte}
                onChange={(e) => setSalAutoAporte(e.target.checked)}
              />
              <span>
                Separar automaticamente os aportes programados das Caixinhas (
                {fmtBRL(state.caixinhas.reduce((s, c) => s + c.aporteMensal, 0))})
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmar Recebimento
              </button>
            </div>
          </form>
        )}

        {/* MODAL: DATA DO PAGAMENTO */}
        {activeModal === 'paydayConfig' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSavePaydayConfig(payType, parseInt(payFixedDay, 10) || 5, payExactDate || null);
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Regra da Data do Próximo Salário
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Regra de Recebimento
              </label>
              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="quintoDiaUtil">5º Dia Útil do Mês (Padrão CLT)</option>
                <option value="diaFixo">Dia Fixo do Mês (ex: dia 5, 15, 25, 30)</option>
                <option value="dataExata">Data Manual Específica</option>
              </select>
            </div>
            {payType === 'diaFixo' && (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia do Mês (1 a 31)
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={payFixedDay}
                  onChange={(e) => setPayFixedDay(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            )}
            {payType === 'dataExata' && (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Data do Próximo Pagamento
                </label>
                <input
                  type="date"
                  value={payExactDate}
                  onChange={(e) => setPayExactDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Regra
              </button>
            </div>
          </form>
        )}

        {/* MODAL: CENTRAL DE BACKUP & EXPORTAÇÃO */}
        {activeModal === 'backup' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Central de Backup, Planilhas & Dados
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Seus dados ficam salvos localmente no navegador com total privacidade. Exporte backups em JSON ou planilhas CSV compatíveis com Excel.
            </p>

            <div className="space-y-2.5">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                    Exportar Backup Completo (JSON)
                  </strong>
                  <span className="text-xs text-slate-500">
                    Compatível para restauração completa em qualquer dispositivo.
                  </span>
                </div>
                <button
                  onClick={onExportJSON}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar JSON</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                    Exportar Planilha Consolidada (CSV / Excel)
                  </strong>
                  <span className="text-xs text-slate-500">
                    Relatório estruturado com contas, caixinhas, salário e despesas.
                  </span>
                </div>
                <button
                  onClick={onExportCSV}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0 cursor-pointer"
                >
                  Exportar CSV
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                    Restaurar Backup (JSON)
                  </strong>
                  <span className="text-xs text-slate-500">
                    Importa um arquivo JSON do seu dispositivo (compatível com a versão anterior).
                  </span>
                </div>
                <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 shrink-0 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Carregar</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        onImportJSON(f);
                        onClose();
                      }
                    }}
                  />
                </label>
              </div>

              <div className="border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                    Restaurar Dados de Exemplo
                  </strong>
                  <span className="text-xs text-rose-600/80 dark:text-rose-400/80">
                    Reinicia o aplicativo para os dados demonstrativos de fábrica.
                  </span>
                </div>
                <button
                  onClick={() => {
                    onResetFactory();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Resetar Dados
                </button>
              </div>
            </div>
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
