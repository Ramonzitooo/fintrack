import test from 'node:test';
import assert from 'node:assert/strict';
import {
  annualToMonthlyRate,
  calculateCdiMonthlyYield,
  calculateGoalMonthsCompound,
  calculateFireProjection,
  calculateBudget503020,
  applyExpensePaymentToAccount,
  refundExpensePaymentToAccount,
  simulateCashVsInstallments,
  calculateOfficialPayrollTaxes,
  parseQuickExpenseCommand,
  clampDateToMonth,
  calculateCreditCardGraceDays,
  calcularQuintoDiaUtil,
  getNextPaydayInfo,
  calculateSafeDailyAllowance,
  matchesExpenseOriginBank,
  executeGoalTransfer,
  receiveSalary,
  payExpenseInList,
  refundExpenseInList,
  editExpenseAmountInList,
  deleteExpenseFromList,
  syncTemplatesToMonth,
  projectMomentum,
  rubberbandOffset,
  shouldDismissSheetOnRelease,
  toCents,
  fromCents,
  MAX_SAFE_MONEY,
  MAX_INSTALLMENTS,
  addMoney,
  subMoney,
  sumMoney,
  sumMonthlyExtraIncome,
  generateInstallmentExpenses,
  simulateDebtPayoff,
} from './financeMath.ts';
import {
  MAX_BACKUP_FILE_BYTES,
  MAX_COLLECTION_ITEMS,
  MAX_STRING_LEN,
  sanitizeCsvCell,
  safeJsonParse,
  normalizeState,
  validateImportJson,
} from './storage.ts';

test('annualToMonthlyRate uses exact compound equivalence instead of linear division by 12', () => {
  // 12% a.a. em juros compostos equivale a ~0.94888% a.m., nunca 1.00% a.m.
  const monthlyRate = annualToMonthlyRate(12);
  assert.ok(monthlyRate > 0.00948 && monthlyRate < 0.00949);
  // (1 + monthlyRate)^12 deve recompor exatamente 1.12
  const recomposedAnnual = Math.pow(1 + monthlyRate, 12) - 1;
  assert.ok(Math.abs(recomposedAnnual - 0.12) < 1e-9);
});

test('applyExpensePaymentToAccount and refundExpensePaymentToAccount preserve exact symmetry even when overdrawn', () => {
  const initialBalance = 100;
  const expenseValue = 150;
  const afterPayment = applyExpensePaymentToAccount(initialBalance, expenseValue);
  assert.equal(afterPayment, -50);
  const afterRefund = refundExpensePaymentToAccount(afterPayment, expenseValue);
  assert.equal(afterRefund, initialBalance);
});

test('calculateGoalMonthsCompound accelerates goal completion when compound interest is applied', () => {
  const result = calculateGoalMonthsCompound(3000, 15000, 1000, 0.008);
  assert.equal(result.monthsLinear, 12);
  assert.ok(result.monthsCompound <= 12);
  assert.ok(result.totalInterestEarned > 0);
});

test('calculateFireProjection computes consistent target patrimony and safe withdrawal income', () => {
  // Custo mensal R$ 3.000 -> R$ 36.000/ano -> Com SWR de 4% a.a., meta FIRE = R$ 900.000
  const fire = calculateFireProjection(90000, 1500, 3000, 4.0, 5.0);
  assert.equal(fire.targetPatrimony, 900000);
  assert.equal(fire.currentSafeMonthlyIncome, 300);
  assert.equal(fire.progressPct, 10);
  assert.ok(fire.yearsToFire !== null && fire.yearsToFire > 0);
});

test('calculateBudget503020 separates essentials (50%), lifestyle (30%), and investments (20%) accurately', () => {
  const netIncome = 4000;
  const expenses = [
    {
      id: '1',
      moldeId: null,
      descricao: 'Aluguel',
      valor: 1500,
      diaVencimento: 10,
      paga: true,
      categoria: 'Moradia' as const,
      dataPagamento: null,
      contaOrigem: null,
    },
    {
      id: '2',
      moldeId: null,
      descricao: 'Restaurante Fim de Semana',
      valor: 500,
      diaVencimento: 15,
      paga: false,
      categoria: 'Lazer' as const,
      dataPagamento: null,
      contaOrigem: null,
    },
  ];
  const res = calculateBudget503020(netIncome, expenses, 800);
  assert.equal(res.essentialsTotal, 1500);
  assert.equal(res.essentialsPct, 37.5);
  assert.equal(res.lifestyleTotal, 500);
  assert.equal(res.lifestylePct, 12.5);
  assert.equal(res.investmentsTotal, 800);
  assert.equal(res.investmentsPct, 20);
  assert.equal(res.unallocatedMargin, 1200);
});

test('simulateCashVsInstallments identifies when parceling in CDI beats a small cash discount', () => {
  // R$ 1.200 em 10x sem juros com 2% de desconto à vista e CDI líquido de 0.85% a.m. -> Parcelar vence
  const simParcelar = simulateCashVsInstallments(1200, 2, 10, 0.85);
  assert.equal(simParcelar.verdict, 'PARCELAR');
  assert.ok(simParcelar.netAdvantageForInstallments > 0);

  // Com 10% de desconto à vista -> Pagar à vista vence
  const simAVista = simulateCashVsInstallments(1200, 10, 10, 0.85);
  assert.equal(simAVista.verdict, 'A_VISTA');
});

test('calculateOfficialPayrollTaxes computes 2026 INSS and IRRF (Lei 15.270/2025) accurately', () => {
  // R$ 5.000,00: INSS 2026 = 501.51; IRRF base = 312.89; Redutor Lei 15.270/2025 = 312.89 -> IRRF = 0
  const at5k = calculateOfficialPayrollTaxes(5000, 0);
  assert.equal(at5k.inss, 501.51);
  assert.equal(at5k.irrf, 0);
  assert.equal(at5k.estimatedNetSalary, 4498.49);

  // Teto INSS 2026 (>= R$ 8.475,55) = R$ 988,09
  const atCeiling = calculateOfficialPayrollTaxes(10000, 0);
  assert.equal(atCeiling.inss, 988.09);
  assert.ok(atCeiling.irrf > 0);
  assert.equal(atCeiling.estimatedNetSalary, Math.round((10000 - atCeiling.inss - atCeiling.irrf) * 100) / 100);

  // Faixa isenta (<= R$ 2.428,80)
  const exempt = calculateOfficialPayrollTaxes(2000, 0);
  assert.equal(exempt.irrf, 0);
  assert.ok(exempt.inss > 0);

  // Redutor parcial entre R$ 5.000,01 e R$ 7.350,00 + efeito de dependentes
  const at6kNoDep = calculateOfficialPayrollTaxes(6000, 0);
  const at8kNoDep = calculateOfficialPayrollTaxes(8000, 0);
  const at8kTwoDeps = calculateOfficialPayrollTaxes(8000, 2);
  assert.ok(at6kNoDep.irrf > 0);
  assert.ok(at8kTwoDeps.irrf < at8kNoDep.irrf);

  // Entradas inválidas ou <= 0
  assert.deepEqual(calculateOfficialPayrollTaxes(0, 0), {
    inss: 0,
    irrf: 0,
    effectiveTaxRatePct: 0,
    estimatedNetSalary: 0,
  });
  assert.deepEqual(calculateOfficialPayrollTaxes(-1500, 1), {
    inss: 0,
    irrf: 0,
    effectiveTaxRatePct: 0,
    estimatedNetSalary: 0,
  });
  assert.deepEqual(calculateOfficialPayrollTaxes(NaN, 0), {
    inss: 0,
    irrf: 0,
    effectiveTaxRatePct: 0,
    estimatedNetSalary: 0,
  });
});

test('parseQuickExpenseCommand parses natural language, BR thousands, multi-number strings, and new categories', () => {
  const parsed = parseQuickExpenseCommand('Almoço executivo 45,90 pix');
  assert.ok(parsed !== null);
  assert.equal(parsed?.valor, 45.9);
  assert.equal(parsed?.categoria, 'Alimentação');
  assert.equal(parsed?.formaPagamento, 'Pix');

  const rent = parseQuickExpenseCommand('Aluguel 1.500,00 pix');
  assert.ok(rent !== null);
  assert.equal(rent?.valor, 1500);
  assert.equal(rent?.categoria, 'Moradia');
  assert.equal(rent?.formaPagamento, 'Pix');

  const ride99 = parseQuickExpenseCommand('99 25,50 pix');
  assert.ok(ride99 !== null);
  assert.equal(ride99?.valor, 25.5);
  assert.equal(ride99?.descricao, '99');
  assert.equal(ride99?.categoria, 'Transporte');
  assert.equal(ride99?.formaPagamento, 'Pix');

  const edu = parseQuickExpenseCommand('Curso TypeScript 120,00 cartão');
  assert.equal(edu?.categoria, 'Educação');

  const unexp = parseQuickExpenseCommand('Conserto pneu 180,00 dinheiro');
  assert.equal(unexp?.categoria, 'Imprevisto');
});

test('normalizeState preserves configPagamento from valid input', () => {
  const norm = normalizeState({ configPagamento: { tipo: 'diaFixo', diaFixo: 15, dataExata: null } });
  assert.equal(norm.configPagamento.tipo, 'diaFixo');
  assert.equal(norm.configPagamento.diaFixo, 15);
});

test('calculateCreditCardGraceDays handles purchases before and on/after closing day and cross-month due dates', () => {
  // Compra dia 09/05, fecha dia 10, vence dia 17 -> vence em 17/05 (8 dias)
  const beforeClose = calculateCreditCardGraceDays(10, 17, new Date(2026, 4, 9));
  assert.equal(beforeClose.daysToPay, 8);
  assert.equal(beforeClose.statusLabel, 'Fatura Quase Fechando');

  // Compra exatamente no dia do corte 10/05, fecha dia 10, vence dia 17 -> cai na fatura de 10/06, vence 17/06 (38 dias)
  const onCloseDay = calculateCreditCardGraceDays(10, 17, new Date(2026, 4, 10));
  assert.equal(onCloseDay.daysToPay, 38);
  assert.equal(onCloseDay.statusLabel, 'Melhor Janela');

  // Cartão que fecha dia 25 e vence dia 05 do mês seguinte: compra em 20/05 -> fecha 25/05, vence 05/06 (16 dias)
  const crossMonthDue = calculateCreditCardGraceDays(25, 5, new Date(2026, 4, 20));
  assert.equal(crossMonthDue.daysToPay, 16);
  assert.equal(crossMonthDue.statusLabel, 'Prazo Médio');
});

test('calcularQuintoDiaUtil skips weekends and national holidays (e.g. May 2026 starts on May 1 holiday)', () => {
  // Maio de 2026 (mês 4 em JS):
  // 01/05 Sex (Feriado 4-1), 02/05 Sáb, 03/05 Dom,
  // 04/05 Seg (1º), 05/05 Ter (2º), 06/05 Qua (3º), 07/05 Qui (4º), 08/05 Sex (5º dia útil)
  const fifthBusinessDay = calcularQuintoDiaUtil(2026, 4);
  assert.equal(fifthBusinessDay.getFullYear(), 2026);
  assert.equal(fifthBusinessDay.getMonth(), 4);
  assert.equal(fifthBusinessDay.getDate(), 8);

  const paydayInfo = getNextPaydayInfo(
    { tipo: 'quintoDiaUtil', diaFixo: 5, dataExata: null },
    new Date(2026, 4, 3)
  );
  assert.equal(paydayInfo.daysRemaining, 5);
  assert.equal(paydayInfo.formattedDate, '08/05/2026');
});

test('executeGoalTransfer caps withdrawals at available caixinha balance (makes illegal phantom money impossible)', () => {
  const bancos = [{ id: 'b1', nome: 'Nubank', tipo: 'Conta Digital' as const, saldo: 1000, rendeJuros: true, pctCDI: 100 }];
  const caixinhas = [{ id: 'cx1', nome: 'Reserva', saldo: 600, aporteMensal: 200, meta: 5000, tipo: 'emergencia' as const, instituicao: 'Nubank' }];

  // Tentativa de resgatar R$ 1.000 de uma caixinha que só tem R$ 600:
  const res = executeGoalTransfer(bancos, caixinhas, 'cx1', 'b1', 1000, 'withdraw');
  assert.equal(res.effectiveValor, 600);
  assert.equal(res.caixinhas[0].saldo, 0);
  assert.equal(res.bancos[0].saldo, 1600); // 1000 + 600 (nunca 2000!)
});

test('receiveSalary credits net salary and distributes planned caixinha contributions atomically', () => {
  const bancos = [{ id: 'b1', nome: 'Nubank', tipo: 'Conta Digital' as const, saldo: 500, rendeJuros: true, pctCDI: 100 }];
  const caixinhas = [
    { id: 'cx1', nome: 'Reserva', saldo: 1000, aporteMensal: 300, meta: 5000, tipo: 'emergencia' as const, instituicao: 'Nubank' },
    { id: 'cx2', nome: 'FIRE', saldo: 2000, aporteMensal: 200, meta: 0, tipo: 'aposentadoria' as const, instituicao: 'XP' },
  ];

  const after = receiveSalary(bancos, caixinhas, 4000, 'b1', true);
  // 500 + 4000 - (300 + 200) = 4000 no banco; caixinhas sobem para 1300 e 2200
  assert.equal(after.bancos[0].saldo, 4000);
  assert.equal(after.caixinhas[0].saldo, 1300);
  assert.equal(after.caixinhas[1].saldo, 2200);
});

test('payExpenseInList, editExpenseAmountInList, refundExpenseInList, and deleteExpenseFromList preserve total wealth invariant', () => {
  let bancos: any[] = [{ id: 'b1', nome: 'Nubank', tipo: 'Conta Digital' as const, saldo: 1000, rendeJuros: true, pctCDI: 100 }];
  let despesas: any[] = [
    {
      id: 'd1',
      moldeId: null,
      descricao: 'Conta de Luz',
      valor: 200,
      diaVencimento: 15,
      paga: false,
      categoria: 'Utilidades' as const,
      dataPagamento: null,
      contaOrigem: null,
      contaOrigemId: null,
    },
  ];

  // 1. Pagar R$ 200 -> banco cai para R$ 800
  const paid = payExpenseInList(bancos, despesas, 'd1', 'b1', '2026-05-10');
  bancos = paid.bancos;
  despesas = paid.despesas;
  assert.equal(bancos[0].saldo, 800);
  assert.equal(despesas[0].paga, true);
  assert.equal(despesas[0].contaOrigemId, 'b1');

  // 2. Editar valor da despesa JÁ PAGA de R$ 200 para R$ 250 -> banco deve cair mais R$ 50 (para R$ 750)
  const edited = editExpenseAmountInList(bancos, despesas, 'd1', 250);
  bancos = edited.bancos;
  despesas = edited.despesas;
  assert.equal(despesas[0].valor, 250);
  assert.equal(bancos[0].saldo, 750);

  // 3. Estornar despesa paga de R$ 250 -> banco volta exatamente aos R$ 1.000 iniciais!
  const refunded = refundExpenseInList(bancos, despesas, 'd1');
  assert.equal(refunded.bancos[0].saldo, 1000);
  assert.equal(refunded.despesas[0].paga, false);

  // 4. Excluir uma despesa que estava paga (saldo R$ 750 + despesa R$ 250) -> devolve R$ 250 ao banco (R$ 1.000)
  const deletedPaid = deleteExpenseFromList(bancos, despesas, 'd1');
  assert.equal(deletedPaid.bancos[0].saldo, 1000);
  assert.equal(deletedPaid.despesas.length, 0);
});

test('syncTemplatesToMonth is idempotent (running it twice does not duplicate recurring expenses)', () => {
  const templates = [
    { id: 'm1', descricao: 'Aluguel', valorPadrao: 1500, diaVencimento: 10, categoria: 'Moradia' as const, ativa: true },
    { id: 'm2', descricao: 'Academia', valorPadrao: 120, diaVencimento: 5, categoria: 'Saúde' as const, ativa: false },
  ];
  const firstRun = syncTemplatesToMonth('2026-06', [], templates);
  assert.equal(firstRun.addedCount, 1);
  assert.equal(firstRun.list.length, 1);

  const secondRun = syncTemplatesToMonth('2026-06', firstRun.list, templates);
  assert.equal(secondRun.addedCount, 0);
  assert.equal(secondRun.list.length, 1);
});

test('17. Boundary Discipline: safeJsonParse strips __proto__, constructor, prototype', () => {
  const malicious = '{"bancos":[],"__proto__":{"polluted":true},"constructor":{"prototype":{"hacked":1}}}';
  const parsed = safeJsonParse(malicious);
  assert.equal(({} as any).polluted, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, '__proto__'), false);
  assert.equal(parsed.constructor, Object);
});

test('18. Boundary Discipline: sanitizeCsvCell neutralizes CWE-1236 formula prefixes and escapes quotes', () => {
  assert.equal(sanitizeCsvCell('=cmd|" /C calc"!A0'), '"\'=cmd|"" /C calc""!A0"');
  assert.equal(sanitizeCsvCell('+SUM(A1:A2)'), '"\'+SUM(A1:A2)"');
  assert.equal(sanitizeCsvCell('-100+200'), '"\'-100+200"');
  assert.equal(sanitizeCsvCell('@HYPERLINK("http://evil")'), '"\'@HYPERLINK(""http://evil"")"');
  assert.equal(sanitizeCsvCell('Aluguel Normal'), '"Aluguel Normal"');
});

test('19. Boundary Discipline: normalizeState parses v3.4 backup schema and enforces domain invariants', () => {
  const v34Payload = {
    schemaVersion: '3.4',
    contasBancarias: [{ id: 'b_custom', nome: 'Inter', saldo: '2500.50', rendeJuros: true }],
    caixinhasEReservas: [{ id: 'cx_1', nome: 'Reserva', saldo: 1000, aporteMensal: 300, meta: 5000, tipo: 'emergencia' }],
    salarioEContracheque: {
      salarioAtual: {
        proventos: [{ nome: 'Base', valor: 5000 }],
        descontos: [{ descricao: 'INSS', valor: 6000 }], // Desconto > Bruto deve travar liquido em >= 0
      },
    },
    despesasFixasRecorrentes: [{ id: 'm1', descricao: 'Luz', valorPadrao: -50, diaVencimento: 45, ativa: true }],
    configuracoes: {
      competenciaAtual: '2026-08',
      configPagamento: { tipo: 'invalido', diaFixo: 99 },
      taxaCdiAnual: 11.25,
    },
  };
  const state = normalizeState(v34Payload);
  assert.equal(state.bancos[0].id, 'b_custom');
  assert.equal(state.bancos[0].saldo, 2500.5);
  assert.equal(state.bancos[0].pctCDI, 100);
  assert.equal(state.salario.bruto, 5000);
  assert.equal(state.salario.descontosTotal, 6000);
  assert.equal(state.salario.liquido, 0); // Invariante: líquido nunca negativo
  assert.equal(state.despesasFixasMolde[0].valorPadrao, 0); // Invariante: valor >= 0
  assert.equal(state.despesasFixasMolde[0].diaVencimento, 31); // Invariante: dia [1, 31]
  assert.equal(state.competenciaAtual, '2026-08');
  assert.equal(state.configPagamento.tipo, 'quintoDiaUtil');
  assert.equal(state.configPagamento.diaFixo, 31);
  assert.equal(state.configuracoes.taxaCdiAnual, 11.25);
});

test('20. Apple Fluid Physics: projectMomentum, rubberbandOffset, and shouldDismissSheetOnRelease follow WWDC 2018 equations', () => {
  // 1. projectMomentum: (v / 1000) * d / (1 - d)
  // For v = 1000 px/s and d = 0.998: 1 * 0.998 / 0.002 = 499 px
  const projected = projectMomentum(1000, 0.998);
  assert.ok(Math.abs(projected - 499) < 0.01);
  assert.equal(projectMomentum(0, 0.998), 0);

  // 2. rubberbandOffset: (overshoot * dim * c) / (dim + c * |overshoot|)
  // Resists progressively and never exceeds dimension
  const rbSmall = rubberbandOffset(-40, 400, 0.55);
  const rbLarge = rubberbandOffset(-200, 400, 0.55);
  assert.ok(rbSmall < 0 && rbSmall > -40);
  assert.ok(rbLarge < rbSmall && Math.abs(rbLarge) < 200);

  // 3. shouldDismissSheetOnRelease: uses velocity projection, not just static position
  // Short drag (30px) but fast downward flick (1200 px/s) -> projects past threshold and dismisses
  assert.equal(shouldDismissSheetOnRelease(30, 1200, 110), true);
  // Long downward drag (150px) but user reverses upward (-400 px/s) -> cancels dismissal (velocity sign wins)
  assert.equal(shouldDismissSheetOnRelease(150, -400, 110), false);
});

test('21. Integer-Cent Arithmetic (Cents Engine): eliminates IEEE 754 floating-point drift across monetary operations', () => {
  assert.equal(toCents(10.55), 1055);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(fromCents(1055), 10.55);
  assert.equal(addMoney(0.1, 0.2), 0.3);
  assert.equal(subMoney(100.1, 99.9), 0.2);
  assert.equal(sumMoney([0.1, 0.2, 0.3, 19.99, 0.01]), 20.6);

  // Budget 50/30/20 with income = 0 and classic IEEE 754 float trap (0.1 + 0.2)
  const budgetZeroIncome = calculateBudget503020(
    0,
    [
      { id: '1', moldeId: null, descricao: 'A', valor: 0.1, diaVencimento: 1, paga: false, categoria: 'Moradia', dataPagamento: null, contaOrigem: null },
      { id: '2', moldeId: null, descricao: 'B', valor: 0.2, diaVencimento: 1, paga: false, categoria: 'Alimentação', dataPagamento: null, contaOrigem: null },
    ],
    0
  );
  assert.equal(budgetZeroIncome.essentialsTotal, 0.3);
  assert.equal(budgetZeroIncome.unallocatedMargin, -0.3);

  // executeGoalTransfer with unrounded float input (0.1 + 0.2)
  const transferRes = executeGoalTransfer(
    [{ id: 'b1', nome: 'Nubank', tipo: 'Conta Corrente', saldo: 100.1, rendeJuros: true, pctCDI: 100 }],
    [{ id: 'c1', nome: 'Reserva', saldo: 0.1, aporteMensal: 0, meta: 1000, tipo: 'emergencia', instituicao: 'Nubank', pctCDI: 100 }],
    'c1',
    'b1',
    0.1 + 0.2,
    'aporte'
  );
  assert.equal(transferRes.effectiveValor, 0.3);
  assert.equal(transferRes.bancos[0].saldo, 99.8);
  assert.equal(transferRes.caixinhas[0].saldo, 0.4);
});

test('22. Wealth Conservation: executeGoalTransfer and receiveSalary reject invalid/missing bankId and non-finite amounts', () => {
  const bancos = [{ id: 'b1', nome: 'Nubank', tipo: 'Conta Digital' as const, saldo: 1000, rendeJuros: true, pctCDI: 100 }];
  const caixinhas = [{ id: 'cx1', nome: 'Reserva', saldo: 500, aporteMensal: 200, meta: 5000, tipo: 'emergencia' as const, instituicao: 'Nubank' }];

  const badBankTransfer = executeGoalTransfer(bancos, caixinhas, 'cx1', 'inexistente', 100, 'aporte');
  assert.equal(badBankTransfer.effectiveValor, 0);
  assert.equal(badBankTransfer.bancos[0].saldo, 1000);
  assert.equal(badBankTransfer.caixinhas[0].saldo, 500);

  const emptyBankTransfer = executeGoalTransfer(bancos, caixinhas, 'cx1', '', 100, 'withdraw');
  assert.equal(emptyBankTransfer.effectiveValor, 0);
  assert.equal(emptyBankTransfer.caixinhas[0].saldo, 500);

  const nanTransfer = executeGoalTransfer(bancos, caixinhas, 'cx1', 'b1', NaN, 'aporte');
  assert.equal(nanTransfer.effectiveValor, 0);

  const badSalaryBank = receiveSalary(bancos, caixinhas, 3000, 'inexistente', true);
  assert.equal(badSalaryBank.bancos[0].saldo, 1000);
  assert.equal(badSalaryBank.caixinhas[0].saldo, 500);

  const zeroSalary = receiveSalary(bancos, caixinhas, 0, 'b1', true);
  assert.equal(zeroSalary.bancos[0].saldo, 1000);
  assert.equal(zeroSalary.caixinhas[0].saldo, 500);
});

test('23. Bank Disambiguation: homonymous banks never duplicate refunds, edits, or deletions', () => {
  const b1 = { id: 'b1', nome: 'Nubank', tipo: 'Conta Digital' as const, saldo: 800, rendeJuros: true, pctCDI: 100 };
  const b2 = { id: 'b2', nome: 'Nubank', tipo: 'Conta Corrente' as const, saldo: 500, rendeJuros: false, pctCDI: 0 };

  // Fallback por nome (sem contaOrigemId): apenas o primeiro banco correspondente recebe o estorno
  const legacyExpense = {
    id: 'd1',
    moldeId: null,
    descricao: 'Internet',
    valor: 100,
    diaVencimento: 10,
    paga: true,
    categoria: 'Conectividade' as const,
    dataPagamento: '2026-05-10',
    contaOrigem: 'Nubank',
    contaOrigemId: null,
  };

  assert.equal(matchesExpenseOriginBank(b1, legacyExpense), true);
  assert.equal(matchesExpenseOriginBank(b2, legacyExpense), true);

  const refunded = refundExpenseInList([b1, b2], [legacyExpense], 'd1');
  assert.equal(refunded.bancos[0].saldo, 900);
  assert.equal(refunded.bancos[1].saldo, 500); // Nunca duplica para b2!

  const edited = editExpenseAmountInList([b1, b2], [legacyExpense], 'd1', 150);
  assert.equal(edited.bancos[0].saldo, 750);
  assert.equal(edited.bancos[1].saldo, 500);

  const deleted = deleteExpenseFromList([b1, b2], [legacyExpense], 'd1');
  assert.equal(deleted.bancos[0].saldo, 900);
  assert.equal(deleted.bancos[1].saldo, 500);

  // Quando contaOrigemId existe, casa estritamente por id
  const idExpense = { ...legacyExpense, contaOrigemId: 'b2' };
  assert.equal(matchesExpenseOriginBank(b1, idExpense), false);
  assert.equal(matchesExpenseOriginBank(b2, idExpense), true);
});

test('24. Calendar & DST Safety: clampDateToMonth, day-31 overflow, and Good Friday 2026', () => {
  // Fevereiro não-bissexto (2026) e bissexto (2024)
  const feb2026 = clampDateToMonth(2026, 1, 31);
  assert.equal(feb2026.getMonth(), 1);
  assert.equal(feb2026.getDate(), 28);

  const feb2024 = clampDateToMonth(2024, 1, 31);
  assert.equal(feb2024.getMonth(), 1);
  assert.equal(feb2024.getDate(), 29);

  // diaFixo: 31 em 10/02/2026 deve cair em 28/02/2026 (18 dias), não 03/03/2026
  const paydayFeb = getNextPaydayInfo({ tipo: 'diaFixo', diaFixo: 31, dataExata: null }, new Date(2026, 1, 10));
  assert.equal(paydayFeb.formattedDate, '28/02/2026');
  assert.equal(paydayFeb.daysRemaining, 18);

  // Cartão com corte dia 31 e vencimento dia 10 em 15/02/2026 -> fecha 28/02, vence 10/03 (23 dias)
  const cardFeb = calculateCreditCardGraceDays(31, 10, new Date(2026, 1, 15));
  assert.equal(cardFeb.daysToPay, 23);

  // Sexta-feira Santa 2026 cai em 03/04/2026 (Páscoa 05/04/2026)
  // Abril 2026: 01(1º), 02(2º), 03(Sexta-feira Santa), 04(Sáb), 05(Dom), 06(3º), 07(4º), 08(5º dia útil)
  const aprilFifth = calcularQuintoDiaUtil(2026, 3);
  assert.equal(aprilFifth.getFullYear(), 2026);
  assert.equal(aprilFifth.getMonth(), 3);
  assert.equal(aprilFifth.getDate(), 8);
});

test('25. Yield, High-Discount Card Simulation, FIRE +100, and Safe Daily Allowance', () => {
  // calculateCdiMonthlyYield
  const yld = calculateCdiMonthlyYield(10000, 100, 12, 17.5);
  assert.ok(yld.grossMonthly > 94 && yld.grossMonthly < 96);
  assert.ok(yld.netMonthly > 77 && yld.netMonthly < 80);
  assert.deepEqual(calculateCdiMonthlyYield(0, 100, 12), {
    grossMonthly: 0,
    netMonthly: 0,
    effectiveMonthlyRate: 0,
  });

  // simulateCashVsInstallments com desconto alto (50%): nunca acumula juros negativos
  const highDisc = simulateCashVsInstallments(1000, 50, 10, 0.85);
  assert.equal(highDisc.verdict, 'A_VISTA');
  assert.ok(highDisc.totalInterestEarned >= 0);

  // calculateSafeDailyAllowance com centavos exatos
  const dailyWithSalary = calculateSafeDailyAllowance({
    salarioLiquido: 5000,
    sobraPrevistaMes: 1000,
    saldoLivre: 1500,
    daysRemaining: 10,
  });
  assert.equal(dailyWithSalary, 100);

  const dailyNoSalary = calculateSafeDailyAllowance({
    salarioLiquido: 0,
    sobraPrevistaMes: 1000,
    saldoLivre: 20,
    daysRemaining: 3,
  });
  assert.equal(dailyNoSalary, 6.66);

  const dailyNegative = calculateSafeDailyAllowance({
    salarioLiquido: 5000,
    sobraPrevistaMes: 500,
    saldoLivre: -200,
    daysRemaining: 5,
  });
  assert.equal(dailyNegative, 0);
});

test('26. sumMonthlyExtraIncome sums all or only received extra incomes in exact cents', () => {
  assert.equal(sumMonthlyExtraIncome(undefined), 0);
  assert.equal(sumMonthlyExtraIncome([]), 0);

  const receitas = [
    { id: 'r1', descricao: 'Freela', valor: 0.1, categoria: 'Serviços', data: '2026-11-05', recebida: true },
    { id: 'r2', descricao: 'Reembolso', valor: 0.2, categoria: 'Outros', data: '2026-11-10', recebida: false },
    { id: 'r3', descricao: 'Dividendos', valor: 150.55, categoria: 'Investimentos', data: '2026-11-15', recebida: true },
  ];

  assert.equal(sumMonthlyExtraIncome(receitas), 150.85);
  assert.equal(sumMonthlyExtraIncome(receitas, true), 150.65);
});

test('27. generateInstallmentExpenses splits cents exactly and rolls over December to January', () => {
  const result = generateInstallmentExpenses({
    baseId: 'inst_notebook',
    descricao: 'Notebook',
    valorTotal: 100,
    totalParcelas: 3,
    competenciaInicial: '2026-11',
    categoria: 'Educação',
    vencimentoDia: 15,
    natureza: 'estilo_vida',
    contaOrigemId: 'b1',
    contaOrigem: 'Nubank',
  });

  assert.deepEqual(Object.keys(result), ['2026-11', '2026-12', '2027-01']);

  const p1 = result['2026-11'][0];
  const p2 = result['2026-12'][0];
  const p3 = result['2027-01'][0];

  assert.equal(p1.valor, 33.34);
  assert.equal(p2.valor, 33.33);
  assert.equal(p3.valor, 33.33);
  assert.equal(sumMoney([p1.valor, p2.valor, p3.valor]), 100);

  assert.equal(p1.descricao, 'Notebook (1/3)');
  assert.equal(p2.descricao, 'Notebook (2/3)');
  assert.equal(p3.descricao, 'Notebook (3/3)');
  assert.equal(p1.parcelaAtual, 1);
  assert.equal(p2.parcelaAtual, 2);
  assert.equal(p3.parcelaAtual, 3);
  assert.equal(p1.totalParcelas, 3);
  assert.equal(p1.grupoParcelamentoId, 'inst_notebook');
  assert.equal(p3.grupoParcelamentoId, 'inst_notebook');
});

test('28. simulateDebtPayoff compares Avalanche vs Snowball with compound interest and snowball rollover', () => {
  assert.deepEqual(simulateDebtPayoff([], 500, 'avalanche'), {
    months: 0,
    totalInterestPaid: 0,
    totalPaid: 0,
    order: [],
  });

  const debts = [
    { id: 'd_small_low', nome: 'Loja', saldoDevedor: 1000, taxaJurosMensal: 2, parcelaMinima: 100 },
    { id: 'd_big_high', nome: 'Cartão', saldoDevedor: 5000, taxaJurosMensal: 10, parcelaMinima: 200 },
  ];

  const avalanche = simulateDebtPayoff(debts, 500, 'avalanche');
  const snowball = simulateDebtPayoff(debts, 500, 'snowball');

  // Avalanche prioriza maior taxa (d_big_high 10% a.m.), pagando menos juros totais que Bola de Neve
  assert.ok(avalanche.totalInterestPaid < snowball.totalInterestPaid);
  assert.ok(avalanche.months > 0 && avalanche.months < 600);
  assert.ok(snowball.months > 0 && snowball.months < 600);

  // Snowball quita a menor dívida (d_small_low) primeiro
  assert.equal(snowball.order[0], 'd_small_low');
  assert.equal(snowball.order[1], 'd_big_high');

  // Fallback seguro quando parcelaMinima <= 0 não trava em 600 meses
  const noMinFallback = simulateDebtPayoff(
    [{ id: 'd_zero_min', nome: 'Sem Mínimo', saldoDevedor: 1000, taxaJurosMensal: 5, parcelaMinima: 0 }],
    0,
    'avalanche'
  );
  assert.ok(noMinFallback.months > 0 && noMinFallback.months < 600);
  assert.equal(noMinFallback.order[0], 'd_zero_min');
});

test('29. storage normalizeState and validateImportJson handle receitasPorMes and installment fields', () => {
  const norm = normalizeState({
    receitasPorMes: {
      '2026-11': [
        { id: 'r1', descricao: 'Bônus', valor: 500, categoria: 'Trabalho', data: '2026-11-10', recebida: true },
        { id: 'r_bad', descricao: 'Inválida', valor: -100, recebida: 'yes' },
        null,
      ],
      invalid_key: [{ id: 'x', valor: 10 }],
    },
    despesasPorMes: {
      '2026-11': [
        {
          id: 'inst_1_p1',
          descricao: 'Curso (1/2)',
          valor: 150,
          diaVencimento: 10,
          paga: false,
          categoria: 'Educação',
          parcelaAtual: 1,
          totalParcelas: 2,
          grupoParcelamentoId: 'inst_1',
        },
      ],
    },
  });

  assert.equal(norm.receitasPorMes['2026-11'].length, 2);
  assert.equal(norm.receitasPorMes['2026-11'][0].valor, 500);
  assert.equal(norm.receitasPorMes['2026-11'][1].valor, 0);
  assert.equal(norm.receitasPorMes['invalid_key'], undefined);
  assert.equal(norm.despesasPorMes['2026-11'][0].parcelaAtual, 1);
  assert.equal(norm.despesasPorMes['2026-11'][0].totalParcelas, 2);
  assert.equal(norm.despesasPorMes['2026-11'][0].grupoParcelamentoId, 'inst_1');

  const importCheck = validateImportJson(
    JSON.stringify({
      receitasPorMes: {
        '2026-11': [{ id: 'r1', descricao: 'Freela', valor: 300, categoria: 'Serviços', data: '2026-11-05', recebida: true }],
      },
    })
  );
  assert.equal(importCheck.ok, true);
  if (importCheck.ok) {
    assert.equal(importCheck.state.receitasPorMes['2026-11'][0].valor, 300);
  }
});

test('30. ALTO-04: toCents and fromCents prevent overflow/Infinity while preserving valid high monetary values', () => {
  assert.equal(MAX_SAFE_MONEY, 9_000_000_000_000);
  assert.equal(MAX_INSTALLMENTS, 600);

  // Overflow e valores não-finitos devem retornar 0 (nunca Infinity/-Infinity/NaN)
  assert.equal(toCents(1e308), 0);
  assert.equal(toCents(-1e308), 0);
  assert.equal(toCents(Infinity), 0);
  assert.equal(toCents(-Infinity), 0);
  assert.equal(toCents(NaN), 0);
  assert.equal(toCents(MAX_SAFE_MONEY + 1), 0);
  assert.equal(toCents(-(MAX_SAFE_MONEY + 1)), 0);

  assert.equal(fromCents(Infinity), 0);
  assert.equal(fromCents(-Infinity), 0);
  assert.equal(fromCents(NaN), 0);
  assert.equal(fromCents(MAX_SAFE_MONEY * 100 + 1), 0);
  assert.equal(fromCents(-(MAX_SAFE_MONEY * 100 + 1)), 0);

  // Valores altos válidos dentro de MAX_SAFE_MONEY são preservados com precisão inteira exata
  assert.equal(toCents(1_000_000_000.55), 100_000_000_055);
  assert.equal(fromCents(100_000_000_055), 1_000_000_000.55);
  assert.equal(toCents(-1_000_000_000.55), -100_000_000_055);
  assert.equal(fromCents(-100_000_000_055), -1_000_000_000.55);
  assert.equal(toCents(MAX_SAFE_MONEY), 900_000_000_000_000);
  assert.ok(Number.isSafeInteger(toCents(MAX_SAFE_MONEY)));
  assert.equal(fromCents(MAX_SAFE_MONEY * 100), MAX_SAFE_MONEY);
});

test('31. ALTO-04: parseQuickExpenseCommand rejects >500 chars and ignores 1e307 / >MAX_SAFE_MONEY candidates', () => {
  // Rejeita entradas acima de 500 caracteres
  const over500 = `Almoço ${'a'.repeat(500)} 45,90 pix`;
  assert.ok(over500.length > 500);
  assert.equal(parseQuickExpenseCommand(over500), null);
  assert.equal(parseQuickExpenseCommand('x'.repeat(501)), null);

  // Ignora candidato 1e307 (308 dígitos, < 500 chars) que antes causava 1e307 * 100 === Infinity
  const cmd1e307 = `Almoço 1${'0'.repeat(307)} pix`;
  assert.ok(cmd1e307.length <= 500);
  assert.equal(parseQuickExpenseCommand(cmd1e307), null);

  // Ignora candidato > MAX_SAFE_MONEY
  assert.equal(parseQuickExpenseCommand('Almoço 99999999999999 pix'), null);

  // Quando há candidato válido junto com 1e307, ignora o overflow e preserva o candidato válido
  const mixed = parseQuickExpenseCommand(`Almoço 45,90 1${'0'.repeat(307)} pix`);
  assert.ok(mixed !== null);
  assert.ok(Number.isFinite(mixed.valor));
  assert.equal(mixed.valor, 45.9);

  // Notação científica literal também nunca pode retornar Infinity
  const sci = parseQuickExpenseCommand('Almoço 1e307');
  if (sci !== null) {
    assert.ok(Number.isFinite(sci.valor) && sci.valor <= MAX_SAFE_MONEY);
  }
});

test('32. ALTO-04: simulateCashVsInstallments and generateInstallmentExpenses enforce MAX_INSTALLMENTS and block DoS/overflow', () => {
  // simulateCashVsInstallments com 1e9 parcelas completa instantaneamente com teto <= 600
  const t0 = performance.now();
  const sim = simulateCashVsInstallments(1000, 100, 1e9, 1);
  const simElapsedMs = performance.now() - t0;

  assert.ok(simElapsedMs < 200, `simulateCashVsInstallments demorou ${simElapsedMs}ms`);
  assert.equal(sim.installmentValue, Math.round((1000 / MAX_INSTALLMENTS) * 100) / 100);
  assert.ok(Number.isFinite(sim.cashPrice));
  assert.ok(Number.isFinite(sim.immediateDiscountValue));
  assert.ok(Number.isFinite(sim.totalInterestEarned));
  assert.ok(Number.isFinite(sim.finalCdiBalanceAfterInstallments));
  assert.ok(Number.isFinite(sim.netAdvantageForInstallments));
  assert.ok(Number.isFinite(sim.breakEvenDiscountPct));

  // Entradas não-finitas ou acima de MAX_SAFE_MONEY em simulateCashVsInstallments
  const simOverflow = simulateCashVsInstallments(1e308, Infinity, Infinity, Infinity);
  assert.equal(simOverflow.cashPrice, 0);
  assert.equal(simOverflow.installmentValue, 0);
  assert.ok(Number.isFinite(simOverflow.finalCdiBalanceAfterInstallments));

  // generateInstallmentExpenses com totalParcelas: 1e9 completa instantaneamente com <= 600 parcelas
  const t1 = performance.now();
  const generated = generateInstallmentExpenses({
    baseId: 'dos_guard',
    descricao: 'Teste Teto',
    valorTotal: 1000,
    totalParcelas: 1e9,
    competenciaInicial: '2026-11',
    categoria: 'Outros',
    vencimentoDia: 10,
  });
  const genElapsedMs = performance.now() - t1;

  const monthKeys = Object.keys(generated);
  assert.ok(genElapsedMs < 200, `generateInstallmentExpenses demorou ${genElapsedMs}ms`);
  assert.equal(monthKeys.length, MAX_INSTALLMENTS);
  const allInstallments = monthKeys.flatMap((k) => generated[k]);
  assert.equal(allInstallments.length, MAX_INSTALLMENTS);
  assert.equal(allInstallments[0].totalParcelas, MAX_INSTALLMENTS);
  assert.equal(sumMoney(allInstallments.map((i) => i.valor)), 1000);

  // Rejeita valorTotal não-finito ou acima de MAX_SAFE_MONEY e totalParcelas não-finito
  assert.deepEqual(
    generateInstallmentExpenses({
      baseId: 'inf_val',
      descricao: 'Infinito',
      valorTotal: Infinity,
      totalParcelas: 12,
      competenciaInicial: '2026-11',
      categoria: 'Outros',
      vencimentoDia: 10,
    }),
    {}
  );
  assert.deepEqual(
    generateInstallmentExpenses({
      baseId: 'over_val',
      descricao: 'Acima do teto',
      valorTotal: MAX_SAFE_MONEY + 1,
      totalParcelas: 12,
      competenciaInicial: '2026-11',
      categoria: 'Outros',
      vencimentoDia: 10,
    }),
    {}
  );
  assert.deepEqual(
    generateInstallmentExpenses({
      baseId: 'inf_parc',
      descricao: 'Parcelas infinitas',
      valorTotal: 1000,
      totalParcelas: Infinity,
      competenciaInicial: '2026-11',
      categoria: 'Outros',
      vencimentoDia: 10,
    }),
    {}
  );
});

test('33. BAIXO-01: sanitizeCsvCell strips C0 control chars before checking formula prefixes (blocks \\x01=CMD bypass)', () => {
  assert.equal(sanitizeCsvCell("\x01=CMD|' /C calc'!A0"), '"\'=CMD|\' /C calc\'!A0"');
  assert.equal(sanitizeCsvCell('\x00+1+1'), '"\'+1+1"');
  assert.equal(sanitizeCsvCell('\x07\x1F-SUM(A1:A2)'), '"\'-SUM(A1:A2)"');
  assert.equal(sanitizeCsvCell('\x02\n@HYPERLINK("http://evil")'), '"\'@HYPERLINK(""http://evil"")"');
  assert.equal(sanitizeCsvCell('\t=1+1'), '"\'=1+1"');
  assert.equal(sanitizeCsvCell('  \x00|calc  '), '"\'|calc"');
  assert.equal(sanitizeCsvCell('Alimentação R$ 45,90'), '"Alimentação R$ 45,90"');
});

test('34. MEDIO-02: validateImportJson rejects payloads exceeding MAX_BACKUP_FILE_BYTES immediately', () => {
  assert.equal(MAX_BACKUP_FILE_BYTES, 10 * 1024 * 1024);
  const oversizedPayload = `{"bancos":[{"id":"1","nome":"${'a'.repeat(MAX_BACKUP_FILE_BYTES)}"}]}`;
  assert.ok(oversizedPayload.length > MAX_BACKUP_FILE_BYTES);

  const t0 = performance.now();
  const res = validateImportJson(oversizedPayload);
  const elapsedMs = performance.now() - t0;

  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.match(res.error, /10\s*MB|limite/i);
  }
  assert.ok(elapsedMs < 100, `validateImportJson demorou ${elapsedMs}ms para rejeitar payload gigante`);
});

test('35. MEDIO-02: normalizeState clamps 1e308 to MAX_SAFE_MONEY, truncates/cleans Bidi strings, and caps collections/months/installments', () => {
  assert.equal(MAX_COLLECTION_ITEMS, 2000);
  assert.equal(MAX_STRING_LEN, 300);
  const giantBidi = `Nubank\u202E\u2066\x00\x07${'X'.repeat(500)}`;

  const giantBanks = Array.from({ length: MAX_COLLECTION_ITEMS + 250 }, (_, idx) => ({
    id: `b_${idx}`,
    nome: idx === 0 ? giantBidi : `Banco ${idx}`,
    tipo: 'Conta Digital',
    saldo: idx === 0 ? 1e308 : idx === 1 ? -1e308 : 100,
    rendeJuros: true,
    pctCDI: idx === 0 ? 1e308 : 100,
  }));

  const manyMonths: Record<string, any[]> = {};
  for (let i = 0; i < 260; i++) {
    const year = 2000 + Math.floor(i / 12);
    const month = String((i % 12) + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    manyMonths[key] =
      i === 0
        ? Array.from({ length: MAX_COLLECTION_ITEMS + 100 }, (_, j) => ({
            id: `e_${j}`,
            descricao: j === 0 ? giantBidi : `Item ${j}`,
            valor: j === 0 ? 1e308 : 10,
            diaVencimento: 10,
            paga: false,
            categoria: 'Outros',
            parcelaAtual: 999999,
            totalParcelas: 999999,
          }))
        : [{ id: `e_${i}`, descricao: 'Conta', valor: 50, diaVencimento: 10, paga: false, categoria: 'Outros' }];
  }

  const manyIncomeMonths: Record<string, any[]> = {};
  for (let i = 0; i < 260; i++) {
    const year = 2000 + Math.floor(i / 12);
    const month = String((i % 12) + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    manyIncomeMonths[key] =
      i === 0
        ? Array.from({ length: MAX_COLLECTION_ITEMS + 50 }, (_, j) => ({
            id: `r_${j}`,
            descricao: j === 0 ? giantBidi : `Rec ${j}`,
            valor: j === 0 ? 1e308 : 20,
            categoria: 'Serviços',
            data: `${key}-05`,
            recebida: true,
          }))
        : [{ id: `r_${i}`, descricao: 'Extra', valor: 10, categoria: 'Outros', data: `${key}-01`, recebida: false }];
  }

  const giantCaixinhas = Array.from({ length: MAX_COLLECTION_ITEMS + 50 }, (_, i) => ({
    id: `cx_${i}`,
    nome: i === 0 ? giantBidi : `Cx ${i}`,
    saldo: i === 0 ? 1e308 : 10,
    aporteMensal: i === 0 ? 1e308 : 10,
    meta: i === 0 ? 1e308 : 100,
    tipo: 'emergencia',
    instituicao: i === 0 ? giantBidi : 'Banco',
    pctCDI: i === 0 ? 1e308 : 100,
  }));

  const giantCartoes = Array.from({ length: MAX_COLLECTION_ITEMS + 50 }, (_, i) => ({
    id: `c_${i}`,
    nome: i === 0 ? giantBidi : `Card ${i}`,
    diaCorte: 10,
    diaVencimento: 17,
    beneficio: 'Cashback',
    limiteTotal: i === 0 ? 1e308 : 1000,
    faturaAtual: i === 0 ? 1e308 : 0,
  }));

  const giantDividas = Array.from({ length: MAX_COLLECTION_ITEMS + 50 }, (_, i) => ({
    id: `d_${i}`,
    nome: i === 0 ? giantBidi : `Div ${i}`,
    saldoDevedor: i === 0 ? 1e308 : 100,
    taxaJurosMensal: i === 0 ? 1e308 : 2,
    parcelaMinima: i === 0 ? 1e308 : 50,
  }));

  const giantMolde = Array.from({ length: MAX_COLLECTION_ITEMS + 50 }, (_, i) => ({
    id: `m_${i}`,
    descricao: i === 0 ? giantBidi : `Molde ${i}`,
    valorPadrao: i === 0 ? 1e308 : 100,
    diaVencimento: 10,
    categoria: 'Moradia',
    ativa: true,
  }));

  const giantHistorico = Array.from({ length: MAX_COLLECTION_ITEMS + 50 }, (_, i) => ({
    id: `h_${i}`,
    competencia: '2026-11',
    mesLabel: i === 0 ? giantBidi : 'Nov/2026',
    proventos: [{ id: 'p1', nome: 'Base', valor: i === 0 ? 1e308 : 1000 }],
    descontos: [],
    bruto: i === 0 ? 1e308 : 1000,
    descontosTotal: 0,
    liquido: i === 0 ? 1e308 : 1000,
  }));

  const norm = normalizeState({
    bancos: giantBanks,
    caixinhas: giantCaixinhas,
    cartoes: giantCartoes,
    dividas: giantDividas,
    salario: {
      proventos: Array.from({ length: MAX_COLLECTION_ITEMS + 50 }, (_, i) => ({
        id: `p_${i}`,
        nome: i === 0 ? giantBidi : `Prov ${i}`,
        valor: i < 2 ? 1e308 : 10,
      })),
      descontos: [{ id: 'd1', nome: 'IR', valor: 1e308 }],
    },
    historicoContracheques: giantHistorico,
    despesasFixasMolde: giantMolde,
    despesasPorMes: manyMonths,
    receitasPorMes: manyIncomeMonths,
  });

  // Magnitude travada em ±MAX_SAFE_MONEY
  assert.equal(norm.bancos[0].saldo, MAX_SAFE_MONEY);
  assert.equal(norm.bancos[1].saldo, -MAX_SAFE_MONEY);
  assert.equal(norm.bancos[0].pctCDI, MAX_SAFE_MONEY);
  assert.equal(norm.caixinhas[0].saldo, MAX_SAFE_MONEY);
  assert.equal(norm.caixinhas[0].meta, MAX_SAFE_MONEY);
  assert.equal(norm.caixinhas[0].aporteMensal, MAX_SAFE_MONEY);
  assert.equal(norm.cartoes[0].limiteTotal, MAX_SAFE_MONEY);
  assert.equal(norm.cartoes[0].faturaAtual, MAX_SAFE_MONEY);
  assert.equal(norm.dividas[0].saldoDevedor, MAX_SAFE_MONEY);
  assert.equal(norm.dividas[0].parcelaMinima, MAX_SAFE_MONEY);
  assert.equal(norm.salario.bruto, MAX_SAFE_MONEY);
  assert.equal(norm.historicoContracheques[0].bruto, MAX_SAFE_MONEY);
  assert.equal(norm.despesasFixasMolde[0].valorPadrao, MAX_SAFE_MONEY);
  assert.equal(norm.despesasPorMes['2000-01'][0].valor, MAX_SAFE_MONEY);
  assert.equal(norm.receitasPorMes['2000-01'][0].valor, MAX_SAFE_MONEY);

  // Strings truncadas em MAX_STRING_LEN (300) sem controles C0/C1 nem Bidi overrides
  assert.equal(norm.bancos[0].nome.length, MAX_STRING_LEN);
  assert.equal(norm.bancos[0].nome.includes('\u202E'), false);
  assert.equal(norm.bancos[0].nome.includes('\u2066'), false);
  assert.equal(norm.bancos[0].nome.includes('\x00'), false);
  assert.equal(norm.caixinhas[0].instituicao.length, MAX_STRING_LEN);
  assert.equal(norm.historicoContracheques[0].mesLabel.length, MAX_STRING_LEN);
  assert.equal(norm.despesasPorMes['2000-01'][0].descricao.length, MAX_STRING_LEN);
  assert.equal(norm.despesasPorMes['2000-01'][0].descricao.includes('\u202E'), false);

  // Limites de coleções, competências e parcelas
  assert.equal(norm.bancos.length, MAX_COLLECTION_ITEMS);
  assert.equal(norm.caixinhas.length, MAX_COLLECTION_ITEMS);
  assert.equal(norm.cartoes.length, MAX_COLLECTION_ITEMS);
  assert.equal(norm.dividas.length, MAX_COLLECTION_ITEMS);
  assert.equal(norm.salario.proventos.length, MAX_COLLECTION_ITEMS);
  assert.equal(norm.historicoContracheques.length, MAX_COLLECTION_ITEMS);
  assert.equal(norm.despesasFixasMolde.length, MAX_COLLECTION_ITEMS);
  assert.equal(Object.keys(norm.despesasPorMes).length, 240);
  assert.equal(norm.despesasPorMes['2000-01'].length, MAX_COLLECTION_ITEMS);
  assert.equal(Object.keys(norm.receitasPorMes).length, 240);
  assert.equal(norm.receitasPorMes['2000-01'].length, MAX_COLLECTION_ITEMS);
  assert.equal(norm.despesasPorMes['2000-01'][0].parcelaAtual, MAX_INSTALLMENTS);
  assert.equal(norm.despesasPorMes['2000-01'][0].totalParcelas, MAX_INSTALLMENTS);
});




