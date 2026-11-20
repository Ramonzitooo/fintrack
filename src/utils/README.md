# Core Utilities (`src/utils`)

## Overview
Deterministic financial mathematics engine, gesture physics helpers, and local storage persistence layer with OWASP sanitization against Prototype Pollution and CSV Formula Injection (CWE-1236).

## Interface
- `[src/utils/financeMath.ts:BankAccount]`: Exported interface for bank account entities (`id`, `nome`, `tipo`, `saldo`, `rendeJuros`, `pctCDI`).
- `[src/utils/financeMath.ts:Caixinha]`: Exported interface for savings/goal pots (`id`, `nome`, `saldo`, `aporteMensal`, `meta`, `tipo`, `instituicao`, `pctCDI`).
- `[src/utils/financeMath.ts:CreditCard]`: Exported interface for credit card entities (`id`, `nome`, `diaCorte`, `diaVencimento`, `beneficio`, `limiteTotal`, `faturaAtual`).
- `[src/utils/financeMath.ts:ExpenseItem]`: Exported interface for monthly expense records (`id`, `moldeId`, `descricao`, `valor`, `diaVencimento`, `paga`, `categoria`, `natureza`, `dataPagamento`, `contaOrigem`, `contaOrigemId`, `formaPagamento`).
- `[src/utils/financeMath.ts:RecurringExpenseTemplate]`: Exported interface for recurring fixed expense templates (`id`, `descricao`, `valorPadrao`, `diaVencimento`, `categoria`, `ativa`).
- `[src/utils/financeMath.ts:PayrollItem]`: Exported interface for payroll earnings/deductions (`id`, `nome`, `valor`).
- `[src/utils/financeMath.ts:DebtItem]`: Exported interface for debt records (`id`, `nome`, `saldoDevedor`, `taxaJurosMensal`, `parcelaMinima`).
- `[src/utils/financeMath.ts:PaydayConfig]`: Exported interface for payday schedule configuration (`tipo`, `diaFixo`, `dataExata`).
- `[src/utils/financeMath.ts:toCents]`: Converts a BRL decimal number into exact integer cents (`Math.round(num * 100)`), eliminating `-0` and IEEE 754 float drift.
- `[src/utils/financeMath.ts:fromCents]`: Converts integer cents back into a 2-decimal BRL number (`intCents / 100`).
- `[src/utils/financeMath.ts:addMoney]`: Adds two monetary values in exact integer cents (`fromCents(toCents(a) + toCents(b))`).
- `[src/utils/financeMath.ts:subMoney]`: Subtracts two monetary values in exact integer cents (`fromCents(toCents(a) - toCents(b))`).
- `[src/utils/financeMath.ts:sumMoney]`: Sums an array of monetary values in exact integer cents.
- `[src/utils/financeMath.ts:annualToMonthlyRate]`: Converts an annual percentage rate into a compound monthly decimal rate: `(1 + annualPct/100)^(1/12) - 1`.
- `[src/utils/financeMath.ts:calculateCdiMonthlyYield]`: Computes `grossMonthly`, `netMonthly`, and `effectiveMonthlyRate` for a CDI balance with regressive IR deduction (default `irAliquotPct = 17.5`).
- `[src/utils/financeMath.ts:calculateGoalMonthsCompound]`: Computes linear and compound months to reach a savings goal, months saved by interest, and total interest earned.
- `[src/utils/financeMath.ts:calculateFireProjection]`: Computes FIRE `targetPatrimony`, `currentSafeMonthlyIncome`, `yearsToFire`, `monthsToFire`, `yearsSavedWithExtra100`, and `progressPct`.
- `[src/utils/financeMath.ts:isEssentialCategory]`: Classifies an `ExpenseItem` category or `naturezaOverride` as essential (`true`) or lifestyle (`false`).
- `[src/utils/financeMath.ts:calculateBudget503020]`: Computes 50/30/20 budget breakdown totals and percentages (`essentials`, `lifestyle`, `investments`, `unallocatedMargin`).
- `[src/utils/financeMath.ts:applyExpensePaymentToAccount]`: Subtracts a non-negative expense amount from a bank account balance rounded to 2 decimal places.
- `[src/utils/financeMath.ts:refundExpensePaymentToAccount]`: Adds a non-negative expense amount back to a bank account balance rounded to 2 decimal places.
- `[src/utils/financeMath.ts:calculateCreditCardGraceDays]`: Computes `daysToPay` and `statusLabel` (`'Melhor Janela'` | `'Prazo Médio'` | `'Fatura Quase Fechando'`) for a credit card purchase.
- `[src/utils/financeMath.ts:simulateCashVsInstallments]`: Compares paying cash with a discount vs. interest-free installments invested in CDI, returning `verdict` (`'PARCELAR'` | `'A_VISTA'` | `'EMPATE'`) and `breakEvenDiscountPct`.
- `[src/utils/financeMath.ts:calculateOfficialPayrollTaxes]`: Calculates progressive Brazilian CLT INSS and IRRF taxes, `effectiveTaxRatePct`, and `estimatedNetSalary`.
- `[src/utils/financeMath.ts:parseQuickExpenseCommand]`: Parses a natural language string into `{ descricao, valor, categoria, formaPagamento }` or `null`.
- `[src/utils/financeMath.ts:calcularQuintoDiaUtil]`: Computes the 5th business day `Date` for a given year and 0-indexed month, excluding weekends and national holidays.
- `[src/utils/financeMath.ts:getNextPaydayInfo]`: Computes `{ daysRemaining, formattedDate }` until the next payday based on `PaydayConfig`.
- `[src/utils/financeMath.ts:matchesExpenseOriginBank]`: Matches a `BankAccount` to an `ExpenseItem` via `contaOrigemId` (primary) or `contaOrigem` name (fallback).
- `[src/utils/financeMath.ts:executeGoalTransfer]`: Transfers funds (`'aporte'` or `'withdraw'`) between a `BankAccount` and a `Caixinha`, returning updated arrays and `effectiveValor`.
- `[src/utils/financeMath.ts:receiveSalary]`: Credits `netSalary` to a target `BankAccount` and optionally distributes planned monthly contributions across `Caixinhas`.
- `[src/utils/financeMath.ts:payExpenseInList]`: Marks an unpaid expense as paid, debits the selected `BankAccount` if provided, and records payment metadata.
- `[src/utils/financeMath.ts:refundExpenseInList]`: Reverts a paid expense to unpaid and refunds the origin `BankAccount`.
- `[src/utils/financeMath.ts:editExpenseAmountInList]`: Updates an expense's amount and adjusts the origin `BankAccount` balance by the difference if already paid.
- `[src/utils/financeMath.ts:deleteExpenseFromList]`: Removes an expense from the list and refunds the origin `BankAccount` if the expense was marked paid.
- `[src/utils/financeMath.ts:syncTemplatesToMonth]`: Instantiates missing active `RecurringExpenseTemplate` items into a given month's `ExpenseItem` list.
- `[src/utils/financeMath.ts:projectMomentum]`: Calculates projected gesture deceleration distance using the Apple WWDC 2018 momentum formula.
- `[src/utils/financeMath.ts:rubberbandOffset]`: Calculates elastic edge resistance offset using the Apple WWDC 2018 rubber-banding formula.
- `[src/utils/financeMath.ts:shouldDismissSheetOnRelease]`: Determines whether a dragged modal/sheet should dismiss based on `dragOffsetY`, `velocityY`, and `thresholdPx`.
- `[src/utils/storage.ts:STORAGE_KEY]`: Constant `'APP_FINANCEIRO_V2_DATA'` used as `localStorage` key.
- `[src/utils/storage.ts:HistoricalPayroll]`: Exported interface for historical payslip entries.
- `[src/utils/storage.ts:EnvelopeConfig]`: Exported interface for budget envelope configuration (`total`, `cadencia`).
- `[src/utils/storage.ts:AppState]`: Exported interface representing the complete persisted application state.
- `[src/utils/storage.ts:DEFAULT_STATE]`: Exported default `AppState` constant with initial seed data.
- `[src/utils/storage.ts:safeJsonParse]`: Parses JSON while stripping `__proto__`, `constructor`, and `prototype` keys.
- `[src/utils/storage.ts:sanitizeCsvCell]`: Sanitizes values against CSV Formula Injection (CWE-1236) and escapes double quotes per RFC 4180.
- `[src/utils/storage.ts:loadAppState]`: Loads, parses, and normalizes `AppState` from `localStorage`, falling back to a clone of `DEFAULT_STATE`.
- `[src/utils/storage.ts:saveAppState]`: Serializes and writes `AppState` to `localStorage` under `STORAGE_KEY`.
- `[src/utils/storage.ts:normalizeState]`: Normalizes raw untrusted/legacy state objects (including `schemaVersion: '3.4'`) into a valid `AppState`.
- `[src/utils/storage.ts:fmtBRL]`: Formats a numeric value as a `pt-BR` BRL currency string.
- `[src/utils/storage.ts:formatMonthYear]`: Converts a `'YYYY-MM'` competence key into a localized Portuguese month and year label.

## Invariants
- `[src/utils/financeMath.ts:annualToMonthlyRate]`: Non-positive or non-numeric `annualPct` inputs are clamped to `0` via `Math.max(0, Number(annualPct) || 0)`.
- `[src/utils/financeMath.ts:calculateCdiMonthlyYield]`: Balance and `pctCdi` are clamped to `>= 0`; `irAliquotPct` is clamped to `[0, 100]`; `grossMonthly` and `netMonthly` are rounded to 2 decimal places.
- `[src/utils/financeMath.ts:calculateGoalMonthsCompound]`: If `targetAmount <= 0` or `currentBalance >= targetAmount`, returns `0` for all fields; if `monthlyNetRate <= 0.000001`, compound months equal linear months; compound months when `pmt > 0` is at least `1`.
- `[src/utils/financeMath.ts:calculateFireProjection]`: `swrAnnualPct` is clamped to a minimum of `0.5%`; `progressPct` is capped at `100%`; `yearsSavedWithExtra100` compares monthly contribution `pmt` against `pmt + 200`.
- `[src/utils/financeMath.ts:calculateBudget503020]`: Expense values, `netIncome`, and `plannedContributions` are clamped to `>= 0`; `unallocatedPct` clamps negative `unallocatedMargin` to `0` before dividing by income.
- `[src/utils/financeMath.ts:applyExpensePaymentToAccount]`: Allows negative resulting bank balances (does not clamp balance to `0`) so subsequent refunds via `refundExpensePaymentToAccount` preserve exact accounting.
- `[src/utils/financeMath.ts:calculateCreditCardGraceDays]`: `daysToPay` is clamped to `>= 1`; `statusLabel` is `'Melhor Janela'` when `daysToPay >= 32`, `'Fatura Quase Fechando'` when `daysToPay <= 14`, and `'Prazo Médio'` otherwise.
- `[src/utils/financeMath.ts:simulateCashVsInstallments]`: `cashDiscountPct` is clamped to `[0, 99]`, `installments` to `>= 1`; `verdict` is `'PARCELAR'` if `netAdvantageForInstallments > 0.5`, `'A_VISTA'` if `< -0.5`, and `'EMPATE'` within `[-0.5, 0.5]`.
- `[src/utils/financeMath.ts:calculateOfficialPayrollTaxes]`: Uses progressive INSS brackets capped at `8157.41` and chooses the larger deduction between legal deductions (`INSS + dependents * 189.59`) and simplified discount (`607.20`) for IRRF.
- `[src/utils/financeMath.ts:executeGoalTransfer]`: Withdrawals are capped at the target `Caixinha`'s current non-negative balance (`Math.min(rawVal, Math.max(0, targetCx.saldo))`), and `Caixinha` balance is never reduced below `0`.
- `[src/utils/financeMath.ts:payExpenseInList]`: No-op if `expenseId` is not found or `target.paga` is already `true`.
- `[src/utils/financeMath.ts:refundExpenseInList]`: No-op if `expenseId` is not found or `target.paga` is `false`.
- `[src/utils/financeMath.ts:shouldDismissSheetOnRelease]`: Always returns `false` if upward release `velocityY < -80`, regardless of `dragOffsetY`.
- `[src/utils/storage.ts:safeJsonParse]`: Strips `__proto__`, `constructor`, and `prototype` keys during JSON parsing to prevent prototype pollution.
- `[src/utils/storage.ts:sanitizeCsvCell]`: Prefixes cells starting with `=`, `+`, `-`, `@`, `\t`, `\r`, or `|` with a single quote (`'`) and wraps RFC 4180 escaped content in double quotes.
- `[src/utils/storage.ts:normalizeState]`: Enforces `'YYYY-MM'` regex (`/^\d{4}-\d{2}$/`) on `competenciaAtual` and `despesasPorMes` keys, clamps `diaVencimento` and `diaFixo` to `[1, 31]`, clamps debt/payroll/expense amounts to `>= 0`, and recomputes `salario.bruto`, `descontosTotal`, and `liquido` (`>= 0`) from items.

## Side Effects
- `[src/utils/storage.ts:loadAppState]`: Reads from browser `localStorage` via `localStorage.getItem(STORAGE_KEY)`.
- `[src/utils/storage.ts:saveAppState]`: Writes serialized state to browser `localStorage` via `localStorage.setItem(STORAGE_KEY, ...)` and logs errors via `console.error` on failure.

## Verification
- Run: `npm test`
