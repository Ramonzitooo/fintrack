import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppState, fmtBRL, formatMonthYear } from '../utils/storage';
import {
  ExpenseItem,
  parseQuickExpenseCommand,
  rubberbandOffset,
  shouldDismissSheetOnRelease,
} from '../utils/financeMath';
import {
  AUTO_LOCK_OPTIONS,
  evaluatePasswordStrength,
  generateRecoveryKey,
  MIN_VAULT_PASSWORD_LENGTH,
  VaultSessionConfig,
} from '../utils/cryptoVault';
import {
  X,
  Search,
  Sparkles,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Shield,
  Lock,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';

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
  | 'vaultSecurity'
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
  privacyMode: boolean;
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
    bankId: string | null,
    totalParcelas?: number
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
  vaultActive: boolean;
  vaultConfig: VaultSessionConfig;
  lastGeneratedRecoveryKey: string | null;
  onActivateVault: (password: string, recoveryKey: string, autoLockMin: number) => Promise<void>;
  onDeactivateVault: (currentPassword: string) => Promise<boolean>;
  onUpdateVaultAutoLock: (autoLockMin: number) => void;
  onLockVaultNow: () => void | Promise<void>;
  onExportVault: () => void;
  onImportVault: (file: File, secret: string) => Promise<{ ok: boolean; error?: string }>;
}

export const AppModals: React.FC<AppModalsProps> = ({
  activeModal,
  selectedId,
  state,
  privacyMode,
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
  vaultActive,
  vaultConfig,
  lastGeneratedRecoveryKey,
  onActivateVault,
  onDeactivateVault,
  onUpdateVaultAutoLock,
  onLockVaultNow,
  onExportVault,
  onImportVault,
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
  const [expParcelas, setExpParcelas] = useState('1');

  // Vault Security modal state
  const [vaultPwd, setVaultPwd] = useState('');
  const [vaultPwdConfirm, setVaultPwdConfirm] = useState('');
  const [vaultShowPwd, setVaultShowPwd] = useState(false);
  const [vaultAutoLock, setVaultAutoLock] = useState<number>(vaultConfig.autoLockMin);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultCopiedKey, setVaultCopiedKey] = useState(false);
  const [confirmDeactivateVault, setConfirmDeactivateVault] = useState(false);
  const [deactivateVaultSecret, setDeactivateVaultSecret] = useState('');
  const [deactivateVaultError, setDeactivateVaultError] = useState<string | null>(null);
  const [deactivateVaultBusy, setDeactivateVaultBusy] = useState(false);
  const [importVaultFile, setImportVaultFile] = useState<File | null>(null);
  const [importVaultSecret, setImportVaultSecret] = useState('');
  const [importVaultError, setImportVaultError] = useState<string | null>(null);
  const [importVaultBusy, setImportVaultBusy] = useState(false);

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
  const [confirmReset, setConfirmReset] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

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

      // Move initial focus inside dialog if nothing inside it has focus yet
      const timer = setTimeout(() => {
        const sheet = sheetRef.current;
        if (!sheet) return;
        if (sheet.contains(document.activeElement)) return;
        const firstFocusable = sheet.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }, 20);
      return () => clearTimeout(timer);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus?.();
      previousFocusRef.current = null;
    }
  }, [activeModal]);

  // Focus trap (Tab / Shift+Tab) inside active dialog
  useEffect(() => {
    if (!activeModal) return;
    const handleTrapKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusables = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !sheet.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !sheet.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleTrapKeyDown);
    return () => window.removeEventListener('keydown', handleTrapKeyDown);
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
    setConfirmReset(false);

    if (activeModal === 'newBank') {
      setBankNome('');
      setBankTipo('Conta Digital');
      setBankSaldo('');
      setBankRende(true);
      setBankPctCdi('100');
    }

    if (activeModal === 'pixTransfer') {
      setPixVal('');
    }

    if (activeModal === 'newGoal') {
      setGoalNome('');
      setGoalTipo('emergencia');
      setGoalSaldo('0');
      setGoalAporte('250');
      setGoalMeta('5000');
      setGoalInst('Nubank (100% CDI)');
    }

    if (activeModal === 'newCard') {
      setCardNome('');
      setCardCorte('10');
      setCardVenc('17');
      setCardBeneficio('Cashback');
      setCardLimite('5000');
      setCardFatura('0');
    }

    if (activeModal === 'newExpense') {
      setExpDesc('');
      setExpVal('');
      setExpDia('15');
      setExpCat('Alimentação');
      setExpPaga(false);
      setExpParcelas('1');
    }

    if (activeModal === 'vaultSecurity') {
      setVaultPwd('');
      setVaultPwdConfirm('');
      setVaultShowPwd(false);
      setVaultAutoLock(vaultConfig.autoLockMin);
      setVaultError(null);
      setVaultCopiedKey(false);
      setConfirmDeactivateVault(false);
      setDeactivateVaultSecret('');
      setDeactivateVaultError(null);
      setDeactivateVaultBusy(false);
      setImportVaultFile(null);
      setImportVaultSecret('');
      setImportVaultError(null);
    }

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
  }, [
    activeModal,
    selectedId,
    quickEditConfig,
    state.bancos,
    state.caixinhas,
    state.configPagamento,
    cxFire,
  ]);

  useEffect(() => {
    if (activeModal !== 'vaultSecurity') {
      setVaultPwd('');
      setVaultPwdConfirm('');
      setImportVaultSecret('');
      setDeactivateVaultSecret('');
      setDeactivateVaultError(null);
      setDeactivateVaultBusy(false);
      setConfirmDeactivateVault(false);
    }
  }, [activeModal]);

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
          aria-labelledby="fintrack-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={sheetRef}
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                {quickEditConfig.title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar janela"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {quickEditConfig.description}
            </p>
            <div>
              <label htmlFor="quick-edit-input" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Novo Valor (R$)
              </label>
              <input
                id="quick-edit-input"
                type="number"
                step="0.01"
                autoFocus
                required
                value={quickEditVal}
                onChange={(e) => setQuickEditVal(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-base font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 privacy-val"
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
            <h3 id="fintrack-modal-title" className="sr-only">
              Busca e Lançamento Rápido
            </h3>
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <input
                id="cmdk-search-input"
                type="text"
                autoFocus
                aria-label="Digite um gasto para lançamento rápido ou busque uma aba"
                value={cmdkQuery}
                onChange={(e) => setCmdkQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parsedQuick) {
                    e.preventDefault();
                    const isCreditCard = parsedQuick.formaPagamento === 'Cartão de Crédito';
                    onSaveNewExpense(
                      parsedQuick.descricao,
                      parsedQuick.valor,
                      new Date().getDate(),
                      parsedQuick.categoria,
                      !isCreditCard,
                      isCreditCard ? null : state.bancos[0]?.id || null
                    );
                    onClose();
                  }
                }}
                placeholder="Digite um gasto (ex: 'Almoço 38,50 pix') ou busque uma aba..."
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar busca rápida"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-0.5 border border-slate-200 dark:border-slate-700 rounded cursor-pointer"
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
                  type="button"
                  onClick={() => {
                    const isCreditCard = parsedQuick.formaPagamento === 'Cartão de Crédito';
                    onSaveNewExpense(
                      parsedQuick.descricao,
                      parsedQuick.valor,
                      new Date().getDate(),
                      parsedQuick.categoria,
                      !isCreditCard,
                      isCreditCard ? null : state.bancos[0]?.id || null
                    );
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold shrink-0 cursor-pointer"
                >
                  Lançar <span className="privacy-val">{fmtBRL(parsedQuick.valor)}</span> ↵
                </button>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2">Navegação & Ações Rápidas</span>
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
                    type="button"
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
              setBankNome('');
              setBankSaldo('');
              setBankPctCdi('100');
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Cadastrar Conta Bancária</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="bank-nome" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Nome da Instituição
              </label>
              <input
                id="bank-nome"
                type="text"
                required
                value={bankNome}
                onChange={(e) => setBankNome(e.target.value)}
                placeholder="Ex: Nubank, Itaú, Inter, Carteira"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="bank-tipo" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Tipo de Conta
                </label>
                <select
                  id="bank-tipo"
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
                <label htmlFor="bank-saldo" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Saldo Atual (R$)
                </label>
                <input
                  id="bank-saldo"
                  type="number"
                  step="0.01"
                  required
                  value={bankSaldo}
                  onChange={(e) => setBankSaldo(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
              <label htmlFor="bank-rende" className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  id="bank-rende"
                  type="checkbox"
                  checked={bankRende}
                  onChange={(e) => setBankRende(e.target.checked)}
                />
                <span>O saldo desta conta rende automaticamente no CDI?</span>
              </label>
              {bankRende && (
                <div>
                  <label htmlFor="bank-pct-cdi" className="text-xs text-slate-600 dark:text-slate-400 block mb-1">Percentual do CDI (%)</label>
                  <input
                    id="bank-pct-cdi"
                    type="number"
                    min={0}
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              setPixVal('');
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Transferência Pix entre Contas</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="pix-orig" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Conta de Origem (Sai de)
              </label>
              <select
                id="pix-orig"
                value={pixOrig}
                onChange={(e) => setPixOrig(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {privacyMode ? `${b.nome} (R$ •••••)` : `${b.nome} (${fmtBRL(b.saldo)})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pix-dest" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Conta de Destino (Entra em)
              </label>
              <select
                id="pix-dest"
                value={pixDest}
                onChange={(e) => setPixDest(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {privacyMode ? `${b.nome} (R$ •••••)` : `${b.nome} (${fmtBRL(b.saldo)})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pix-val" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Valor da Transferência (R$)
              </label>
              <input
                id="pix-val"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={pixVal}
                onChange={(e) => setPixVal(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              setGoalNome('');
              setGoalSaldo('0');
              setGoalAporte('250');
              setGoalMeta('5000');
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Criar Nova Caixinha / Meta</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="goal-nome" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Nome do Objetivo
              </label>
              <input
                id="goal-nome"
                type="text"
                required
                value={goalNome}
                onChange={(e) => setGoalNome(e.target.value)}
                placeholder="Ex: Reserva de Emergência, Troca de Notebook, IPVA"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="goal-tipo" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Categoria da Meta
                </label>
                <select
                  id="goal-tipo"
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
                <label htmlFor="goal-inst" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Onde fica guardado?
                </label>
                <input
                  id="goal-inst"
                  type="text"
                  value={goalInst}
                  onChange={(e) => setGoalInst(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="goal-saldo" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Saldo Já Guardado
                </label>
                <input
                  id="goal-saldo"
                  type="number"
                  step="0.01"
                  min={0}
                  value={goalSaldo}
                  onChange={(e) => setGoalSaldo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
              <div>
                <label htmlFor="goal-aporte" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Aporte Mensal (R$)
                </label>
                <input
                  id="goal-aporte"
                  type="number"
                  step="0.01"
                  min={0}
                  value={goalAporte}
                  onChange={(e) => setGoalAporte(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
              <div>
                <label htmlFor="goal-meta" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Meta Final (R$)
                </label>
                <input
                  id="goal-meta"
                  type="number"
                  step="0.01"
                  min={0}
                  value={goalMeta}
                  onChange={(e) => setGoalMeta(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Configurar Plano de Independência Financeira (FIRE)
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="fire-nome" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Título do Pote de Longo Prazo
              </label>
              <input
                id="fire-nome"
                type="text"
                required
                value={fireNome}
                onChange={(e) => setFireNome(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="fire-saldo" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Saldo Já Investido Hoje (R$)
                </label>
                <input
                  id="fire-saldo"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={fireSaldo}
                  onChange={(e) => setFireSaldo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
              <div>
                <label htmlFor="fire-aporte" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Aporte Mensal Planejado (R$)
                </label>
                <input
                  id="fire-aporte"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={fireAporte}
                  onChange={(e) => setFireAporte(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
            </div>
            <div>
              <label htmlFor="fire-inst" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Corretora / Custódia
              </label>
              <input
                id="fire-inst"
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                {activeModal === 'aporteGoal'
                  ? `Aportar em ${targetCaixinha.nome}`
                  : `Resgatar de ${targetCaixinha.nome}`}
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="goal-trans-val" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Valor (R$) — Saldo na Caixinha: <span className="privacy-val">{fmtBRL(targetCaixinha.saldo)}</span>
              </label>
              <input
                id="goal-trans-val"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={transVal}
                onChange={(e) => setTransVal(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
              />
            </div>
            <div>
              <label htmlFor="goal-trans-bank" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                {activeModal === 'aporteGoal'
                  ? 'Debitar de qual Conta Bancária?'
                  : 'Creditar em qual Conta Bancária?'}
              </label>
              <select
                id="goal-trans-bank"
                value={transBankId}
                onChange={(e) => setTransBankId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {privacyMode ? `${b.nome} (Saldo: R$ •••••)` : `${b.nome} (Saldo: ${fmtBRL(b.saldo)})`}
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              setCardNome('');
              setCardCorte('10');
              setCardVenc('17');
              setCardLimite('5000');
              setCardFatura('0');
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Cadastrar Cartão de Crédito</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="card-nome" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Nome do Cartão
              </label>
              <input
                id="card-nome"
                type="text"
                required
                value={cardNome}
                onChange={(e) => setCardNome(e.target.value)}
                placeholder="Ex: Nubank Ultravioleta, Itaú Click"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="card-corte" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia de Fechamento
                </label>
                <input
                  id="card-corte"
                  type="number"
                  min={1}
                  max={31}
                  value={cardCorte}
                  onChange={(e) => setCardCorte(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="card-venc" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia de Vencimento
                </label>
                <input
                  id="card-venc"
                  type="number"
                  min={1}
                  max={31}
                  value={cardVenc}
                  onChange={(e) => setCardVenc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="card-limite" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Limite Total (R$)
                </label>
                <input
                  id="card-limite"
                  type="number"
                  step="100"
                  min={0}
                  value={cardLimite}
                  onChange={(e) => setCardLimite(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
              <div>
                <label htmlFor="card-fatura" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Fatura Aberta (R$)
                </label>
                <input
                  id="card-fatura"
                  type="number"
                  step="10"
                  min={0}
                  value={cardFatura}
                  onChange={(e) => setCardFatura(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
              <div>
                <label htmlFor="card-beneficio" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Benefício
                </label>
                <select
                  id="card-beneficio"
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              const parcelasNum = Math.max(1, Math.min(48, parseInt(expParcelas, 10) || 1));
              onSaveNewExpense(
                expDesc.trim(),
                parseFloat(expVal) || 0,
                parseInt(expDia, 10) || 15,
                expCat,
                expPaga,
                expPaga ? expBankId || null : null,
                parcelasNum
              );
              setExpDesc('');
              setExpVal('');
              setExpDia('15');
              setExpPaga(false);
              setExpParcelas('1');
              onClose();
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Registrar Gasto em {formatMonthYear(state.competenciaAtual)}
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="exp-desc" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Descrição do Gasto
              </label>
              <input
                id="exp-desc"
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
                  className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  R$ {v}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="exp-val" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Valor (R$)
                </label>
                <input
                  id="exp-val"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={expVal}
                  onChange={(e) => setExpVal(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
              <div>
                <label htmlFor="exp-dia" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia Vencimento
                </label>
                <input
                  id="exp-dia"
                  type="number"
                  min={1}
                  max={31}
                  value={expDia}
                  onChange={(e) => setExpDia(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="exp-cat" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Categoria
                </label>
                <select
                  id="exp-cat"
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
                  <option value="Impostos">Impostos (50%)</option>
                  <option value="Lazer">Lazer (30%)</option>
                  <option value="Assinaturas">Assinaturas (30%)</option>
                  <option value="Imprevisto">Imprevisto (30%)</option>
                  <option value="Outros">Outros (30%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label htmlFor="exp-parcelas" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Parcelas (1x a 48x)
                </label>
                <input
                  id="exp-parcelas"
                  type="number"
                  min={1}
                  max={48}
                  value={expParcelas}
                  onChange={(e) => setExpParcelas(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
              {(() => {
                const nParc = Math.max(1, Math.min(48, parseInt(expParcelas, 10) || 1));
                const totalVal = parseFloat(expVal) || 0;
                if (nParc <= 1 || totalVal <= 0) return null;
                return (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium pb-2">
                    {nParc}x de <span className="font-mono font-bold privacy-val">{fmtBRL(totalVal / nParc)}</span>/mês
                  </p>
                );
              })()}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
              <label htmlFor="exp-paga" className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  id="exp-paga"
                  type="checkbox"
                  checked={expPaga}
                  onChange={(e) => setExpPaga(e.target.checked)}
                />
                <span>Já foi pago agora (debitar imediatamente do saldo bancário)</span>
              </label>
              {expPaga && (
                <div>
                  <label htmlFor="exp-bank" className="sr-only">
                    Conta Bancária para débito
                  </label>
                  <select
                    id="exp-bank"
                    aria-label="Conta Bancária para débito"
                    value={expBankId}
                    onChange={(e) => setExpBankId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                  >
                    {state.bancos.map((b) => (
                      <option key={b.id} value={b.id}>
                        {privacyMode ? `Debitar de: ${b.nome} (R$ •••••)` : `Debitar de: ${b.nome} (${fmtBRL(b.saldo)})`}
                      </option>
                    ))}
                  </select>
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">Confirmar Quitação de Conta</h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-500 dark:text-slate-400">Despesa selecionada:</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {targetExpense.descricao}
              </div>
              <div className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 privacy-val">
                {fmtBRL(targetExpense.valor)}
              </div>
            </div>
            <div>
              <label htmlFor="pay-bank" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Debitar de qual Conta Bancária?
              </label>
              <select
                id="pay-bank"
                value={payBankId}
                onChange={(e) => setPayBankId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="">Apenas marcar como paga (sem debitar de banco)</option>
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {privacyMode ? `${b.nome} (Saldo: R$ •••••)` : `${b.nome} (Saldo: ${fmtBRL(b.saldo)})`}
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Molde Central de Despesas Fixas Recorrentes
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toda conta ativa aqui é clonada automaticamente quando você avança para um novo mês.
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto border-t border-b border-slate-100 dark:border-slate-800">
              {state.despesasFixasMolde.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{m.descricao}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Dia {m.diaVencimento} · <span className="privacy-val">{fmtBRL(m.valorPadrao)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleTemplateItem(m.id)}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center ${
                        m.ativa
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {m.ativa ? 'Ativa' : 'Pausada'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTemplateItem(m.id)}
                      aria-label={`Remover ${m.descricao} do molde`}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer inline-flex items-center justify-center"
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
              <div className="sm:col-span-2">
                <label htmlFor="tpl-desc" className="sr-only">
                  Nome da conta fixa
                </label>
                <input
                  id="tpl-desc"
                  type="text"
                  required
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                  placeholder="Nome da conta fixa"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="tpl-val" className="sr-only">
                  Valor padrão em reais
                </label>
                <input
                  id="tpl-val"
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={tplVal}
                  onChange={(e) => setTplVal(e.target.value)}
                  placeholder="Valor (R$)"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white privacy-val"
                />
              </div>
              <div>
                <label htmlFor="tpl-dia" className="sr-only">
                  Dia de vencimento
                </label>
                <input
                  id="tpl-dia"
                  type="number"
                  min={1}
                  max={31}
                  value={tplDia}
                  onChange={(e) => setTplDia(e.target.value)}
                  placeholder="Dia venc."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="tpl-cat" className="sr-only">
                  Categoria da conta fixa
                </label>
                <select
                  id="tpl-cat"
                  value={tplCat}
                  onChange={(e) => setTplCat(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="Moradia">Moradia</option>
                  <option value="Conectividade">Conectividade</option>
                  <option value="Utilidades">Utilidades</option>
                  <option value="Alimentação">Alimentação</option>
                  <option value="Saúde">Saúde</option>
                  <option value="Assinaturas">Assinaturas</option>
                </select>
              </div>
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer"
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Orquestrador de Salário (Pague-se Primeiro)
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
                Salário Líquido Apurado:
              </span>
              <div className="font-mono text-2xl font-extrabold text-emerald-900 dark:text-white mt-0.5 privacy-val">
                {fmtBRL(state.salario.liquido)}
              </div>
            </div>
            <div>
              <label htmlFor="sal-bank" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Depositar em qual Conta Bancária?
              </label>
              <select
                id="sal-bank"
                value={salBankId}
                onChange={(e) => setSalBankId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {state.bancos.map((b) => (
                  <option key={b.id} value={b.id}>
                    {privacyMode ? `${b.nome} (Saldo atual: R$ •••••)` : `${b.nome} (Saldo atual: ${fmtBRL(b.saldo)})`}
                  </option>
                ))}
              </select>
            </div>
            <label htmlFor="sal-auto-aporte" className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
              <input
                id="sal-auto-aporte"
                type="checkbox"
                checked={salAutoAporte}
                onChange={(e) => setSalAutoAporte(e.target.checked)}
              />
              <span>
                Separar automaticamente os aportes programados das Caixinhas (
                <span className="privacy-val">{fmtBRL(state.caixinhas.reduce((s, c) => s + c.aporteMensal, 0))}</span>)
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Regra da Data do Próximo Salário
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="payday-type" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Regra de Recebimento
              </label>
              <select
                id="payday-type"
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
                <label htmlFor="payday-fixed-day" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Dia do Mês (1 a 31)
                </label>
                <input
                  id="payday-fixed-day"
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
                <label htmlFor="payday-exact-date" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Data do Próximo Pagamento
                </label>
                <input
                  id="payday-exact-date"
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
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
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
              <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Central de Backup, Planilhas & Dados
              </h3>
              <button type="button" onClick={onClose} aria-label="Fechar janela" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Seus dados ficam salvos localmente no navegador com total privacidade. Exporte backups em JSON ou planilhas CSV compatíveis com Excel.
            </p>

            <div className="space-y-2.5">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                    Exportar Backup Completo (JSON)
                  </strong>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Compatível para restauração completa em qualquer dispositivo.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onExportJSON}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar JSON</span>
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                    Exportar Despesas da Competência Ativa (CSV / Excel)
                  </strong>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Planilha com as despesas de {formatMonthYear(state.competenciaAtual)} e proteção anti-injeção.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onExportCSV}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                >
                  Exportar CSV
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                    Restaurar Backup (JSON)
                  </strong>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Importa um arquivo JSON do seu dispositivo (compatível com a versão anterior).
                  </span>
                </div>
                <label className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Carregar</span>
                  <input
                    type="file"
                    accept=".json"
                    aria-label="Selecionar arquivo JSON de backup para restaurar"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) {
                        onImportJSON(f);
                        onClose();
                      }
                    }}
                  />
                </label>
              </div>

              <div className="border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong className="text-xs font-bold text-rose-800 dark:text-rose-300 block">
                      Apagar Todos os Dados (Zerar App)
                    </strong>
                    <span className="text-xs text-rose-700/90 dark:text-rose-300/90">
                      Remove todas as contas, caixinhas, cartões e despesas cadastradas localmente.
                    </span>
                  </div>
                  {!confirmReset && (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Zerar Dados
                    </button>
                  )}
                </div>
                {confirmReset && (
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/70 dark:border-rose-900/50">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 mr-auto">
                      Confirma apagar tudo?
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        onResetFactory();
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirmar Exclusão
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CENTRAL DO COFRE ZERO-KNOWLEDGE (AES-256-GCM) */}
        {activeModal === 'vaultSecurity' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <h3 id="fintrack-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Cofre Zero-Knowledge (AES-256-GCM)
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar janela"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Status da Criptografia Local
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  vaultActive
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {vaultActive ? 'Ativo (PBKDF2-600k + AES-GCM)' : 'Desativado'}
              </span>
            </div>

            {lastGeneratedRecoveryKey && (
              <div
                role="region"
                aria-label="Chave de recuperação gerada"
                className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3.5 space-y-2"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Guarde sua Recovery Key de Emergência (120 bits)</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Esta chave permite recuperar seu cofre caso esqueça a senha mestra. Ela não é salva em nenhum servidor.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white select-all tracking-wider privacy-val">
                    {lastGeneratedRecoveryKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(lastGeneratedRecoveryKey);
                      setVaultCopiedKey(true);
                      setTimeout(() => setVaultCopiedKey(false), 2500);
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {vaultCopiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{vaultCopiedKey ? 'Copiada' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            )}

            {!vaultActive ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setVaultError(null);
                  const strength = evaluatePasswordStrength(vaultPwd);
                  if (!strength.valid) {
                    setVaultError(strength.feedback);
                    return;
                  }
                  if (vaultPwd !== vaultPwdConfirm) {
                    setVaultError('A confirmação da senha mestra não confere.');
                    return;
                  }
                  setVaultBusy(true);
                  try {
                    const recoveryKey = generateRecoveryKey();
                    await onActivateVault(vaultPwd, recoveryKey, vaultAutoLock);
                    setVaultPwd('');
                    setVaultPwdConfirm('');
                  } catch (err) {
                    setVaultError(err instanceof Error ? err.message : 'Erro ao ativar o cofre.');
                  } finally {
                    setVaultBusy(false);
                  }
                }}
                className="space-y-3 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
              >
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Ativar Proteção com Senha Mestra
                </h4>

                <div>
                  <label htmlFor="vault-new-pwd" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Nova Senha Mestra (mínimo {MIN_VAULT_PASSWORD_LENGTH} caracteres)
                  </label>
                  <div className="relative">
                    <input
                      id="vault-new-pwd"
                      type={vaultShowPwd ? 'text' : 'password'}
                      minLength={MIN_VAULT_PASSWORD_LENGTH}
                      required
                      value={vaultPwd}
                      onChange={(e) => setVaultPwd(e.target.value)}
                      placeholder="Digite uma senha forte..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-11 py-2 text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setVaultShowPwd((v) => !v)}
                      aria-label={vaultShowPwd ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {vaultShowPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {vaultPwd.length > 0 && (() => {
                    const res = evaluatePasswordStrength(vaultPwd);
                    const barColors = [
                      'bg-rose-500',
                      'bg-amber-500',
                      'bg-yellow-500',
                      'bg-emerald-500',
                      'bg-emerald-600',
                    ];
                    const widthPct = `${Math.max(15, (res.score / 4) * 100)}%`;
                    return (
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${barColors[res.score]}`} style={{ width: widthPct }} />
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Força: <strong className="capitalize">{res.level.replace('-', ' ')}</strong> — {res.feedback}
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label htmlFor="vault-confirm-pwd" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Confirmar Senha Mestra
                  </label>
                  <input
                    id="vault-confirm-pwd"
                    type={vaultShowPwd ? 'text' : 'password'}
                    minLength={MIN_VAULT_PASSWORD_LENGTH}
                    required
                    value={vaultPwdConfirm}
                    onChange={(e) => setVaultPwdConfirm(e.target.value)}
                    placeholder="Repita a senha mestra"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor="vault-autolock-init" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Bloqueio Automático por Inatividade
                  </label>
                  <select
                    id="vault-autolock-init"
                    value={vaultAutoLock}
                    onChange={(e) => setVaultAutoLock(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    {AUTO_LOCK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {vaultError && (
                  <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {vaultError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={vaultBusy}
                  className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{vaultBusy ? 'Derivando chave e cifrando...' : 'Ativar Cofre Zero-Knowledge'}</span>
                </button>
              </form>
            ) : (
              <div className="space-y-3 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div>
                  <label htmlFor="vault-autolock-active" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Bloqueio Automático por Inatividade
                  </label>
                  <select
                    id="vault-autolock-active"
                    value={vaultConfig.autoLockMin}
                    onChange={(e) => onUpdateVaultAutoLock(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    {AUTO_LOCK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      void onLockVaultNow();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Trancar Agora</span>
                  </button>
                  <button
                    type="button"
                    onClick={onExportVault}
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Exportar Backup .vault</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  {!confirmDeactivateVault ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeactivateVault(true);
                        setDeactivateVaultSecret('');
                        setDeactivateVaultError(null);
                      }}
                      className="min-h-[44px] inline-flex items-center text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Desativar Cofre (salvar dados sem criptografia)
                    </button>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!deactivateVaultSecret.trim()) {
                          setDeactivateVaultError(
                            'Informe sua Senha Mestra ou Recovery Key atual para confirmar a desativação.'
                          );
                          return;
                        }
                        setDeactivateVaultBusy(true);
                        setDeactivateVaultError(null);
                        try {
                          const ok = await onDeactivateVault(deactivateVaultSecret);
                          if (ok) {
                            setDeactivateVaultSecret('');
                            setConfirmDeactivateVault(false);
                          } else {
                            setDeactivateVaultError(
                              'Não foi possível desativar o cofre. A senha mestra ou Recovery Key informada está incorreta. Verifique a credencial e tente novamente.'
                            );
                          }
                        } finally {
                          setDeactivateVaultBusy(false);
                        }
                      }}
                      className="space-y-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg p-3"
                    >
                      <p className="text-xs text-rose-800 dark:text-rose-300 font-semibold">
                        Remover criptografia local? Confirme sua credencial atual para salvar os dados sem proteção do cofre.
                      </p>
                      <div>
                        <label
                          htmlFor="vault-deactivate-secret"
                          className="text-xs font-semibold text-rose-900 dark:text-rose-200 block mb-1"
                        >
                          Senha Mestra ou Recovery Key atual
                        </label>
                        <input
                          id="vault-deactivate-secret"
                          type="password"
                          autoComplete="current-password"
                          required
                          disabled={deactivateVaultBusy}
                          aria-invalid={Boolean(deactivateVaultError)}
                          aria-describedby={deactivateVaultError ? 'vault-deactivate-error' : undefined}
                          value={deactivateVaultSecret}
                          onChange={(e) => {
                            setDeactivateVaultSecret(e.target.value);
                            if (deactivateVaultError) setDeactivateVaultError(null);
                          }}
                          placeholder="Digite sua senha atual ou Recovery Key..."
                          className="w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>
                      {deactivateVaultError && (
                        <p
                          id="vault-deactivate-error"
                          role="alert"
                          className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{deactivateVaultError}</span>
                        </p>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={deactivateVaultBusy}
                          onClick={() => {
                            setConfirmDeactivateVault(false);
                            setDeactivateVaultSecret('');
                            setDeactivateVaultError(null);
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={deactivateVaultBusy || !deactivateVaultSecret.trim()}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                        >
                          {deactivateVaultBusy ? 'Validando...' : 'Desativar Cofre'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Importar Backup Cifrado (.vault v4.0 ou v3.4) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <strong className="text-xs font-bold text-slate-900 dark:text-white block">
                    Importar Backup Cifrado (.vault)
                  </strong>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Compatível com envelopes cifrados v4.0 e legado v3.4.
                  </span>
                </div>
                <label className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-emerald-500">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Selecionar .vault</span>
                  <input
                    type="file"
                    accept=".vault,.json"
                    aria-label="Selecionar arquivo .vault cifrado"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = '';
                      setImportVaultFile(f);
                      setImportVaultSecret('');
                      setImportVaultError(null);
                    }}
                  />
                </label>
              </div>

              {importVaultFile && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!importVaultSecret.trim()) return;
                    setImportVaultBusy(true);
                    setImportVaultError(null);
                    try {
                      const res = await onImportVault(importVaultFile, importVaultSecret);
                      if (!res.ok) {
                        setImportVaultError(res.error || 'Falha ao decifrar arquivo .vault.');
                      } else {
                        setImportVaultFile(null);
                        setImportVaultSecret('');
                        onClose();
                      }
                    } finally {
                      setImportVaultBusy(false);
                    }
                  }}
                  className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800"
                >
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Arquivo: <strong>{importVaultFile.name}</strong>
                  </p>
                  <div>
                    <label htmlFor="vault-import-secret" className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Senha Mestra ou Recovery Key do arquivo
                    </label>
                    <input
                      id="vault-import-secret"
                      type="password"
                      required
                      value={importVaultSecret}
                      onChange={(e) => setImportVaultSecret(e.target.value)}
                      placeholder="Digite a senha ou Recovery Key..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  {importVaultError && (
                    <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{importVaultError}</span>
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImportVaultFile(null);
                        setImportVaultSecret('');
                        setImportVaultError(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={importVaultBusy}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                    >
                      {importVaultBusy ? 'Decifrando...' : 'Desbloquear & Importar'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
