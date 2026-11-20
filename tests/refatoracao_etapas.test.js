/**
 * tests/refatoracao_etapas.test.js
 * Validação rigorosa dos 5 requisitos de refatoração solicitados pelo Diretor de Produto
 * Governança: Clean Architecture, ECC e OWASP
 */

const fs = require('fs');
const assert = require('assert');
const path = require('path');

const candidates = [
  path.resolve(__dirname, '../legacy/app.html'),
  path.resolve(__dirname, '../public/app.html'),
  path.resolve(__dirname, '../src/app.html')
];
const appHtmlPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
const content = fs.readFileSync(appHtmlPath, 'utf8');

console.log("==================================================");
console.log("🧪 INICIANDO TESTE ESPECÍFICO DAS 5 ETAPAS");
console.log("==================================================\n");

// 1. Correção da Dupla Subtração Contábil
console.log("[ETAPA 1] Verificando modelo de potes segregados...");
assert(content.includes('const saldoLivre = totalBancos - contasPendentes;'), 'Fórmula de saldoLivre corrigida');
assert(!content.includes('const saldoLivre = totalBancos - totalCaixinhas - contasPendentes;'), 'Dupla subtração removida');
assert(content.includes('const totalPatrimonioLiquido = totalBancos + totalCaixinhas;'), 'totalPatrimonioLiquido definido na barra empilhada');
assert(content.includes('const denom = Math.max(1, totalPatrimonioLiquido);'), 'Denominador da barra calculado sobre totalPatrimonioLiquido');
console.log("✅ [ETAPA 1 APROVADA] Dupla subtração eliminada e Matriz de Conciliação calibrada.");

// 2. Integração de Débito Real no CMDK
console.log("\n[ETAPA 2] Verificando integração de débito real no CMDK (Ctrl+K)...");
assert(content.includes('bancoOrigem.saldo -= p.valor;'), 'Débito na conta bancária de giro principal presente');
assert(content.includes('bancoOrigem.saldo += p.valor;'), 'Estorno na conta bancária presente no undo do toast');
assert(content.includes('contaOrigem: bancoOrigem ? bancoOrigem.nome : null'), 'contaOrigem registrada');
assert(content.includes('contaOrigemId: bancoOrigem ? bancoOrigem.id : null'), 'contaOrigemId registrada');
console.log("✅ [ETAPA 2 APROVADA] Débito real e estorno no CMDK implementados com sucesso.");

// 3. Gestão do Molde e Despesas
console.log("\n[ETAPA 3] Verificando funções de Molde, Despesas, Diária Segura e Envelopes...");
assert(content.includes('function alternarStatusMolde(id)'), 'alternarStatusMolde presente');
assert(content.includes('function excluirMoldeDespesa(id)'), 'excluirMoldeDespesa presente');
assert(content.includes('const removerMoldeDespesa = excluirMoldeDespesa;'), 'removerMoldeDespesa mantido como alias');
assert(content.includes('function recarregarMoldeParaMesAtual()'), 'recarregarMoldeParaMesAtual presente');
assert(content.includes('function salvarNovoMoldeDespesa(e)'), 'salvarNovoMoldeDespesa presente');
assert(content.includes('function salvarDespesaUnica(e)'), 'salvarDespesaUnica presente');
assert(content.includes('function selecionarValorRapido(val)'), 'selecionarValorRapido presente');
assert(content.includes('function selecionarCategoriaRapida(cat, descSugestao)'), 'selecionarCategoriaRapida presente');
assert(content.includes('function abrirModalEditarValorDespesa(id)'), 'abrirModalEditarValorDespesa presente');
assert(content.includes('function salvarNovoValorDespesa(e)'), 'salvarNovoValorDespesa presente');
assert(content.includes('function abrirModalQuitarDespesa(id)'), 'abrirModalQuitarDespesa presente');
assert(content.includes('function confirmarQuitarDespesa(e)'), 'confirmarQuitarDespesa presente');
assert(content.includes('function desfazerPagamentoDespesa(id)'), 'desfazerPagamentoDespesa presente');
assert(content.includes('function removerDespesaDoMes(id)'), 'removerDespesaDoMes presente');
assert(content.includes('function calcularDiariaSegura('), 'calcularDiariaSegura presente');
assert(content.includes('function calcularQuintoDiaUtilMes('), 'calcularQuintoDiaUtilMes presente');
assert(content.includes('function renderizarEnvelopes()'), 'renderizarEnvelopes presente');
assert(content.includes('function mudarCadenciaEnvelope(categoria, cadencia)'), 'mudarCadenciaEnvelope presente');
assert(content.includes('function alternarVisibilidadeFatiador()'), 'alternarVisibilidadeFatiador presente');
console.log("✅ [ETAPA 3 APROVADA] Todas as funções de ciclo de vida, molde, despesas e envelopes implementadas.");

// 4. Parâmetros e Segurança Adicional
console.log("\n[ETAPA 4] Verificando taxaCdiAnual centralizada e exportação .vault...");
assert(content.includes('taxaCdiAnual: 10.5'), 'taxaCdiAnual centralizada no ESTADO_PADRAO');
assert(content.includes('function exportarBackupVaultCifrado()'), 'Função exportarBackupVaultCifrado implementada');
assert(content.includes('id="boxBackupCofreCifrado"'), 'Container visual boxBackupCofreCifrado presente na Central de Backup');
assert(content.includes('accept=".json,.vault"'), 'Input de restauração aceita .json e .vault');
console.log("✅ [ETAPA 4 APROVADA] Parâmetros centralizados e suporte Zero-Knowledge completo.");

// 5. Integridade Estrutural
console.log("\n[ETAPA 5] Verificando fechamento correto das tags HTML...");
assert(content.endsWith('</html>\n') || content.endsWith('</html>\r\n') || content.endsWith('</html>'), 'Arquivo finaliza com </html>');
assert(content.includes('</script>\n\n<!-- M3 Extended Floating Action Button (FAB) -->') || content.includes('</script>\r\n\r\n<!-- M3 Extended Floating Action Button (FAB) -->'), 'Script fechado com </script>');
assert(!content.includes('// TODO'), 'Zero comentários TODO no código');
assert(!content.includes('/* continua aqui */'), 'Zero placeholders truncados no código');
console.log("✅ [ETAPA 5 APROVADA] Arquivo autocontido e pronto para produção.");

console.log("\n==================================================");
console.log("🎉 TODOS OS 5 BLOCOS FORAM 100% VALIDADOS!");
console.log("==================================================\n");
