/**
 * Testes Unitários de Matemática Financeira e Algoritmos do FinTrack
 * Padrão ECC (Engenharia Defensiva) + Karpathy (Primeiros Princípios)
 */

const assert = require('assert');

// 1. Algoritmo de Lançamento Rápido Inteligente (Natural Language Parser)
function parseQuickExpense(texto) {
  if (!texto || typeof texto !== 'string') return null;
  const t = texto.trim();
  if (!t) return null;

  const valMatch = t.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  if (!valMatch) return null;

  const numStr = valMatch[1].replace(',', '.');
  const valor = parseFloat(numStr);
  if (isNaN(valor) || valor <= 0) return null;

  const semValor = t.replace(valMatch[0], '').replace(/\s+/g, ' ').trim();

  let formaPagamento = "Cartão de Débito";
  const semValorLower = semValor.toLowerCase();
  if (semValorLower.includes("pix")) {
    formaPagamento = "Pix";
  } else if (semValorLower.includes("cartao") || semValorLower.includes("cartão") || semValorLower.includes("credito") || semValorLower.includes("crédito")) {
    formaPagamento = "Cartão de Crédito";
  } else if (semValorLower.includes("debito") || semValorLower.includes("débito")) {
    formaPagamento = "Cartão de Débito";
  } else if (semValorLower.includes("dinheiro") || semValorLower.includes("especie")) {
    formaPagamento = "Dinheiro";
  }

  let descLimpa = semValor
    .replace(/\b(pix|cartao|cartão|credito|crédito|debito|débito|dinheiro)\b/gi, '')
    .trim();
  if (!descLimpa) descLimpa = "Despesa rápida";

  let categoria = "Outros";
  const dLower = descLimpa.toLowerCase();
  if (/mercado|almoco|almoço|jantar|lanche|restaurante|padaria|ifood|cafe|café|comida|pizza|hamburguer|supermercado/i.test(dLower)) {
    categoria = "Alimentação";
  } else if (/uber|99|gasolina|combustivel|combustível|onibus|ônibus|metro|metrô|estacionamento|pedagio|pedágio|carro/i.test(dLower)) {
    categoria = "Transporte";
  } else if (/aluguel|condominio|condomínio|luz|energia|agua|água|internet|gas|gás|casa|iptu/i.test(dLower)) {
    categoria = "Moradia";
  } else if (/farmacia|farmácia|remedio|remédio|medico|médico|dentista|exame|consulta|hospital|saude|saúde/i.test(dLower)) {
    categoria = "Saúde";
  } else if (/cinema|show|jogo|netflix|spotify|viagem|livro|passeio|lazer/i.test(dLower)) {
    categoria = "Lazer";
  } else if (/curso|faculdade|escola|pos|pós|livros|estudo/i.test(dLower)) {
    categoria = "Educação";
  } else if (/roupa|tenis|tênis|calcado|calçado|vestuario|vestuário/i.test(dLower)) {
    categoria = "Vestuário";
  }

  descLimpa = descLimpa.charAt(0).toUpperCase() + descLimpa.slice(1);

  return {
    descricao: descLimpa,
    valor: valor,
    categoria: categoria,
    formaPagamento: formaPagamento
  };
}

// 2. Fórmulas de Diária Segura
function calcularDiariaSegura(saldoLivre, despesasPendentes, diasRestantes) {
  if (diasRestantes <= 0) diasRestantes = 1;
  const saldoLiquidoGiro = saldoLivre - despesasPendentes;
  if (saldoLiquidoGiro <= 0) {
    return { diariaSegura: 0, deficit: Math.abs(saldoLiquidoGiro), superavit: 0 };
  }
  const diaria = saldoLiquidoGiro / diasRestantes;
  return { diariaSegura: Number(diaria.toFixed(2)), deficit: 0, superavit: saldoLiquidoGiro };
}

// 3. Calculadora de Horas de Vida
function calcularHorasDeVida(valorGasto, salarioLiquido, horasMensaisTrabalhadas = 160) {
  if (salarioLiquido <= 0 || horasMensaisTrabalhadas <= 0) return 0;
  const valorHora = salarioLiquido / horasMensaisTrabalhadas;
  const horas = valorGasto / valorHora;
  return Number(horas.toFixed(1));
}

// 4. Simulador À Vista com Desconto vs. Parcelado + CDI a 100%
function simularCompraAvistaVsParcelado(valorOriginal, pctDescontoAvista, parcelas, taxaCdiAnualPct = 10.5) {
  const valorAvista = valorOriginal * (1 - (pctDescontoAvista / 100));
  const valorParcela = valorOriginal / parcelas;
  
  // Taxa mensal efetiva do CDI
  const taxaMensal = Math.pow(1 + (taxaCdiAnualPct / 100), 1 / 12) - 1;
  
  // Simulando manter o dinheiro na conta rendendo enquanto paga parcelas
  let saldoAplicado = valorAvista;
  let totalRendimento = 0;
  
  for (let m = 1; m <= parcelas; m++) {
    const rendimentoMes = saldoAplicado * taxaMensal;
    totalRendimento += rendimentoMes;
    saldoAplicado = (saldoAplicado + rendimentoMes) - valorParcela;
  }
  
  const custoFinalParcelado = (valorParcela * parcelas) - totalRendimento;
  const melhorOpcao = valorAvista <= custoFinalParcelado ? "A_VISTA" : "PARCELADO_CDI";
  const economia = Math.abs(valorAvista - custoFinalParcelado);

  return {
    valorAvista: Number(valorAvista.toFixed(2)),
    custoFinalParcelado: Number(custoFinalParcelado.toFixed(2)),
    totalRendimento: Number(totalRendimento.toFixed(2)),
    melhorOpcao: melhorOpcao,
    economia: Number(economia.toFixed(2))
  };
}

// EXECUÇÃO DOS TESTES
console.log('--- EXECUTANDO TESTES UNITÁRIOS DE MATEMÁTICA FINANCEIRA ---');

// Teste 1: Parser de despesa rápida
{
  const r1 = parseQuickExpense("almoço 35,50");
  assert.strictEqual(r1.descricao, "Almoço");
  assert.strictEqual(r1.valor, 35.50);
  assert.strictEqual(r1.categoria, "Alimentação");
  assert.strictEqual(r1.formaPagamento, "Cartão de Débito");

  const r2 = parseQuickExpense("uber 28 pix");
  assert.strictEqual(r2.descricao, "Uber");
  assert.strictEqual(r2.valor, 28);
  assert.strictEqual(r2.categoria, "Transporte");
  assert.strictEqual(r2.formaPagamento, "Pix");

  const r3 = parseQuickExpense("farmácia 89.90 cartão");
  assert.strictEqual(r3.descricao, "Farmácia");
  assert.strictEqual(r3.valor, 89.90);
  assert.strictEqual(r3.categoria, "Saúde");
  assert.strictEqual(r3.formaPagamento, "Cartão de Crédito");

  console.log('✅ Teste 1: Parser de Despesas Rápidas aprovado.');
}

// Teste 2: Diária Segura
{
  const d1 = calcularDiariaSegura(1500, 500, 10);
  assert.strictEqual(d1.diariaSegura, 100.00);
  assert.strictEqual(d1.deficit, 0);

  const d2 = calcularDiariaSegura(400, 600, 10);
  assert.strictEqual(d2.diariaSegura, 0);
  assert.strictEqual(d2.deficit, 200);

  console.log('✅ Teste 2: Cálculo de Diária Segura aprovado.');
}

// Teste 3: Horas de Vida
{
  // Salário 3200 / 160h = R$ 20/h. Produto de R$ 100 = 5.0h
  const h1 = calcularHorasDeVida(100, 3200, 160);
  assert.strictEqual(h1, 5.0);

  // Produto de R$ 50 = 2.5h
  const h2 = calcularHorasDeVida(50, 3200, 160);
  assert.strictEqual(h2, 2.5);

  console.log('✅ Teste 3: Cálculo de Horas de Vida Anti-Impulso aprovado.');
}

// Teste 4: À Vista vs. Parcelado + CDI
{
  // Produto R$ 1000 com 10% de desconto à vista (R$ 900) vs 10x sem juros no CDI a 10.5%
  const sim = simularCompraAvistaVsParcelado(1000, 10, 10, 10.5);
  assert.strictEqual(sim.valorAvista, 900.00);
  assert(sim.totalRendimento > 0, "O rendimento deve ser maior que zero");
  assert.strictEqual(typeof sim.melhorOpcao, 'string');

  console.log('✅ Teste 4: Simulador À Vista vs. Parcelado + CDI aprovado.');
}

console.log('🎉 TODOS OS TESTES UNITÁRIOS PASSARAM COM SUCESSO!');
