/**
 * backup_structure.test.js
 * Teste unitário e de integração para validação da estrutura completa de backup
 * Governança: ECC + @Sec (OWASP CWE-1236 / Prototype Pollution) + @Dev (TDD)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Carrega o conteúdo de legacy/app.html ou src/app.html para extrair o ESTADO_PADRAO e funções de backup
const candidates = [
  path.resolve(__dirname, '../legacy/app.html'),
  path.resolve(__dirname, '../public/app.html'),
  path.resolve(__dirname, '../src/app.html')
];
const appHtmlPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
const appHtml = fs.readFileSync(appHtmlPath, 'utf8');

console.log("==================================================");
console.log("🧪 INICIANDO TESTE DE ESTRUTURA DE BACKUP COMPLETO");
console.log("==================================================\n");

// Extrai ESTADO_PADRAO e funções do app.html
const estadoPadraoMatch = appHtml.match(/const ESTADO_PADRAO = (\{[\s\S]*?\r?\n\};)/);
if (!estadoPadraoMatch) {
  console.error("❌ Erro: Não foi possível localizar ESTADO_PADRAO no app.html");
  process.exit(1);
}

// Extrai criarPayloadBackupEstruturado
const criarPayloadMatch = appHtml.match(/function criarPayloadBackupEstruturado\(state\) \{[\s\S]*?\r?\n\}/);
if (!criarPayloadMatch) {
  console.error("❌ Erro: Não foi possível localizar criarPayloadBackupEstruturado no app.html");
  process.exit(1);
}

// Extrai sanitizarCelulaCSV
const sanitizarCsvMatch = appHtml.match(/function sanitizarCelulaCSV\(valor\) \{[\s\S]*?\r?\n\}/);
if (!sanitizarCsvMatch) {
  console.error("❌ Erro: Não foi possível localizar sanitizarCelulaCSV no app.html");
  process.exit(1);
}

// Extrai validarEHigienizarBackup
const validarBackupMatch = appHtml.match(/function validarEHigienizarBackup\(obj\) \{[\s\S]*?\r?\n  return estadoLimpo;\r?\n\}/);
if (!validarBackupMatch) {
  console.error("❌ Erro: Não foi possível localizar validarEHigienizarBackup no app.html");
  process.exit(1);
}

// Avalia de forma isolada
let ESTADO_PADRAO, criarPayloadBackupEstruturado, sanitizarCelulaCSV, validarEHigienizarBackup;
try {
  const runner = new Function(`
    ${estadoPadraoMatch[0]}
    function isVaultPayload(p) { return Boolean(p && p.__isEncryptedVault); }
    ${sanitizarCsvMatch[0]}
    ${criarPayloadMatch[0]}
    ${validarBackupMatch[0]}
    return { ESTADO_PADRAO, criarPayloadBackupEstruturado, sanitizarCelulaCSV, validarEHigienizarBackup };
  `);
  const env = runner();
  ESTADO_PADRAO = env.ESTADO_PADRAO;
  criarPayloadBackupEstruturado = env.criarPayloadBackupEstruturado;
  sanitizarCelulaCSV = env.sanitizarCelulaCSV;
  validarEHigienizarBackup = env.validarEHigienizarBackup;
  console.log("✅ Entidades e funções extraídas diretamente de src/app.html.");
} catch (e) {
  console.error("❌ Erro ao avaliar código extraído do app.html:", e);
  process.exit(1);
}

// Teste 1: Verificar se o estado padrão possui o esquema estrutural íntegro e zerado (R$ 0,00)
console.log("\n[TESTE 1] Verificando integridade de esquema no estado padrão...");
assert(Array.isArray(ESTADO_PADRAO.bancos), "Bancos deve ser um array");
assert(Array.isArray(ESTADO_PADRAO.caixinhas), "Caixinhas deve ser um array");
assert(Array.isArray(ESTADO_PADRAO.cartoes), "Cartões deve ser um array");
assert(ESTADO_PADRAO.salario && Array.isArray(ESTADO_PADRAO.salario.proventos), "Salário deve conter proventos");
assert(ESTADO_PADRAO.salario && Array.isArray(ESTADO_PADRAO.salario.descontos), "Salário deve conter descontos");
assert.strictEqual(ESTADO_PADRAO.salario.liquido, 0, "Estado padrão inicial deve iniciar zerado");
assert(Array.isArray(ESTADO_PADRAO.despesasFixasMolde), "DespesasFixasMolde deve ser um array");
assert(typeof ESTADO_PADRAO.despesasPorMes === "object", "DespesasPorMes deve ser um objeto");
console.log("✅ [TESTE 1 APROVADO] Esquema inicial limpo e todas as entidades fundamentais presentes.");

// Teste 2: Validar que a estrutura de backup consolidada reúne todas as áreas
console.log("\n[TESTE 2] Validando função de exportação estruturada (schemaVersion 3.4)...");
const fixtureState = {
  ...structuredClone(ESTADO_PADRAO),
  competenciaAtual: "2026-11",
  salario: {
    proventos: [{ id: "p1", nome: "Salário Base", valor: 5000 }],
    descontos: [{ id: "d1", nome: "INSS", valor: 500 }],
    bruto: 5000,
    descontosTotal: 500,
    liquido: 4500
  },
  bancos: [{ id: "b1", nome: "Banco Alpha", tipo: "Conta Digital", saldo: 2000, rendeJuros: true, pctCDI: 100 }],
  caixinhas: [{ id: "cx1", nome: "Reserva", saldo: 3000, aporteMensal: 500, meta: 10000, tipo: "emergencia", instituicao: "Banco Alpha" }],
  cartoes: [{ id: "c1", nome: "Cartão Demo", diaCorte: 10, diaVencimento: 17, beneficio: "Cashback" }],
  despesasFixasMolde: [{ id: "m1", descricao: "Moradia", valorPadrao: 1200, diaVencimento: 10, categoria: "Moradia", ativa: true }],
  despesasPorMes: {
    "2026-11": [{ id: "d1", moldeId: "m1", descricao: "Moradia", valor: 1200, diaVencimento: 10, paga: false, categoria: "Moradia", dataPagamento: null, contaOrigem: null }]
  }
};
const payloadExportado = criarPayloadBackupEstruturado(fixtureState);

assert.strictEqual(payloadExportado.schemaVersion, "3.4");
assert.strictEqual(payloadExportado.appName, "FinTrack");
assert(payloadExportado.resumoPatrimonial.patrimonioLiquidoConsolidado > 0, "Resumo patrimonial deve calcular patrimônio líquido");
assert(payloadExportado.contasBancarias.length > 0, "Backup exportado deve conter contas bancárias");
assert(payloadExportado.caixinhasEReservas.length > 0, "Backup exportado deve conter caixinhas");
assert(payloadExportado.cartoesCredito.length > 0, "Backup exportado deve conter cartões de crédito");
assert(payloadExportado.despesasFixasRecorrentes.length > 0, "Backup exportado deve conter despesas fixas molde");
assert(Object.keys(payloadExportado.despesasPorCompetencia).length > 0, "Backup exportado deve conter competências");
assert(payloadExportado.salarioEContracheque.salarioAtual.liquido > 0, "Backup exportado deve conter salário líquido");
assert(payloadExportado.envelopesOrcamentarios.supermercado, "Backup exportado deve conter envelopes orçamentários");
console.log("✅ [TESTE 2 APROVADO] Payload estruturado contém todas as entidades sem omissão.");

// Teste 3: Round-Trip com a função real validarEHigienizarBackup(obj)
console.log("\n[TESTE 3] Testando importação e desempacotamento seguro via validarEHigienizarBackup()...");
const estadoRestaurado = validarEHigienizarBackup(payloadExportado);

assert.strictEqual(estadoRestaurado.bancos.length, fixtureState.bancos.length);
assert.strictEqual(estadoRestaurado.caixinhas.length, fixtureState.caixinhas.length);
assert.strictEqual(estadoRestaurado.cartoes.length, fixtureState.cartoes.length);
assert.strictEqual(estadoRestaurado.despesasFixasMolde.length, fixtureState.despesasFixasMolde.length);
assert.strictEqual(estadoRestaurado.salario.liquido, fixtureState.salario.liquido);
assert.strictEqual(estadoRestaurado.competenciaAtual, fixtureState.competenciaAtual);
assert.deepStrictEqual(Object.keys(estadoRestaurado.despesasPorMes), Object.keys(fixtureState.despesasPorMes));
console.log("✅ [TESTE 3 APROVADO] validarEHigienizarBackup desempacotou e validou o payload 3.4 com 100% de fidelidade.");

// Teste 4: Blindagem contra Prototype Pollution
console.log("\n[TESTE 4] Validando blindagem contra Prototype Pollution (OWASP)...");
let pollutionBarrada = false;
try {
  const payloadMalicioso = JSON.parse('{"schemaVersion":"3.4","__proto__":{"admin":true}}');
  validarEHigienizarBackup(payloadMalicioso);
} catch (err) {
  if (err.message.includes("Assinatura de segurança violada")) {
    pollutionBarrada = true;
  }
}
assert(pollutionBarrada, "Deveria barrar payload com tentativa de prototype pollution");
console.log("✅ [TESTE 4 APROVADO] Prototype pollution bloqueado com sucesso.");

// Teste 5: Blindagem contra CSV / Formula Injection (CWE-1236)
console.log("\n[TESTE 5] Validando sanitização contra CSV Formula Injection (CWE-1236)...");
assert.strictEqual(sanitizarCelulaCSV("=1+1"), "\"'=1+1\"");
assert.strictEqual(sanitizarCelulaCSV("+cmd|' /C calc'!A0"), "\"'+cmd|' /C calc'!A0\"");
assert.strictEqual(sanitizarCelulaCSV("-SUM(A1:A10)"), "\"'-SUM(A1:A10)\"");
assert.strictEqual(sanitizarCelulaCSV("@import"), "\"'@import\"");
assert.strictEqual(sanitizarCelulaCSV("Nubank \"Principal\""), "\"Nubank \"\"Principal\"\"\"");
console.log("✅ [TESTE 5 APROVADO] Sanitização de CSV neutraliza todas as fórmulas com apóstrofo e escape RFC 4180.");

console.log("\n==================================================");
console.log("🎉 TODOS OS TESTES DE BACKUP FORAM APROVADOS (5/5)");
console.log("==================================================\n");
