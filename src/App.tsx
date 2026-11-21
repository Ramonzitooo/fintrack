import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AppState,
  DEFAULT_STATE,
  fmtBRL,
  formatMonthYear,
  getLocalDateKey,
  getLocalMonthKey,
  loadAppStateDetailed,
  normalizeState,
  safeGetStorageItem,
  safeJsonParse,
  safeSetStorageItem,
  sanitizeCsvCell,
  saveAppState,
  STORAGE_KEY,
  validateImportJson,
} from './utils/storage';
import {
  addMoney,
  applyExpensePaymentToAccount,
  BankAccount,
  Caixinha,
  CreditCard,
  DebtItem,
  deleteExpenseFromList,
  editExpenseAmountInList,
  executeGoalTransfer,
  ExpenseItem,
  ExtraIncomeItem,
  generateInstallmentExpenses,
  getNextPaydayInfo,
  payExpenseInList,
  receiveSalary,
  refundExpenseInList,
  refundExpensePaymentToAccount,
  subMoney,
  sumMoney,
  syncTemplatesToMonth,
} from './utils/financeMath';
import {
  decryptVaultPayload,
  encryptVaultPayload,
  isEncryptedVaultEnvelope,
  loadVaultSessionConfig,
  saveVaultSessionConfig,
  VaultEnvelope,
  VaultSessionConfig,
} from './utils/cryptoVault';
import { OverviewTab } from './components/OverviewTab';
import { BanksTab, GoalsTab } from './components/BanksAndGoalsTab';
import { PayrollTab, CardsTab } from './components/PayrollAndCardsTab';
import { ExpensesTab } from './components/ExpensesTab';
import { ActiveModalType, AppModals, QuickEditConfig } from './components/AppModals';

const AuditDiagnosticView = lazy(() =>
  import('./components/AuditDiagnosticView').then((m) => ({ default: m.AuditDiagnosticView }))
);
import {
  Eye,
  EyeOff,
  Moon,
  Sun,
  Search,
  Download,
  Plus,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  Shield,
} from 'lucide-react';

const genId = (prefix: string) =>
  `${prefix}_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

const maskMonetaryText = (message: string) =>
  message.replace(/R\$\s*-?[\d.,]+/g, 'R$ •••••');

export default function App() {
  const [initialLoad] = useState(() => loadAppStateDetailed());
  const [state, setState] = useState<AppState>(() => initialLoad.state);
  const [isVaultLocked, setIsVaultLocked] = useState<boolean>(() => initialLoad.status === 'vault_locked');
  const [vaultConfig, setVaultConfig] = useState<VaultSessionConfig>(() => loadVaultSessionConfig());
  const [vaultActive, setVaultActive] = useState<boolean>(
    () => initialLoad.status === 'vault_locked' || loadVaultSessionConfig().enabled
  );
  const [lastGeneratedRecoveryKey, setLastGeneratedRecoveryKey] = useState<string | null>(null);
  const [unlockSecret, setUnlockSecret] = useState('');
  const [unlockShowSecret, setUnlockShowSecret] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);

  const [storageWarning, setStorageWarning] = useState<'vault_locked' | 'corrupt' | null>(() =>
    initialLoad.status === 'corrupt' ? 'corrupt' : null
  );
  const [activeTab, setActiveTab] = useState<string>('visao-geral');
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickEditConfig, setQuickEditConfig] = useState<QuickEditConfig | null>(null);
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => safeGetStorageItem('FINTRACK_PRIVACIDADE') === '1');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = safeGetStorageItem('FINTRACK_M3_THEME');
    if (saved) return saved === 'dark';
    return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  });
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const desktopTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mobileTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const skipSaveRef = useRef<boolean>(initialLoad.status === 'vault_locked');
  const lastSaveErrorRef = useRef<string | null>(null);
  const vaultSecretRef = useRef<string | null>(null);
  const vaultRecoveryKeyRef = useRef<string | null>(null);
  const lastVaultEnvelopeRef = useRef<VaultEnvelope | null>(null);
  const encryptSeqRef = useRef<number>(0);

  const showToast = useCallback(
    (message: string, onUndo?: () => void) => {
      setToast({
        message: privacyMode ? maskMonetaryText(message) : message,
        onUndo,
      });
    },
    [privacyMode]
  );

  const lockVaultNow = useCallback(() => {
    vaultSecretRef.current = null;
    vaultRecoveryKeyRef.current = null;
    encryptSeqRef.current += 1;
    skipSaveRef.current = true;
    setState(structuredClone(DEFAULT_STATE));
    setActiveModal(null);
    setQuickEditConfig(null);
    setToast(null);
    setUnlockSecret('');
    setUnlockError(null);
    setIsVaultLocked(true);
  }, []);

  // Alert on initial corrupt storage
  useEffect(() => {
    if (initialLoad.status === 'corrupt') {
      showToast('Dados corrompidos detectados e preservados em backup local de diagnóstico.');
    }
  }, [initialLoad.status, showToast]);

  // Auto-lock por inatividade quando o cofre está ativo e desbloqueado
  useEffect(() => {
    if (!vaultActive || isVaultLocked || vaultConfig.autoLockMin <= 0) return;
    const timeoutMs = vaultConfig.autoLockMin * 60 * 1000;
    let timerId = window.setTimeout(lockVaultNow, timeoutMs);
    let lastResetAt = Date.now();

    const resetTimer = () => {
      const now = Date.now();
      if (now - lastResetAt < 1000) return;
      lastResetAt = now;
      window.clearTimeout(timerId);
      timerId = window.setTimeout(lockVaultNow, timeoutMs);
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    return () => {
      window.clearTimeout(timerId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [vaultActive, isVaultLocked, vaultConfig.autoLockMin, lockVaultNow]);

  // Sync state to localStorage (plaintext or AES-256-GCM encrypted when vault is active)
  useEffect(() => {
    if (isVaultLocked) return;

    const comp = state.competenciaAtual;
    if (!state.despesasPorMes[comp]) {
      const { list } = syncTemplatesToMonth(comp, [], state.despesasFixasMolde || []);
      setState((prev) => ({
        ...prev,
        despesasPorMes: {
          ...prev.despesasPorMes,
          [comp]: list,
        },
      }));
      return;
    }
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }

    if (vaultActive && vaultSecretRef.current) {
      const secret = vaultSecretRef.current;
      const recoveryKey = vaultRecoveryKeyRef.current ?? undefined;
      const seq = ++encryptSeqRef.current;
      const timer = window.setTimeout(async () => {
        try {
          const envelope = await encryptVaultPayload(state, secret, recoveryKey);
          if (seq !== encryptSeqRef.current) return;
          if (!recoveryKey && lastVaultEnvelopeRef.current?.recoveryWrapped) {
            envelope.recoveryWrapped = lastVaultEnvelopeRef.current.recoveryWrapped;
          }
          lastVaultEnvelopeRef.current = envelope;
          const ok = safeSetStorageItem(STORAGE_KEY, JSON.stringify(envelope));
          if (!ok) {
            showToast('Não foi possível salvar o cofre cifrado no armazenamento local.');
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Erro ao cifrar dados do cofre.';
          showToast(errMsg);
        }
      }, 300);
      return () => window.clearTimeout(timer);
    }

    const res = saveAppState(state);
    if (!res.ok) {
      const errMsg = res.error || 'Erro ao salvar dados localmente.';
      if (lastSaveErrorRef.current !== errMsg) {
        lastSaveErrorRef.current = errMsg;
        const isQuota = /quota/i.test(errMsg);
        showToast(
          isQuota
            ? 'Armazenamento local cheio (QuotaExceededError). Exporte um backup JSON e libere espaço.'
            : `Não foi possível salvar no armazenamento local: ${errMsg}`
        );
      }
    } else {
      lastSaveErrorRef.current = null;
    }
  }, [state, isVaultLocked, vaultActive, showToast]);

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const loaded = loadAppStateDetailed();
        if (loaded.status === 'ok') {
          skipSaveRef.current = true;
          setState(loaded.state);
          setStorageWarning(null);
        } else if (loaded.status === 'vault_locked' || loaded.status === 'corrupt') {
          setStorageWarning(loaded.status);
        }
      } else if (e.key === 'FINTRACK_PRIVACIDADE') {
        setPrivacyMode(e.newValue === '1');
      } else if (e.key === 'FINTRACK_M3_THEME') {
        if (e.newValue) setDarkMode(e.newValue === 'dark');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Sync privacy and dark classes
  useEffect(() => {
    document.body.classList.toggle('privacy-mode', privacyMode);
    safeSetStorageItem('FINTRACK_PRIVACIDADE', privacyMode ? '1' : '0');
  }, [privacyMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    safeSetStorageItem('FINTRACK_M3_THEME', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  // Global keyboard shortcuts (Ctrl+K, N, P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'cmdk' ? null : 'cmdk'));
        return;
      }
      if (activeModal) {
        if (e.key === 'Escape') {
          setActiveModal(null);
          setQuickEditConfig(null);
        }
        return;
      }
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPrivacyMode((prev) => !prev);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setActiveModal('newExpense');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal]);

  const paydayInfo = getNextPaydayInfo(state.configPagamento);

  // Handlers
  const handleSaveBank = (nome: string, tipo: any, saldo: number, rendeJuros: boolean, pctCDI: number) => {
    setState((prev) => ({
      ...prev,
      bancos: [
        ...prev.bancos,
        { id: genId('b'), nome, tipo, saldo, rendeJuros, pctCDI: Math.max(0, pctCDI) },
      ],
    }));
    showToast(`Conta "${nome}" adicionada com sucesso.`);
  };

  const handleExecutePix = (origId: string, destId: string, valor: number) => {
    const safeValor = Math.max(0, Number(valor) || 0);
    const origExists = state.bancos.some((b) => b.id === origId);
    const destExists = state.bancos.some((b) => b.id === destId);
    if (!origExists || !destExists || origId === destId || safeValor <= 0) {
      showToast('Transferência não realizada: selecione contas diferentes e informe um valor maior que zero.');
      return;
    }
    const snapshotBanks = structuredClone(state.bancos);
    setState((prev) => ({
      ...prev,
      bancos: prev.bancos.map((b) => {
        if (b.id === origId) return { ...b, saldo: subMoney(b.saldo, safeValor) };
        if (b.id === destId) return { ...b, saldo: addMoney(b.saldo, safeValor) };
        return b;
      }),
    }));
    showToast(`Transferência Pix de ${fmtBRL(safeValor)} concluída.`, () => {
      setState((prev) => ({ ...prev, bancos: snapshotBanks }));
    });
  };

  const openQuickEdit = useCallback(
    (
      title: string,
      description: string,
      initialValue: number,
      onConfirm: (val: number) => void,
      allowNegative = false
    ) => {
      setQuickEditConfig({
        title,
        description,
        initialValue,
        allowNegative,
        onConfirm,
      });
      setActiveModal('quickEditValue');
    },
    []
  );

  const handleAdjustBankBalance = (bankId: string) => {
    const bank = state.bancos.find((b) => b.id === bankId);
    if (!bank) return;
    openQuickEdit(
      `Ajustar Saldo — ${bank.nome}`,
      'Informe o saldo real verificado no extrato da instituição para conciliação física imediata.',
      bank.saldo,
      (novoSaldo) => {
        setState((prev) => ({
          ...prev,
          bancos: prev.bancos.map((b) => (b.id === bankId ? { ...b, saldo: novoSaldo } : b)),
        }));
        showToast(`Saldo de "${bank.nome}" atualizado para ${fmtBRL(novoSaldo)}.`);
      },
      true
    );
  };

  const handleDeleteBank = (bankId: string) => {
    const bank = state.bancos.find((b) => b.id === bankId);
    if (!bank) return;
    const snapshot = structuredClone(state.bancos);
    setState((prev) => ({
      ...prev,
      bancos: prev.bancos.filter((b) => b.id !== bankId),
    }));
    showToast(`Conta "${bank.nome}" removida.`, () => {
      setState((prev) => ({ ...prev, bancos: snapshot }));
    });
  };

  const handleSaveGoal = (
    nome: string,
    tipo: 'emergencia' | 'viagem' | 'aposentadoria' | 'outros',
    saldo: number,
    aporteMensal: number,
    meta: number,
    instituicao: string
  ) => {
    setState((prev) => ({
      ...prev,
      caixinhas: [
        ...prev.caixinhas,
        {
          id: genId('cx'),
          nome,
          tipo,
          saldo: Math.max(0, saldo),
          aporteMensal: Math.max(0, aporteMensal),
          meta: Math.max(0, meta),
          instituicao,
          pctCDI: 100,
        },
      ],
    }));
    showToast(`Caixinha "${nome}" criada.`);
  };

  const handleSaveFireGoal = (nome: string, saldo: number, aporteMensal: number, instituicao: string) => {
    const safeSaldo = Math.max(0, saldo);
    const safeAporte = Math.max(0, aporteMensal);
    setState((prev) => {
      const exists = prev.caixinhas.some((c) => c.tipo === 'aposentadoria');
      const caixinhas = exists
        ? prev.caixinhas.map((c) =>
            c.tipo === 'aposentadoria'
              ? { ...c, nome, saldo: safeSaldo, aporteMensal: safeAporte, instituicao }
              : c
          )
        : [
            ...prev.caixinhas,
            {
              id: genId('cx_fire'),
              nome,
              saldo: safeSaldo,
              aporteMensal: safeAporte,
              meta: 0,
              tipo: 'aposentadoria' as const,
              instituicao,
              pctCDI: 105,
            },
          ];
      return { ...prev, caixinhas };
    });
    showToast('Plano de Independência Financeira (FIRE) atualizado.');
  };

  const handleExecuteGoalTransfer = (
    caixinhaId: string,
    bankId: string,
    valor: number,
    mode: 'aporte' | 'withdraw'
  ) => {
    const safeValor = Math.max(0, Number(valor) || 0);
    if (!bankId || !state.bancos.some((b) => b.id === bankId) || safeValor <= 0) {
      showToast('Operação não realizada: selecione uma conta bancária válida e informe um valor maior que zero.');
      return;
    }
    const res = executeGoalTransfer(state.bancos, state.caixinhas, caixinhaId, bankId, safeValor, mode);
    if (res.effectiveValor <= 0) {
      showToast('Operação não realizada: saldo insuficiente na caixinha ou valor inválido.');
      return;
    }

    const snapshotBanks = structuredClone(state.bancos);
    const snapshotGoals = structuredClone(state.caixinhas);
    setState((prev) => {
      const next = executeGoalTransfer(prev.bancos, prev.caixinhas, caixinhaId, bankId, safeValor, mode);
      return { ...prev, bancos: next.bancos, caixinhas: next.caixinhas };
    });
    showToast(
      mode === 'aporte'
        ? `Aporte de ${fmtBRL(res.effectiveValor)} realizado.`
        : `Resgate de ${fmtBRL(res.effectiveValor)} creditado na conta.`,
      () => {
        setState((prev) => ({ ...prev, bancos: snapshotBanks, caixinhas: snapshotGoals }));
      }
    );
  };

  const handleDeleteGoal = (caixinhaId: string) => {
    const cx = state.caixinhas.find((c) => c.id === caixinhaId);
    if (!cx) return;
    const snapshot = structuredClone(state.caixinhas);
    setState((prev) => ({
      ...prev,
      caixinhas: prev.caixinhas.filter((c) => c.id !== caixinhaId),
    }));
    showToast(`Caixinha "${cx.nome}" removida.`, () => {
      setState((prev) => ({ ...prev, caixinhas: snapshot }));
    });
  };

  // Contracheque handlers
  const recalcPayroll = (proventos: AppState['salario']['proventos'], descontos: AppState['salario']['descontos']) => {
    const bruto = sumMoney(proventos.map((p) => Number(p.valor) || 0));
    const descontosTotal = sumMoney(descontos.map((d) => Number(d.valor) || 0));
    return {
      proventos,
      descontos,
      bruto,
      descontosTotal,
      liquido: Math.max(0, subMoney(bruto, descontosTotal)),
    };
  };

  const handleAddProvento = (nome: string, valor: number) => {
    setState((prev) => {
      const nextP = [...prev.salario.proventos, { id: genId('p'), nome, valor: Math.max(0, valor) }];
      return { ...prev, salario: recalcPayroll(nextP, prev.salario.descontos) };
    });
  };

  const handleUpdateProvento = (id: string, field: 'nome' | 'valor', val: string | number) => {
    setState((prev) => {
      const safeVal = field === 'valor' ? Math.max(0, Number(val) || 0) : val;
      const nextP = prev.salario.proventos.map((p) => (p.id === id ? { ...p, [field]: safeVal } : p));
      return { ...prev, salario: recalcPayroll(nextP, prev.salario.descontos) };
    });
  };

  const handleRemoveProvento = (id: string) => {
    setState((prev) => {
      const nextP = prev.salario.proventos.filter((p) => p.id !== id);
      return { ...prev, salario: recalcPayroll(nextP, prev.salario.descontos) };
    });
  };

  const handleAddDesconto = (nome: string, valor: number) => {
    setState((prev) => {
      const nextD = [...prev.salario.descontos, { id: genId('d'), nome, valor: Math.max(0, valor) }];
      return { ...prev, salario: recalcPayroll(prev.salario.proventos, nextD) };
    });
  };

  const handleUpdateDesconto = (id: string, field: 'nome' | 'valor', val: string | number) => {
    setState((prev) => {
      const safeVal = field === 'valor' ? Math.max(0, Number(val) || 0) : val;
      const nextD = prev.salario.descontos.map((d) => (d.id === id ? { ...d, [field]: safeVal } : d));
      return { ...prev, salario: recalcPayroll(prev.salario.proventos, nextD) };
    });
  };

  const handleRemoveDesconto = (id: string) => {
    setState((prev) => {
      const nextD = prev.salario.descontos.filter((d) => d.id !== id);
      return { ...prev, salario: recalcPayroll(prev.salario.proventos, nextD) };
    });
  };

  const handleApplyOfficialTaxes = (inss: number, irrf: number) => {
    setState((prev) => {
      const others = prev.salario.descontos.filter(
        (d) => !/inss|irrf|imposto de renda/i.test(d.nome)
      );
      const nextD = [
        { id: 'd_inss_auto', nome: 'INSS (Progressivo Oficial)', valor: inss },
        { id: 'd_irrf_auto', nome: 'IRRF (Tabela Oficial)', valor: irrf },
        ...others,
      ];
      return { ...prev, salario: recalcPayroll(prev.salario.proventos, nextD) };
    });
    showToast(`INSS (${fmtBRL(inss)}) e IRRF (${fmtBRL(irrf)}) oficiais aplicados!`);
  };

  const handleConfirmReceiveSalary = (bankId: string, autoAportarCaixinhas: boolean) => {
    const liq = state.salario.liquido;
    if (liq <= 0 || !bankId || !state.bancos.some((b) => b.id === bankId)) {
      showToast('Não foi possível creditar o salário: verifique se o valor líquido é maior que zero e selecione uma conta.');
      return;
    }

    const snapshotBanks = structuredClone(state.bancos);
    const snapshotGoals = structuredClone(state.caixinhas);
    setState((prev) => {
      const next = receiveSalary(prev.bancos, prev.caixinhas, liq, bankId, autoAportarCaixinhas);
      return { ...prev, bancos: next.bancos, caixinhas: next.caixinhas };
    });
    showToast(
      `Salário líquido (${fmtBRL(liq)}) creditado${
        autoAportarCaixinhas ? ' e aportes distribuídos nas caixinhas!' : '!'
      }`,
      () => {
        setState((prev) => ({ ...prev, bancos: snapshotBanks, caixinhas: snapshotGoals }));
      }
    );
  };

  // Despesas handlers (com simetria exata de pagamento e estorno!)
  const handleSaveNewExpense = (
    descricao: string,
    valor: number,
    diaVencimento: number,
    categoria: ExpenseItem['categoria'],
    paga: boolean,
    bankId: string | null,
    totalParcelas = 1
  ) => {
    const safeValor = Math.max(0, Number(valor) || 0);
    const parcelas = Math.max(1, Math.min(48, Math.trunc(Number(totalParcelas) || 1)));
    const comp = state.competenciaAtual;
    const bank = bankId ? state.bancos.find((b) => b.id === bankId) : null;
    const todayIso = getLocalDateKey();

    if (parcelas > 1) {
      const installmentsByMonth = generateInstallmentExpenses({
        baseId: genId('parc'),
        descricao,
        valorTotal: safeValor,
        totalParcelas: parcelas,
        competenciaInicial: comp,
        categoria,
        vencimentoDia: diaVencimento,
        contaOrigemId: bank ? bank.id : null,
        contaOrigem: bank ? bank.nome : undefined,
      });

      const firstMonthItems = installmentsByMonth[comp] || [];
      const firstVal = firstMonthItems[0]?.valor ?? 0;

      if (paga && bankId && firstMonthItems[0]) {
        firstMonthItems[0] = {
          ...firstMonthItems[0],
          paga: true,
          dataPagamento: todayIso,
        };
      }

      const snapshotDespesas = structuredClone(state.despesasPorMes);
      const snapshotBanks = structuredClone(state.bancos);

      setState((prev) => {
        const nextDespesasPorMes = { ...prev.despesasPorMes };
        for (const [monthKey, items] of Object.entries(installmentsByMonth)) {
          nextDespesasPorMes[monthKey] = [...(nextDespesasPorMes[monthKey] || []), ...items];
        }
        return {
          ...prev,
          bancos:
            paga && bankId && firstVal > 0
              ? prev.bancos.map((b) =>
                  b.id === bankId ? { ...b, saldo: applyExpensePaymentToAccount(b.saldo, firstVal) } : b
                )
              : prev.bancos,
          despesasPorMes: nextDespesasPorMes,
        };
      });

      showToast(
        `Parcelamento "${descricao}" (${parcelas}x, total ${fmtBRL(safeValor)}) lançado em ${parcelas} meses.`,
        () => {
          setState((prev) => ({
            ...prev,
            bancos: snapshotBanks,
            despesasPorMes: snapshotDespesas,
          }));
        }
      );
      return;
    }

    const newExp: ExpenseItem = {
      id: genId('d'),
      moldeId: null,
      descricao,
      valor: safeValor,
      diaVencimento,
      categoria,
      paga,
      dataPagamento: paga ? todayIso : null,
      contaOrigem: bank ? bank.nome : null,
      contaOrigemId: bank ? bank.id : null,
    };

    setState((prev) => ({
      ...prev,
      bancos:
        paga && bankId
          ? prev.bancos.map((b) =>
              b.id === bankId ? { ...b, saldo: applyExpensePaymentToAccount(b.saldo, safeValor) } : b
            )
          : prev.bancos,
      despesasPorMes: {
        ...prev.despesasPorMes,
        [comp]: [...(prev.despesasPorMes[comp] || []), newExp],
      },
    }));

    showToast(`Despesa "${descricao}" (${fmtBRL(safeValor)}) registrada.`, () => {
      setState((prev) => ({
        ...prev,
        bancos:
          paga && bankId
            ? prev.bancos.map((b) =>
                b.id === bankId ? { ...b, saldo: refundExpensePaymentToAccount(b.saldo, safeValor) } : b
              )
            : prev.bancos,
        despesasPorMes: {
          ...prev.despesasPorMes,
          [comp]: (prev.despesasPorMes[comp] || []).filter((d) => d.id !== newExp.id),
        },
      }));
    });
  };

  const handleConfirmPayExpense = (expenseId: string, bankId: string | null) => {
    const comp = state.competenciaAtual;
    const list = state.despesasPorMes[comp] || [];
    const target = list.find((d) => d.id === expenseId);
    if (!target || target.paga) return;

    const snapshotBanks = structuredClone(state.bancos);
    const snapshotList = structuredClone(list);
    const todayIso = getLocalDateKey();
    setState((prev) => {
      const next = payExpenseInList(prev.bancos, prev.despesasPorMes[comp] || [], expenseId, bankId, todayIso);
      return {
        ...prev,
        bancos: next.bancos,
        despesasPorMes: { ...prev.despesasPorMes, [comp]: next.despesas },
      };
    });
    showToast(`"${target.descricao}" marcada como paga.`, () => {
      setState((prev) => ({
        ...prev,
        bancos: snapshotBanks,
        despesasPorMes: { ...prev.despesasPorMes, [comp]: snapshotList },
      }));
    });
  };

  const handleRefundExpense = (expenseId: string) => {
    const comp = state.competenciaAtual;
    const list = state.despesasPorMes[comp] || [];
    const target = list.find((d) => d.id === expenseId);
    if (!target || !target.paga) return;

    const snapshotBanks = structuredClone(state.bancos);
    const snapshotList = structuredClone(list);
    setState((prev) => {
      const next = refundExpenseInList(prev.bancos, prev.despesasPorMes[comp] || [], expenseId);
      return {
        ...prev,
        bancos: next.bancos,
        despesasPorMes: { ...prev.despesasPorMes, [comp]: next.despesas },
      };
    });
    showToast(`Pagamento de "${target.descricao}" desfeito e saldo estornado.`, () => {
      setState((prev) => ({
        ...prev,
        bancos: snapshotBanks,
        despesasPorMes: { ...prev.despesasPorMes, [comp]: snapshotList },
      }));
    });
  };

  const handleEditExpenseAmount = (expenseId: string) => {
    const comp = state.competenciaAtual;
    const list = state.despesasPorMes[comp] || [];
    const target = list.find((d) => d.id === expenseId);
    if (!target) return;
    openQuickEdit(
      `Ajustar Valor — ${target.descricao}`,
      `Atualize o valor desta conta em ${formatMonthYear(comp)}. Se já estiver paga, o saldo em conta será reconciliado.`,
      target.valor,
      (novoVal) => {
        const safeVal = Math.max(0, novoVal);
        const snapshotBanks = structuredClone(state.bancos);
        const snapshotList = structuredClone(list);
        setState((prev) => {
          const next = editExpenseAmountInList(prev.bancos, prev.despesasPorMes[comp] || [], expenseId, safeVal);
          return {
            ...prev,
            bancos: next.bancos,
            despesasPorMes: { ...prev.despesasPorMes, [comp]: next.despesas },
          };
        });
        showToast(`Valor de "${target.descricao}" atualizado para ${fmtBRL(safeVal)}.`, () => {
          setState((prev) => ({
            ...prev,
            bancos: snapshotBanks,
            despesasPorMes: { ...prev.despesasPorMes, [comp]: snapshotList },
          }));
        });
      }
    );
  };

  const handleDeleteExpense = (expenseId: string) => {
    const comp = state.competenciaAtual;
    const list = state.despesasPorMes[comp] || [];
    const target = list.find((d) => d.id === expenseId);
    if (!target) return;
    const snapshotList = structuredClone(list);
    const snapshotBanks = structuredClone(state.bancos);

    setState((prev) => {
      const next = deleteExpenseFromList(prev.bancos, prev.despesasPorMes[comp] || [], expenseId);
      return {
        ...prev,
        bancos: next.bancos,
        despesasPorMes: { ...prev.despesasPorMes, [comp]: next.despesas },
      };
    });
    showToast(`"${target.descricao}" removida de ${formatMonthYear(comp)}.`, () => {
      setState((prev) => ({
        ...prev,
        bancos: snapshotBanks,
        despesasPorMes: {
          ...prev.despesasPorMes,
          [comp]: snapshotList,
        },
      }));
    });
  };

  // CRUD & Receitas Avulsas handlers
  const handleUpdateBank = (updated: BankAccount) => {
    const snapshot = structuredClone(state.bancos);
    const safeUpdated: BankAccount = {
      ...updated,
      nome: updated.nome.trim() || 'Conta',
      saldo: Number.isFinite(updated.saldo) ? updated.saldo : 0,
      pctCDI: Math.max(0, Number(updated.pctCDI) || 0),
    };
    setState((prev) => ({
      ...prev,
      bancos: prev.bancos.map((b) => (b.id === safeUpdated.id ? safeUpdated : b)),
    }));
    showToast(`Conta "${safeUpdated.nome}" atualizada.`, () => {
      setState((prev) => ({ ...prev, bancos: snapshot }));
    });
  };

  const handleUpdateGoal = (updated: Caixinha) => {
    const snapshot = structuredClone(state.caixinhas);
    const safeUpdated: Caixinha = {
      ...updated,
      nome: updated.nome.trim() || 'Caixinha',
      saldo: Math.max(0, Number(updated.saldo) || 0),
      aporteMensal: Math.max(0, Number(updated.aporteMensal) || 0),
      meta: Math.max(0, Number(updated.meta) || 0),
      pctCDI: Math.max(0, Number(updated.pctCDI ?? 100) || 0),
    };
    setState((prev) => ({
      ...prev,
      caixinhas: prev.caixinhas.map((c) => (c.id === safeUpdated.id ? safeUpdated : c)),
    }));
    showToast(`Caixinha "${safeUpdated.nome}" atualizada.`, () => {
      setState((prev) => ({ ...prev, caixinhas: snapshot }));
    });
  };

  const handleUpdateCard = (updated: CreditCard) => {
    const snapshot = structuredClone(state.cartoes);
    const safeUpdated: CreditCard = {
      ...updated,
      nome: updated.nome.trim() || 'Cartão',
      diaCorte: Math.max(1, Math.min(31, Math.trunc(Number(updated.diaCorte) || 10))),
      diaVencimento: Math.max(1, Math.min(31, Math.trunc(Number(updated.diaVencimento) || 17))),
      limiteTotal: Math.max(0, Number(updated.limiteTotal) || 0),
      faturaAtual: Math.max(0, Number(updated.faturaAtual) || 0),
    };
    setState((prev) => ({
      ...prev,
      cartoes: prev.cartoes.map((c) => (c.id === safeUpdated.id ? safeUpdated : c)),
    }));
    showToast(`Cartão "${safeUpdated.nome}" atualizado.`, () => {
      setState((prev) => ({ ...prev, cartoes: snapshot }));
    });
  };

  const handleUpdateExpense = (updated: ExpenseItem) => {
    const comp = state.competenciaAtual;
    const snapshotList = structuredClone(state.despesasPorMes[comp] || []);
    const safeUpdated: ExpenseItem = {
      ...updated,
      descricao: updated.descricao.trim() || 'Despesa',
      valor: Math.max(0, Number(updated.valor) || 0),
      diaVencimento: Math.max(1, Math.min(31, Math.trunc(Number(updated.diaVencimento) || 10))),
    };
    setState((prev) => ({
      ...prev,
      despesasPorMes: {
        ...prev.despesasPorMes,
        [comp]: (prev.despesasPorMes[comp] || []).map((d) =>
          d.id === safeUpdated.id ? safeUpdated : d
        ),
      },
    }));
    showToast(`Despesa "${safeUpdated.descricao}" atualizada.`, () => {
      setState((prev) => ({
        ...prev,
        despesasPorMes: {
          ...prev.despesasPorMes,
          [comp]: snapshotList,
        },
      }));
    });
  };

  const handleAddExtraIncome = (item: Omit<ExtraIncomeItem, 'id'>) => {
    const comp = state.competenciaAtual;
    const safeItem: ExtraIncomeItem = {
      ...item,
      id: genId('rec'),
      descricao: item.descricao.trim() || 'Receita Extra',
      valor: Math.max(0, Number(item.valor) || 0),
    };
    const snapshotReceitas = structuredClone(state.receitasPorMes?.[comp] || []);
    setState((prev) => ({
      ...prev,
      receitasPorMes: {
        ...(prev.receitasPorMes || {}),
        [comp]: [...(prev.receitasPorMes?.[comp] || []), safeItem],
      },
    }));
    showToast(`Receita "${safeItem.descricao}" (${fmtBRL(safeItem.valor)}) adicionada.`, () => {
      setState((prev) => ({
        ...prev,
        receitasPorMes: {
          ...(prev.receitasPorMes || {}),
          [comp]: snapshotReceitas,
        },
      }));
    });
  };

  const handleToggleExtraIncome = (id: string) => {
    const comp = state.competenciaAtual;
    const current = state.receitasPorMes?.[comp] || [];
    const target = current.find((r) => r.id === id);
    if (!target) return;
    const snapshotReceitas = structuredClone(current);
    setState((prev) => ({
      ...prev,
      receitasPorMes: {
        ...(prev.receitasPorMes || {}),
        [comp]: (prev.receitasPorMes?.[comp] || []).map((r) =>
          r.id === id ? { ...r, recebida: !r.recebida } : r
        ),
      },
    }));
    showToast(
      !target.recebida
        ? `Receita "${target.descricao}" marcada como recebida.`
        : `Receita "${target.descricao}" marcada como pendente.`,
      () => {
        setState((prev) => ({
          ...prev,
          receitasPorMes: {
            ...(prev.receitasPorMes || {}),
            [comp]: snapshotReceitas,
          },
        }));
      }
    );
  };

  const handleDeleteExtraIncome = (id: string) => {
    const comp = state.competenciaAtual;
    const current = state.receitasPorMes?.[comp] || [];
    const target = current.find((r) => r.id === id);
    if (!target) return;
    const snapshotReceitas = structuredClone(current);
    setState((prev) => ({
      ...prev,
      receitasPorMes: {
        ...(prev.receitasPorMes || {}),
        [comp]: (prev.receitasPorMes?.[comp] || []).filter((r) => r.id !== id),
      },
    }));
    showToast(`Receita "${target.descricao}" removida.`, () => {
      setState((prev) => ({
        ...prev,
        receitasPorMes: {
          ...(prev.receitasPorMes || {}),
          [comp]: snapshotReceitas,
        },
      }));
    });
  };

  // Vault Zero-Knowledge handlers
  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockSecret.trim()) return;
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const raw = safeGetStorageItem(STORAGE_KEY);
      if (!raw) {
        throw new Error('Nenhum envelope cifrado encontrado no armazenamento local.');
      }
      const parsed = safeJsonParse(raw);
      if (!isEncryptedVaultEnvelope(parsed)) {
        throw new Error('Dados locais não estão no formato de cofre cifrado.');
      }
      const decrypted = await decryptVaultPayload<unknown>(parsed, unlockSecret);
      const normalized = normalizeState(decrypted);
      vaultSecretRef.current = unlockSecret;
      vaultRecoveryKeyRef.current = null;
      if ('salt' in parsed && typeof parsed.salt === 'string') {
        lastVaultEnvelopeRef.current = parsed as VaultEnvelope;
      }
      skipSaveRef.current = true;
      setState(normalized);
      setVaultActive(true);
      setIsVaultLocked(false);
      setStorageWarning(null);
      setUnlockSecret('');
      setVaultConfig(saveVaultSessionConfig({ enabled: true, autoLockMin: vaultConfig.autoLockMin }));
      showToast('Cofre desbloqueado com sucesso.');
    } catch (err) {
      setUnlockError(
        err instanceof Error ? err.message : 'Credencial incorreta ou dados corrompidos.'
      );
    } finally {
      setUnlockBusy(false);
    }
  };

  const handleActivateVault = async (password: string, recoveryKey: string, autoLockMin: number) => {
    const envelope = await encryptVaultPayload(state, password, recoveryKey);
    const saved = safeSetStorageItem(STORAGE_KEY, JSON.stringify(envelope));
    if (!saved) {
      throw new Error('Não foi possível gravar o cofre no armazenamento local (verifique espaço disponível).');
    }
    vaultSecretRef.current = password;
    vaultRecoveryKeyRef.current = recoveryKey;
    lastVaultEnvelopeRef.current = envelope;
    setVaultConfig(saveVaultSessionConfig({ enabled: true, autoLockMin }));
    setVaultActive(true);
    setLastGeneratedRecoveryKey(recoveryKey);
    setStorageWarning(null);
    showToast('Cofre Zero-Knowledge AES-256-GCM ativado!');
  };

  const handleDeactivateVault = () => {
    vaultSecretRef.current = null;
    vaultRecoveryKeyRef.current = null;
    lastVaultEnvelopeRef.current = null;
    encryptSeqRef.current += 1;
    setLastGeneratedRecoveryKey(null);
    setVaultActive(false);
    setVaultConfig(saveVaultSessionConfig({ enabled: false, autoLockMin: vaultConfig.autoLockMin }));
    safeSetStorageItem(STORAGE_KEY, JSON.stringify(state));
    showToast('Cofre desativado. Os dados agora são salvos localmente sem criptografia.');
  };

  const handleUpdateVaultAutoLock = (autoLockMin: number) => {
    const nextCfg = saveVaultSessionConfig({ enabled: vaultActive, autoLockMin });
    setVaultConfig(nextCfg);
    showToast(
      autoLockMin > 0
        ? `Auto-bloqueio ajustado para ${autoLockMin} minutos.`
        : 'Auto-bloqueio por inatividade desativado.'
    );
  };

  const handleExportVault = async () => {
    if (!vaultSecretRef.current) {
      showToast('Ative ou desbloqueie o cofre para exportar um backup cifrado .vault.');
      return;
    }
    try {
      const envelope = await encryptVaultPayload(
        state,
        vaultSecretRef.current,
        vaultRecoveryKeyRef.current ?? undefined
      );
      if (!vaultRecoveryKeyRef.current && lastVaultEnvelopeRef.current?.recoveryWrapped) {
        envelope.recoveryWrapped = lastVaultEnvelopeRef.current.recoveryWrapped;
      }
      const dataIso = getLocalDateKey();
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fintrack_vault_${dataIso}.vault`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Backup cifrado .vault exportado.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao exportar backup .vault.');
    }
  };

  const handleImportVault = async (
    file: File,
    secret: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const rawText = await file.text();
      const parsed = safeJsonParse(rawText);
      if (!isEncryptedVaultEnvelope(parsed)) {
        return { ok: false, error: 'O arquivo selecionado não é um envelope .vault válido (v4.0 ou v3.4).' };
      }
      const decrypted = await decryptVaultPayload<unknown>(parsed, secret);
      const normalized = normalizeState(decrypted);
      const snapshot = structuredClone(state);
      setState(normalized);
      setStorageWarning(null);
      showToast('Backup cifrado .vault importado e decifrado com sucesso!', () => {
        setState(snapshot);
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Falha ao decifrar arquivo .vault.',
      };
    }
  };

  const handleExportJSON = () => {
    const dataIso = getLocalDateKey();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintrack_backup_${dataIso}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup JSON exportado.');
  };

  const handleExportCSV = () => {
    const comp = state.competenciaAtual;
    const list = state.despesasPorMes[comp] || [];
    let csv = '\uFEFFDescrição;Categoria;Valor;Vencimento;Status\n';
    list.forEach((d) => {
      const row = [
        sanitizeCsvCell(d.descricao),
        sanitizeCsvCell(d.categoria),
        sanitizeCsvCell(d.valor.toFixed(2).replace('.', ',')),
        sanitizeCsvCell(`Dia ${d.diaVencimento}`),
        sanitizeCsvCell(d.paga ? 'Paga' : 'Pendente'),
      ].join(';');
      csv += `${row}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintrack_despesas_${comp}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Planilha CSV exportada com proteção anti-injeção.');
  };

  const navItems = [
    { id: 'visao-geral', label: 'Visão Geral' },
    { id: 'bancos', label: 'Bancos & Saldos' },
    { id: 'caixinhas', label: 'Caixinhas & FIRE' },
    { id: 'contracheque', label: 'Contracheque' },
    { id: 'cartoes', label: 'Cartões' },
    { id: 'despesas', label: 'Despesas' },
  ];

  const handleTabKeyDown = (
    e: React.KeyboardEvent,
    idx: number,
    refs: React.MutableRefObject<(HTMLButtonElement | null)[]>
  ) => {
    let targetIdx = idx;
    if (e.key === 'ArrowRight') {
      targetIdx = (idx + 1) % navItems.length;
    } else if (e.key === 'ArrowLeft') {
      targetIdx = (idx - 1 + navItems.length) % navItems.length;
    } else if (e.key === 'Home') {
      targetIdx = 0;
    } else if (e.key === 'End') {
      targetIdx = navItems.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setActiveTab(navItems[targetIdx].id);
    refs.current[targetIdx]?.focus();
  };

  if (isVaultLocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
        <main
          role="main"
          aria-labelledby="vault-lock-title"
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Lock className="w-6 h-6" aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-pressed={darkMode}
              aria-label="Alternar tema claro ou escuro"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-1.5">
            <h1 id="vault-lock-title" className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Cofre Zero-Knowledge Trancado
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Seus dados financeiros estão cifrados localmente com AES-256-GCM (PBKDF2-SHA256). Digite sua Senha Mestra ou Recovery Key para desbloquear.
            </p>
          </div>

          <form onSubmit={handleUnlockVault} className="space-y-4">
            <div>
              <label htmlFor="vault-unlock-secret" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Senha Mestra ou Recovery Key
              </label>
              <div className="relative">
                <input
                  id="vault-unlock-secret"
                  type={unlockShowSecret ? 'text' : 'password'}
                  autoFocus
                  required
                  disabled={unlockBusy}
                  value={unlockSecret}
                  onChange={(e) => setUnlockSecret(e.target.value)}
                  placeholder="Digite sua senha ou XXXX-XXXX-..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-3.5 pr-12 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => setUnlockShowSecret((v) => !v)}
                  aria-label={unlockShowSecret ? 'Ocultar credencial' : 'Mostrar credencial'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  {unlockShowSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {unlockError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                {unlockError}
              </div>
            )}

            <button
              type="submit"
              disabled={unlockBusy}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {unlockBusy ? 'Decifrando cofre...' : 'Desbloquear Cofre'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-emerald-700 focus:text-white focus:text-xs focus:font-semibold focus:shadow-lg"
      >
        Pular para o conteúdo principal
      </a>
      {/* TOP BAR CONTRACT: 3 ZONES (Brand — Primary Nav Links — 1 Primary Action) */}
      <header className="sticky top-0 z-30 apple-glass-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 md:gap-8">
          {/* Zone 1: Single text wordmark */}
          <a
            href="#visao-geral"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('visao-geral');
            }}
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            FinTrack
          </a>

          {/* Zone 2: Primary Navigation Links (Desktop) */}
          <nav
            role="tablist"
            aria-label="Navegação principal"
            aria-orientation="horizontal"
            className="hidden md:flex items-center gap-6 py-1"
          >
            {navItems.map((item, idx) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    desktopTabRefs.current[idx] = el;
                  }}
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={active}
                  aria-controls={`tabpanel-${item.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveTab(item.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx, desktopTabRefs)}
                  className={`relative text-sm font-semibold whitespace-nowrap shrink-0 pb-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="desktop-tab-indicator"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0.1 }
                          : { type: 'spring', bounce: 0, duration: 0.35 }
                      }
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              onClick={() => setActiveModal('newExpense')}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Gasto</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE VIEWPORT */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {storageWarning && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3"
          >
            <span>
              {storageWarning === 'vault_locked'
                ? 'Cofre criptografado da versão v3.4 detectado no armazenamento local. Seus dados antigos permanecem protegidos e não foram sobrescritos.'
                : 'Foram detectados dados corrompidos no armazenamento local. Uma cópia de diagnóstico foi preservada em backup local.'}
            </span>
            <button
              type="button"
              onClick={() => setStorageWarning(null)}
              className="px-2.5 py-1 rounded-md border border-amber-400/60 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer shrink-0"
            >
              Dispensar
            </button>
          </div>
        )}
        {/* Mobile Section Switcher (<768px) */}
        <div
          role="tablist"
          aria-label="Seções do aplicativo (Mobile)"
          aria-orientation="horizontal"
          className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1"
        >
          {navItems.map((item, idx) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  mobileTabRefs.current[idx] = el;
                }}
                role="tab"
                id={`mobile-tab-${item.id}`}
                aria-selected={active}
                aria-controls={`tabpanel-${item.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveTab(item.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx, mobileTabRefs)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-tab-pill"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0.1 }
                        : { type: 'spring', bounce: 0, duration: 0.35 }
                    }
                    className="absolute inset-0 rounded-lg bg-slate-900 dark:bg-white -z-10"
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contextual Workspace Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              id="tab-diagnostico"
              type="button"
              aria-pressed={activeTab === 'diagnostico'}
              onClick={() => setActiveTab(activeTab === 'diagnostico' ? 'visao-geral' : 'diagnostico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'diagnostico'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-slate-200 dark:border-slate-800 hover:bg-emerald-50/50'
              }`}
            >
              <ClipboardCheck
                className={`w-3.5 h-3.5 ${
                  activeTab === 'diagnostico' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
              <span>
                {activeTab === 'diagnostico'
                  ? 'Voltar ao Painel Financeiro'
                  : 'Diagnóstico & Auditoria do App'}
              </span>
            </button>

            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline">
              Competência: <strong className="text-slate-800 dark:text-slate-200">{formatMonthYear(state.competenciaAtual)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveModal('cmdk')}
              aria-label="Abrir busca e comandos rápidos (Ctrl+K)"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Lançamento Rápido</span>
              <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                Ctrl K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setPrivacyMode((p) => !p)}
              aria-pressed={privacyMode}
              aria-label={privacyMode ? 'Revelar saldos' : 'Ocultar saldos'}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {privacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{privacyMode ? 'Saldos Ocultos' : 'Ocultar Saldos'}</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-pressed={darkMode}
              aria-label="Alternar tema claro ou escuro"
              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('vaultSecurity')}
              aria-label="Configurar Cofre Zero-Knowledge"
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                vaultActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Cofre</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('backup')}
              aria-label="Backup e Dados"
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup</span>
            </button>
          </div>
        </div>

        <motion.div
          key={activeTab}
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={activeTab === 'diagnostico' ? 'tab-diagnostico' : `tab-${activeTab}`}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.12 }
              : { type: 'spring', bounce: 0, duration: 0.32 }
          }
        >
        {activeTab === 'diagnostico' && (
          <Suspense
            fallback={
              <div
                role="status"
                aria-live="polite"
                className="p-12 text-center text-xs text-slate-500 dark:text-slate-400"
              >
                Carregando diagnóstico do sistema...
              </div>
            }
          >
            <AuditDiagnosticView state={state} onNavigate={(tab) => setActiveTab(tab)} />
          </Suspense>
        )}

        {activeTab === 'visao-geral' && (
          <OverviewTab
            state={state}
            daysUntilNextPayday={paydayInfo.daysRemaining}
            nextPaydayFormatted={paydayInfo.formattedDate}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenPaydayModal={() => setActiveModal('paydayConfig')}
            onOpenAporteModal={(cxId) => {
              setSelectedId(cxId);
              setActiveModal('aporteGoal');
            }}
          />
        )}

        {activeTab === 'bancos' && (
          <BanksTab
            state={state}
            onOpenNewBank={() => setActiveModal('newBank')}
            onOpenPixTransfer={() => setActiveModal('pixTransfer')}
            onAdjustBankBalance={handleAdjustBankBalance}
            onUpdateBank={handleUpdateBank}
            onDeleteBank={handleDeleteBank}
            onUpdateCdiRate={(newRate) =>
              setState((prev) => ({
                ...prev,
                configuracoes: { ...prev.configuracoes, taxaCdiAnual: newRate },
              }))
            }
          />
        )}

        {activeTab === 'caixinhas' && (
          <GoalsTab
            state={state}
            onOpenNewGoal={() => setActiveModal('newGoal')}
            onOpenFireModal={() => setActiveModal('fireConfig')}
            onOpenAporteModal={(cxId) => {
              setSelectedId(cxId);
              setActiveModal('aporteGoal');
            }}
            onOpenWithdrawModal={(cxId) => {
              setSelectedId(cxId);
              setActiveModal('withdrawGoal');
            }}
            onUpdateGoal={handleUpdateGoal}
            onDeleteGoal={handleDeleteGoal}
            onUpdateFireParams={(swrPct, realReturnPct) =>
              setState((prev) => ({
                ...prev,
                configuracoes: {
                  ...prev.configuracoes,
                  swrAnualPct: swrPct,
                  jurosReaisAnualPct: realReturnPct,
                },
              }))
            }
          />
        )}

        {activeTab === 'contracheque' && (
          <PayrollTab
            state={state}
            onAddProvento={handleAddProvento}
            onUpdateProvento={handleUpdateProvento}
            onRemoveProvento={handleRemoveProvento}
            onAddDesconto={handleAddDesconto}
            onUpdateDesconto={handleUpdateDesconto}
            onRemoveDesconto={handleRemoveDesconto}
            onApplyOfficialTaxes={handleApplyOfficialTaxes}
            onOpenReceiveSalaryModal={() => setActiveModal('receiveSalary')}
            onSavePayrollToHistory={() => {
              const comp = state.competenciaAtual;
              const entry = {
                id: genId(`hc_${comp.replace('-', '_')}`),
                competencia: comp,
                mesLabel: formatMonthYear(comp),
                proventos: structuredClone(state.salario.proventos),
                descontos: structuredClone(state.salario.descontos),
                bruto: state.salario.bruto,
                descontosTotal: state.salario.descontosTotal,
                liquido: state.salario.liquido,
              };
              setState((prev) => ({
                ...prev,
                historicoContracheques: [
                  entry,
                  ...prev.historicoContracheques.filter((h) => h.competencia !== comp),
                ],
              }));
              showToast(`Contracheque de ${formatMonthYear(comp)} salvo no histórico.`);
            }}
            onLoadHistoryPayroll={(id) => {
              const found = state.historicoContracheques.find((h) => h.id === id);
              if (!found) return;
              const p = found.proventos.map((x) => ({
                id: x.id || genId('p'),
                nome: x.nome,
                valor: x.valor,
              }));
              const d = found.descontos.map((x) => ({
                id: x.id || genId('d'),
                nome: x.nome,
                valor: x.valor,
              }));
              setState((prev) => ({
                ...prev,
                salario: recalcPayroll(p, d),
              }));
              showToast(`Folha de ${found.mesLabel} carregada no painel atual.`);
            }}
            onDeleteHistoryPayroll={(id) => {
              const snapshotHistorico = structuredClone(state.historicoContracheques);
              setState((prev) => ({
                ...prev,
                historicoContracheques: prev.historicoContracheques.filter((h) => h.id !== id),
              }));
              showToast('Folha removida do histórico.', () => {
                setState((prev) => ({ ...prev, historicoContracheques: snapshotHistorico }));
              });
            }}
          />
        )}

        {activeTab === 'cartoes' && (
          <CardsTab
            state={state}
            onOpenNewCard={() => setActiveModal('newCard')}
            onUpdateCard={handleUpdateCard}
            onRequestEditCardInvoice={(cardId, cardNome, currentInvoice) => {
              openQuickEdit(
                `Fatura Aberta — ${cardNome}`,
                'Atualize o valor acumulado da fatura deste cartão no mês.',
                currentInvoice,
                (newInvoice) => {
                  setState((prev) => ({
                    ...prev,
                    cartoes: prev.cartoes.map((c) =>
                      c.id === cardId ? { ...c, faturaAtual: newInvoice } : c
                    ),
                  }));
                  showToast(`Fatura de "${cardNome}" atualizada para ${fmtBRL(newInvoice)}.`);
                }
              );
            }}
            onDeleteCard={(cardId) => {
              const snapshotCartoes = structuredClone(state.cartoes);
              setState((prev) => ({
                ...prev,
                cartoes: prev.cartoes.filter((c) => c.id !== cardId),
              }));
              showToast('Cartão removido.', () => {
                setState((prev) => ({ ...prev, cartoes: snapshotCartoes }));
              });
            }}
          />
        )}

        {activeTab === 'despesas' && (
          <ExpensesTab
            state={state}
            onChangeMonth={(delta) => {
              const [yStr, mStr] = state.competenciaAtual.split('-');
              let y = parseInt(yStr, 10);
              let m = parseInt(mStr, 10) + delta;
              while (m > 12) {
                m -= 12;
                y += 1;
              }
              while (m < 1) {
                m += 12;
                y -= 1;
              }
              const nextComp = `${y}-${String(m).padStart(2, '0')}`;
              setState((prev) => ({ ...prev, competenciaAtual: nextComp }));
            }}
            onGoToCurrentMonth={() => {
              setState((prev) => ({ ...prev, competenciaAtual: getLocalMonthKey() }));
            }}
            onOpenNewExpenseModal={() => setActiveModal('newExpense')}
            onOpenTemplateModal={() => setActiveModal('templateModal')}
            onOpenPayExpenseModal={(expId) => {
              setSelectedId(expId);
              setActiveModal('payExpense');
            }}
            onRefundExpense={handleRefundExpense}
            onEditExpenseAmount={handleEditExpenseAmount}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onAddExtraIncome={handleAddExtraIncome}
            onToggleExtraIncome={handleToggleExtraIncome}
            onDeleteExtraIncome={handleDeleteExtraIncome}
            onSyncTemplateToMonth={() => {
              const comp = state.competenciaAtual;
              const currentList = state.despesasPorMes[comp] || [];
              const { list, addedCount } = syncTemplatesToMonth(
                comp,
                currentList,
                state.despesasFixasMolde || []
              );
              setState((prev) => ({
                ...prev,
                despesasPorMes: {
                  ...prev.despesasPorMes,
                  [comp]: list,
                },
              }));
              showToast(`${addedCount} contas recorrentes importadas para ${formatMonthYear(comp)}.`);
            }}
            onRequestEditEnvelope={(key, title, currentTotal) => {
              openQuickEdit(
                `Teto do Envelope — ${title}`,
                'Defina a meta mensal planejada para os gastos desta categoria.',
                currentTotal,
                (newTotal) => {
                  const clampedTotal = Math.max(10, newTotal);
                  setState((prev) => ({
                    ...prev,
                    envelopes: {
                      ...prev.envelopes,
                      [key]: {
                        total: clampedTotal,
                        cadencia: prev.envelopes[key]?.cadencia || 'semanal',
                      },
                    },
                  }));
                  showToast(`Teto de "${title}" atualizado para ${fmtBRL(clampedTotal)}.`);
                }
              );
            }}
            onUpdateEnvelope={(key, total, cadencia) => {
              setState((prev) => ({
                ...prev,
                envelopes: {
                  ...prev.envelopes,
                  [key]: { total, cadencia },
                },
              }));
            }}
            onAddDebt={(debt: Omit<DebtItem, 'id'>) => {
              setState((prev) => ({
                ...prev,
                dividas: [...(prev.dividas || []), { ...debt, id: genId('div') }],
              }));
              showToast(`Dívida "${debt.nome}" adicionada ao planejador.`);
            }}
            onDeleteDebt={(id) => {
              const snapshotDividas = structuredClone(state.dividas || []);
              setState((prev) => ({
                ...prev,
                dividas: (prev.dividas || []).filter((d) => d.id !== id),
              }));
              showToast('Dívida removida.', () => {
                setState((prev) => ({ ...prev, dividas: snapshotDividas }));
              });
            }}
          />
        )}
        </motion.div>
      </main>

      {/* MODALS */}
      <AppModals
        activeModal={activeModal}
        selectedId={selectedId}
        state={state}
        privacyMode={privacyMode}
        quickEditConfig={quickEditConfig}
        onClose={() => {
          setActiveModal(null);
          setQuickEditConfig(null);
        }}
        onNavigate={(tab) => setActiveTab(tab)}
        onSaveBank={handleSaveBank}
        onExecutePix={handleExecutePix}
        onSaveGoal={handleSaveGoal}
        onSaveFireGoal={handleSaveFireGoal}
        onExecuteGoalTransfer={handleExecuteGoalTransfer}
        onSaveCard={(nome, diaCorte, diaVencimento, beneficio, limiteTotal, faturaAtual) => {
          setState((prev) => ({
            ...prev,
            cartoes: [
              ...prev.cartoes,
              {
                id: genId('c'),
                nome,
                diaCorte,
                diaVencimento,
                beneficio,
                limiteTotal: Math.max(0, limiteTotal),
                faturaAtual: Math.max(0, faturaAtual),
              },
            ],
          }));
          showToast(`Cartão "${nome}" adicionado.`);
        }}
        onSaveNewExpense={handleSaveNewExpense}
        onConfirmPayExpense={handleConfirmPayExpense}
        onAddTemplateItem={(descricao, valorPadrao, diaVencimento, categoria) => {
          const safeValor = Math.max(0, valorPadrao);
          const newTpl = {
            id: genId('m'),
            descricao,
            valorPadrao: safeValor,
            diaVencimento,
            categoria,
            ativa: true,
          };
          const comp = state.competenciaAtual;
          setState((prev) => ({
            ...prev,
            despesasFixasMolde: [...prev.despesasFixasMolde, newTpl],
            despesasPorMes: {
              ...prev.despesasPorMes,
              [comp]: [
                ...(prev.despesasPorMes[comp] || []),
                {
                  id: genId('d'),
                  moldeId: newTpl.id,
                  descricao,
                  valor: safeValor,
                  diaVencimento,
                  categoria,
                  paga: false,
                  dataPagamento: null,
                  contaOrigem: null,
                },
              ],
            },
          }));
          showToast(`"${descricao}" adicionada ao molde recorrente.`);
        }}
        onToggleTemplateItem={(id) => {
          setState((prev) => ({
            ...prev,
            despesasFixasMolde: prev.despesasFixasMolde.map((m) =>
              m.id === id ? { ...m, ativa: !m.ativa } : m
            ),
          }));
        }}
        onDeleteTemplateItem={(id) => {
          const snapshotMolde = structuredClone(state.despesasFixasMolde);
          setState((prev) => ({
            ...prev,
            despesasFixasMolde: prev.despesasFixasMolde.filter((m) => m.id !== id),
          }));
          showToast('Item removido do molde recorrente.', () => {
            setState((prev) => ({ ...prev, despesasFixasMolde: snapshotMolde }));
          });
        }}
        onConfirmReceiveSalary={handleConfirmReceiveSalary}
        onSavePaydayConfig={(tipo, diaFixo, dataExata) => {
          setState((prev) => ({
            ...prev,
            configPagamento: { tipo, diaFixo, dataExata },
          }));
          showToast('Regra da data de pagamento atualizada.');
        }}
        onExportJSON={handleExportJSON}
        onExportCSV={handleExportCSV}
        onImportJSON={(file) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const rawText = String(ev.target?.result || '');
            const result = validateImportJson(rawText);
            if (result.ok === false) {
              showToast(
                `Não foi possível importar o backup. Motivo: ${result.error} Selecione um arquivo JSON exportado pelo FinTrack.`
              );
              return;
            }
            const snapshot = structuredClone(state);
            setState(result.state);
            setStorageWarning(null);
            showToast('Backup restaurado com sucesso!', () => {
              setState(snapshot);
            });
          };
          reader.onerror = () => {
            showToast('Não foi possível ler o arquivo selecionado. Verifique as permissões de leitura e tente novamente.');
          };
          reader.readAsText(file);
        }}
        onResetFactory={() => {
          const snapshot = structuredClone(state);
          const fresh = structuredClone(DEFAULT_STATE);
          setState(fresh);
          setStorageWarning(null);
          showToast('Todos os dados foram zerados.', () => {
            setState(snapshot);
          });
        }}
        vaultActive={vaultActive}
        vaultConfig={vaultConfig}
        lastGeneratedRecoveryKey={lastGeneratedRecoveryKey}
        onActivateVault={handleActivateVault}
        onDeactivateVault={handleDeactivateVault}
        onUpdateVaultAutoLock={handleUpdateVaultAutoLock}
        onLockVaultNow={lockVaultNow}
        onExportVault={handleExportVault}
        onImportVault={handleImportVault}
      />

      {/* TOAST NOTIFICATION COM BOTÃO DESFAZER (UNDO) — REGIÃO ARIA-LIVE SEMPRE MONTADA */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-50 pointer-events-none max-w-md"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.message}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0.12 }
                  : { type: 'spring', bounce: 0.15, duration: 0.35 }
              }
              className="pointer-events-auto bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 text-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1">{privacyMode ? maskMonetaryText(toast.message) : toast.message}</span>
              {toast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onUndo?.();
                    setToast(null);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer shrink-0"
                >
                  Desfazer
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
