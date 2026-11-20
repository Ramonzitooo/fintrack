import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AppState,
  DEFAULT_STATE,
  fmtBRL,
  formatMonthYear,
  loadAppState,
  normalizeState,
  safeJsonParse,
  sanitizeCsvCell,
  saveAppState,
} from './utils/storage';
import {
  addMoney,
  applyExpensePaymentToAccount,
  DebtItem,
  deleteExpenseFromList,
  editExpenseAmountInList,
  executeGoalTransfer,
  ExpenseItem,
  getNextPaydayInfo,
  payExpenseInList,
  receiveSalary,
  refundExpenseInList,
  refundExpensePaymentToAccount,
  subMoney,
  sumMoney,
  syncTemplatesToMonth,
} from './utils/financeMath';
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
} from 'lucide-react';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<string>('visao-geral');
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickEditConfig, setQuickEditConfig] = useState<QuickEditConfig | null>(null);
  const [privacyMode, setPrivacyMode] = useState<boolean>(() => localStorage.getItem('FINTRACK_PRIVACIDADE') === '1');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('FINTRACK_M3_THEME');
    if (saved) return saved === 'dark';
    return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  });
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const desktopTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mobileTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Sync state to localStorage and ensure active month expenses exist
  useEffect(() => {
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
    saveAppState(state);
  }, [state]);

  // Sync privacy and dark classes
  useEffect(() => {
    document.body.classList.toggle('privacy-mode', privacyMode);
    localStorage.setItem('FINTRACK_PRIVACIDADE', privacyMode ? '1' : '0');
  }, [privacyMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('FINTRACK_M3_THEME', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    setToast({ message, onUndo });
  }, []);

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
        if (e.key === 'Escape') setActiveModal(null);
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
        { id: `b_${Date.now()}`, nome, tipo, saldo, rendeJuros, pctCDI },
      ],
    }));
    showToast(`Conta "${nome}" adicionada com sucesso.`);
  };

  const handleExecutePix = (origId: string, destId: string, valor: number) => {
    if (origId === destId || valor <= 0) return;
    setState((prev) => ({
      ...prev,
      bancos: prev.bancos.map((b) => {
        if (b.id === origId) return { ...b, saldo: subMoney(b.saldo, valor) };
        if (b.id === destId) return { ...b, saldo: addMoney(b.saldo, valor) };
        return b;
      }),
    }));
    showToast(`Transferência Pix de ${fmtBRL(valor)} concluída.`);
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
        { id: `cx_${Date.now()}`, nome, tipo, saldo, aporteMensal, meta, instituicao, pctCDI: 100 },
      ],
    }));
    showToast(`Caixinha "${nome}" criada.`);
  };

  const handleSaveFireGoal = (nome: string, saldo: number, aporteMensal: number, instituicao: string) => {
    setState((prev) => {
      const exists = prev.caixinhas.some((c) => c.tipo === 'aposentadoria');
      const caixinhas = exists
        ? prev.caixinhas.map((c) =>
            c.tipo === 'aposentadoria' ? { ...c, nome, saldo, aporteMensal, instituicao } : c
          )
        : [
            ...prev.caixinhas,
            {
              id: `cx_fire_${Date.now()}`,
              nome,
              saldo,
              aporteMensal,
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
    const res = executeGoalTransfer(state.bancos, state.caixinhas, caixinhaId, bankId, valor, mode);
    if (res.effectiveValor <= 0) return;

    setState((prev) => {
      const next = executeGoalTransfer(prev.bancos, prev.caixinhas, caixinhaId, bankId, valor, mode);
      return { ...prev, bancos: next.bancos, caixinhas: next.caixinhas };
    });
    showToast(
      mode === 'aporte'
        ? `Aporte de ${fmtBRL(res.effectiveValor)} realizado.`
        : `Resgate de ${fmtBRL(res.effectiveValor)} creditado na conta.`
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
      const nextP = [...prev.salario.proventos, { id: `p_${Date.now()}`, nome, valor }];
      return { ...prev, salario: recalcPayroll(nextP, prev.salario.descontos) };
    });
  };

  const handleUpdateProvento = (id: string, field: 'nome' | 'valor', val: string | number) => {
    setState((prev) => {
      const nextP = prev.salario.proventos.map((p) => (p.id === id ? { ...p, [field]: val } : p));
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
      const nextD = [...prev.salario.descontos, { id: `d_${Date.now()}`, nome, valor }];
      return { ...prev, salario: recalcPayroll(prev.salario.proventos, nextD) };
    });
  };

  const handleUpdateDesconto = (id: string, field: 'nome' | 'valor', val: string | number) => {
    setState((prev) => {
      const nextD = prev.salario.descontos.map((d) => (d.id === id ? { ...d, [field]: val } : d));
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
    if (liq <= 0) return;

    setState((prev) => {
      const next = receiveSalary(prev.bancos, prev.caixinhas, liq, bankId, autoAportarCaixinhas);
      return { ...prev, bancos: next.bancos, caixinhas: next.caixinhas };
    });
    showToast(
      `Salário líquido (${fmtBRL(liq)}) creditado${
        autoAportarCaixinhas ? ' e aportes distribuídos nas caixinhas!' : '!'
      }`
    );
  };

  // Despesas handlers (com simetria exata de pagamento e estorno!)
  const handleSaveNewExpense = (
    descricao: string,
    valor: number,
    diaVencimento: number,
    categoria: ExpenseItem['categoria'],
    paga: boolean,
    bankId: string | null
  ) => {
    const comp = state.competenciaAtual;
    const bank = bankId ? state.bancos.find((b) => b.id === bankId) : null;
    const todayIso = new Date().toISOString().slice(0, 10);

    const newExp: ExpenseItem = {
      id: `d_${Date.now()}`,
      moldeId: null,
      descricao,
      valor,
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
              b.id === bankId ? { ...b, saldo: applyExpensePaymentToAccount(b.saldo, valor) } : b
            )
          : prev.bancos,
      despesasPorMes: {
        ...prev.despesasPorMes,
        [comp]: [...(prev.despesasPorMes[comp] || []), newExp],
      },
    }));

    showToast(`Despesa "${descricao}" (${fmtBRL(valor)}) registrada.`, () => {
      setState((prev) => ({
        ...prev,
        bancos:
          paga && bankId
            ? prev.bancos.map((b) =>
                b.id === bankId ? { ...b, saldo: refundExpensePaymentToAccount(b.saldo, valor) } : b
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

    const todayIso = new Date().toISOString().slice(0, 10);
    setState((prev) => {
      const next = payExpenseInList(prev.bancos, prev.despesasPorMes[comp] || [], expenseId, bankId, todayIso);
      return {
        ...prev,
        bancos: next.bancos,
        despesasPorMes: { ...prev.despesasPorMes, [comp]: next.despesas },
      };
    });
    showToast(`"${target.descricao}" marcada como paga.`);
  };

  const handleRefundExpense = (expenseId: string) => {
    const comp = state.competenciaAtual;
    const list = state.despesasPorMes[comp] || [];
    const target = list.find((d) => d.id === expenseId);
    if (!target || !target.paga) return;

    setState((prev) => {
      const next = refundExpenseInList(prev.bancos, prev.despesasPorMes[comp] || [], expenseId);
      return {
        ...prev,
        bancos: next.bancos,
        despesasPorMes: { ...prev.despesasPorMes, [comp]: next.despesas },
      };
    });
    showToast(`Pagamento de "${target.descricao}" desfeito e saldo estornado.`);
  };

  const handleEditExpenseAmount = (expenseId: string) => {
    const comp = state.competenciaAtual;
    const target = (state.despesasPorMes[comp] || []).find((d) => d.id === expenseId);
    if (!target) return;
    openQuickEdit(
      `Ajustar Valor — ${target.descricao}`,
      `Atualize o valor desta conta em ${formatMonthYear(comp)}. Se já estiver paga, o saldo em conta será reconciliado.`,
      target.valor,
      (novoVal) => {
        setState((prev) => {
          const next = editExpenseAmountInList(prev.bancos, prev.despesasPorMes[comp] || [], expenseId, novoVal);
          return {
            ...prev,
            bancos: next.bancos,
            despesasPorMes: { ...prev.despesasPorMes, [comp]: next.despesas },
          };
        });
        showToast(`Valor de "${target.descricao}" atualizado para ${fmtBRL(novoVal)}.`);
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

  const handleExportJSON = () => {
    const dataIso = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintrack_backup_${dataIso}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    URL.revokeObjectURL(url);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
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
              onClick={() => setActiveTab(activeTab === 'diagnostico' ? 'visao-geral' : 'diagnostico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'diagnostico'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-slate-200 dark:border-slate-800 hover:bg-emerald-50/50'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
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
              onClick={() => setActiveModal('cmdk')}
              aria-label="Abrir busca e comandos rápidos (Ctrl+K)"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Lançamento Rápido</span>
              <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                Ctrl K
              </kbd>
            </button>

            <button
              onClick={() => setPrivacyMode((p) => !p)}
              aria-label={privacyMode ? 'Revelar saldos' : 'Ocultar saldos'}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {privacyMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{privacyMode ? 'Saldos Ocultos' : 'Ocultar Saldos'}</span>
            </button>

            <button
              onClick={() => setDarkMode((d) => !d)}
              aria-label="Alternar tema claro ou escuro"
              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setActiveModal('backup')}
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
          aria-labelledby={`tab-${activeTab}`}
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
                id: `hc_${comp.replace('-', '_')}_${Date.now()}`,
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
              const p = found.proventos.map((x, i) => ({
                id: x.id || `p_${Date.now()}_${i}`,
                nome: x.nome,
                valor: x.valor,
              }));
              const d = found.descontos.map((x, i) => ({
                id: x.id || `d_${Date.now()}_${i}`,
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
              setState((prev) => ({
                ...prev,
                historicoContracheques: prev.historicoContracheques.filter((h) => h.id !== id),
              }));
              showToast('Folha removida do histórico.');
            }}
          />
        )}

        {activeTab === 'cartoes' && (
          <CardsTab
            state={state}
            onOpenNewCard={() => setActiveModal('newCard')}
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
              setState((prev) => ({
                ...prev,
                cartoes: prev.cartoes.filter((c) => c.id !== cardId),
              }));
              showToast('Cartão removido.');
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
              const now = new Date();
              const comp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              setState((prev) => ({ ...prev, competenciaAtual: comp }));
            }}
            onOpenNewExpenseModal={() => setActiveModal('newExpense')}
            onOpenTemplateModal={() => setActiveModal('templateModal')}
            onOpenPayExpenseModal={(expId) => {
              setSelectedId(expId);
              setActiveModal('payExpense');
            }}
            onRefundExpense={handleRefundExpense}
            onEditExpenseAmount={handleEditExpenseAmount}
            onDeleteExpense={handleDeleteExpense}
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
                  setState((prev) => ({
                    ...prev,
                    envelopes: {
                      ...prev.envelopes,
                      [key]: {
                        total: Math.max(10, newTotal),
                        cadencia: prev.envelopes[key]?.cadencia || 'semanal',
                      },
                    },
                  }));
                  showToast(`Teto de "${title}" atualizado para ${fmtBRL(newTotal)}.`);
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
                dividas: [...(prev.dividas || []), { ...debt, id: `div_${Date.now()}` }],
              }));
              showToast(`Dívida "${debt.nome}" adicionada ao planejador.`);
            }}
            onDeleteDebt={(id) => {
              setState((prev) => ({
                ...prev,
                dividas: (prev.dividas || []).filter((d) => d.id !== id),
              }));
              showToast('Dívida removida.');
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
                id: `c_${Date.now()}`,
                nome,
                diaCorte,
                diaVencimento,
                beneficio,
                limiteTotal,
                faturaAtual,
              },
            ],
          }));
          showToast(`Cartão "${nome}" adicionado.`);
        }}
        onSaveNewExpense={handleSaveNewExpense}
        onConfirmPayExpense={handleConfirmPayExpense}
        onAddTemplateItem={(descricao, valorPadrao, diaVencimento, categoria) => {
          const newTpl = {
            id: `m_${Date.now()}`,
            descricao,
            valorPadrao,
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
                  id: `d_${Date.now()}`,
                  moldeId: newTpl.id,
                  descricao,
                  valor: valorPadrao,
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
          setState((prev) => ({
            ...prev,
            despesasFixasMolde: prev.despesasFixasMolde.filter((m) => m.id !== id),
          }));
          showToast('Item removido do molde recorrente.');
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
            try {
              const parsed = safeJsonParse(String(ev.target?.result || '{}'));
              const normalized = normalizeState(parsed);
              setState(normalized);
              showToast('Backup restaurado com sucesso!');
            } catch {
              showToast('Erro ao ler arquivo JSON de backup.');
            }
          };
          reader.readAsText(file);
        }}
        onResetFactory={() => {
          const snapshot = structuredClone(state);
          const fresh = structuredClone(DEFAULT_STATE);
          setState(fresh);
          showToast('Dados restaurados para o padrão de fábrica.', () => {
            setState(snapshot);
          });
        }}
      />

      {/* TOAST NOTIFICATION COM BOTÃO DESFAZER (UNDO) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.message}
            role="status"
            aria-live="polite"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.12 }
                : { type: 'spring', bounce: 0.15, duration: 0.35 }
            }
            className="fixed bottom-5 right-5 z-50 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 text-xs max-w-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            {toast.onUndo && (
              <button
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
  );
}
