const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(__dirname, '..', 'legacy', 'app.html'),
  path.join(__dirname, '..', 'public', 'app.html'),
  path.join(__dirname, '..', 'src', 'app.html')
];
const filePath = candidates.find(p => fs.existsSync(p)) || candidates[0];
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== AUDITORIA COMPLETA DE CÓDIGO, UI & ASSETS (SRC/APP.HTML) ===');
console.log('Tamanho total:', (content.length / 1024).toFixed(1), 'KB');

let hasError = false;

// 1. Emojis (Tolerância ZERO)
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu;
const emojis = content.match(emojiRegex);
console.log('\n[1] VERIFICAÇÃO DE EMOJIS:');
if (emojis && emojis.length > 0) {
  console.error(`❌ FALHA: Encontrados ${emojis.length} emojis no arquivo!`);
  hasError = true;
} else {
  console.log('✅ 100% livre de emojis (ZERO emojis encontrados).');
}

// 2. Ícones SVG Outline Monocromáticos
console.log('\n[2] VERIFICAÇÃO DE ÍCONES SVG MONOCROMÁTICOS:');
const svgTagRegex = /<svg([^>]*)>([\s\S]*?)<\/svg>/gi;
let match;
let totalSvgs = 0;
let invalidSvgs = 0;
while ((match = svgTagRegex.exec(content)) !== null) {
  totalSvgs++;
  const attrs = match[1];
  const hasFillNone = /fill="none"/i.test(attrs);
  const hasStrokeCurrentColor = /stroke="currentColor"/i.test(attrs);
  if (!hasFillNone || !hasStrokeCurrentColor) {
    invalidSvgs++;
  }
}
console.log(`Total de tags <svg>: ${totalSvgs}`);
if (invalidSvgs > 0) {
  console.error(`❌ FALHA: ${invalidSvgs} SVGs não seguem o padrão outline monocromático!`);
  hasError = true;
} else {
  console.log(`✅ 100% dos ${totalSvgs} ícones SVG seguem rigorosamente fill="none" e stroke="currentColor".`);
}

// 3. Sintaxe JavaScript
console.log('\n[3] SINTAXE DO SCRIPT JS:');
const scriptMatches = content.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
if (scriptMatches) {
  scriptMatches.forEach((s, idx) => {
    const jsCode = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    try {
      new Function(jsCode);
      console.log(`✅ Bloco script #${idx + 1}: Sintaxe válida sem erros (${jsCode.length} caracteres).`);
    } catch (e) {
      console.error(`❌ ERRO de sintaxe no bloco script #${idx + 1}:`, e.message);
      hasError = true;
    }
  });
}

// 4. Acessibilidade de Botões
console.log('\n[4] ACESSIBILIDADE DE BOTÕES DE ÍCONE:');
const buttonRegex = /<button[\s\S]*?<\/button>/gi;
let btnMatch;
let iconOnlyWithoutLabel = 0;
while ((btnMatch = buttonRegex.exec(content)) !== null) {
  const btn = btnMatch[0];
  const hasAria = /aria-label=/i.test(btn);
  const hasTitle = /title=/i.test(btn);
  const textContent = btn.replace(/<[^>]+>/g, '').trim();
  if (textContent === '' && !hasAria && !hasTitle) {
    iconOnlyWithoutLabel++;
  }
}
if (iconOnlyWithoutLabel > 0) {
  console.error(`❌ FALHA: ${iconOnlyWithoutLabel} botões de ícone sem rótulo acessível.`);
  hasError = true;
} else {
  console.log('✅ Todos os botões de ícone possuem rótulo acessível (aria-label).');
}

if (hasError) {
  console.error('\n❌ AUDITORIA FALHOU!');
  process.exit(1);
} else {
  console.log('\n🎉 TODAS AS REGRAS DE QUALIDADE FORAM APROVADAS COM SUCESSO!');
}
