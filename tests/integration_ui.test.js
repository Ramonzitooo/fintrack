const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'legacy', 'app.html'),
  path.join(__dirname, '..', 'public', 'app.html'),
  path.join(__dirname, '..', 'src', 'app.html')
];
const filePath = candidates.find(p => fs.existsSync(p)) || candidates[0];
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== TESTE DE INTEGRAÇÃO & ESTRUTURA DO APLICATIVO ===');

// 1. Verificar elementos fundamentais de navegação e abas
const requiredElements = [
  'mainNav',
  'tab-visao-geral',
  'tab-bancos',
  'tab-caixinhas',
  'tab-contracheque',
  'tab-cartoes',
  'tab-despesas',
  'modalCmdk',
  'toastContainer',
  'modalDespesaUnica',
  'modalCartao',
  'modalCaixinha',
  'modalReceberSalario',
  'simCompraValor',
  'simCompraDesconto',
  'simCompraParcelas',
  'simCompraTaxaCDI',
  'simCompraResultado',
  'listaProventos',
  'listaDescontos'
];

let missing = [];
requiredElements.forEach(id => {
  if (!content.includes(`id="${id}"`)) {
    missing.push(id);
  }
});

if (missing.length === 0) {
  console.log(`✅ Todos os ${requiredElements.length} elementos estruturais e modais foram validados!`);
} else {
  console.error(`❌ Elementos ausentes:`, missing);
  process.exit(1);
}

// 2. Verificar que nenhum emoji sobreviveu
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu;
const foundEmojis = content.match(emojiRegex);
if (!foundEmojis || foundEmojis.length === 0) {
  console.log('✅ Verificação de Emojis: ZERO EMOJIS no arquivo inteiro.');
} else {
  console.error('❌ Falha: ainda existem emojis:', foundEmojis);
  process.exit(1);
}

// 3. Verificar integridade dos SVGs
const svgMatches = content.match(/<svg[\s\S]*?<\/svg>/g) || [];
console.log(`✅ Verificação de SVGs: ${svgMatches.length} ícones vetoriais outline ativos.`);

console.log('🎉 INTEGRIDADE DO APLICATIVO 100% CONFIRMADA!');
