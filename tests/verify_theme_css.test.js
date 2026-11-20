const fs = require('fs');
const path = require('path');

function runThemeCssAudit() {
  console.log('--- AUDITORIA DE CSS DO MODO ESCURO/CLARO (TAILWIND V4) ---');
  
  const standalonePath = path.resolve(__dirname, '../app.html');
  if (!fs.existsSync(standalonePath)) {
    throw new Error('Arquivo standalone não encontrado: ' + standalonePath);
  }

  const html = fs.readFileSync(standalonePath, 'utf8');
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) {
    throw new Error('Tag <style> não encontrada no arquivo standalone.');
  }

  const css = styleMatch[1];
  
  // In Tailwind v4, without `@custom-variant dark (&:where(.dark, .dark *));`:
  // The dark utilities are generated inside `@media (prefers-color-scheme:dark){.dark\:...`.
  // With `@custom-variant dark (&:where(.dark, .dark *));`:
  // The dark utilities are generated with `:where(.dark, .dark *)` and NOT inside prefers-color-scheme.
  const hasPrefersMediaWrapper = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{[^\}]*\.dark\\:/i.test(css);
  const hasClassSelectorScoping = /:where\(\.dark\b|\.dark\s+\.dark\\:|\.dark\.dark\\:/i.test(css);

  console.log('Possui regras dark presas em @media (prefers-color-scheme: dark)?', hasPrefersMediaWrapper ? 'SIM (BUG)' : 'NÃO');
  console.log('Possui regras dark ativadas pela classe .dark / seletor?', hasClassSelectorScoping ? 'SIM (CORRETO)' : 'NÃO');

  if (hasPrefersMediaWrapper || !hasClassSelectorScoping) {
    console.error('❌ FALHA (BUG CONFIRMADO): As classes dark: estão presas na media query do SO e não respondem à classe .dark!');
    process.exit(1);
  }

  console.log('✅ SUCESSO: O CSS compilado responde à classe .dark dinamicamente!');
  process.exit(0);
}

runThemeCssAudit();
