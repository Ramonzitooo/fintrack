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
  calculateCreditCardGraceDays,
  calcularQuintoDiaUtil,
  getNextPaydayInfo,
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
  addMoney,
  subMoney,
  sumMoney,
} from './financeMath.ts';
import {
  sanitizeCsvCell,
  safeJsonParse,
  normalizeState,
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

test('calculateOfficialPayrollTaxes computes progressive INSS and IRRF accurately', () => {
  const taxes = calculateOfficialPayrollTaxes(5000, 0);
  assert.ok(taxes.inss > 400 && taxes.inss < 600);
  assert.ok(taxes.irrf > 100 && taxes.irrf < 500);
  assert.equal(taxes.estimatedNetSalary, Math.round((5000 - taxes.inss - taxes.irrf) * 100) / 100);
});

test('parseQuickExpenseCommand parses natural language expense strings', () => {
  const parsed = parseQuickExpenseCommand('Almoço executivo 45,90 pix');
  assert.ok(parsed !== null);
  assert.equal(parsed?.valor, 45.9);
  assert.equal(parsed?.categoria, 'Alimentação');
  assert.equal(parsed?.formaPagamento, 'Pix');
});

test('sanitizeCsvCell neutralizes CWE-1236 formula injection and escapes double quotes (RFC 4180)', () => {
  assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), '"\'=SUM(A1:A10)"');
  assert.equal(sanitizeCsvCell('+1+2'), '"\'+1+2"');
  assert.equal(sanitizeCsvCell('-cmd|'), '"\'-cmd|"');
  assert.equal(sanitizeCsvCell('@IMPORTXML()'), '"\'@IMPORTXML()"');
  assert.equal(sanitizeCsvCell('Almoço "Executivo"'), '"Almoço ""Executivo"""');
});

test('safeJsonParse blocks prototype pollution and normalizeState preserves configPagamento', () => {
  const malicious = '{"__proto__":{"polluted":true},"configPagamento":{"tipo":"diaFixo","diaFixo":15,"dataExata":null}}';
  const parsed = safeJsonParse(malicious);
  assert.equal(({} as any).polluted, undefined);
  const norm = normalizeState(parsed);
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



