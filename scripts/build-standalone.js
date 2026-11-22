import fs from 'fs';
import path from 'path';
import { build } from 'vite';

const distDir = path.resolve('dist');
const standaloneTempDir = path.join(distDir, 'standalone-temp');

process.env.STANDALONE_BUILD = 'true';
await build({
  configFile: path.resolve('vite.config.ts'),
  logLevel: 'warn',
  build: {
    outDir: standaloneTempDir,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
});

const assetsDir = path.join(standaloneTempDir, 'assets');
const assetFiles = fs.readdirSync(assetsDir);

const jsFile = assetFiles.find(f => f.endsWith('.js'));
const cssFile = assetFiles.find(f => f.endsWith('.css'));

let cssContent = '';
if (cssFile) {
  cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
  // Sanitizar qualquer fechamento prematuro de tag style no bundle
  cssContent = cssContent.replace(/<\/style/gi, '<\\/style');
}

let jsContent = '';
if (jsFile) {
  jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
  // Sanitizar qualquer fechamento prematuro de tag script no bundle
  jsContent = jsContent.replace(/<\/script/gi, '<\\/script');
}

fs.rmSync(standaloneTempDir, { recursive: true, force: true });

// Montar um documento HTML autônomo e estritamente limpo:
// 1. Estilos inlined no <head>
// 2. Elemento <div id="root"></div> no <body>
// 3. Script JS posicionado no final do <body> (após o #root) para montagem síncrona perfeita no DOM
// 4. Zero scripts de redirecionamento para evitar loop
const standaloneHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="referrer" content="no-referrer" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* http://127.0.0.1:*; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';" />
    <title>FinTrack — Controle Financeiro Pessoal & Patrimonial</title>
    <meta name="description" content="Plataforma completa de controle financeiro pessoal, orçamento 50/30/20, gestão de caixinhas com juros compostos, contracheque, cartões de crédito e planejamento de aposentadoria FIRE." />
    <style>
${cssContent}
    </style>
    <script>
      (function() {
        try {
          var saved = localStorage.getItem('FINTRACK_M3_THEME');
          var isDark = saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
          if (isDark) {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          }
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script>
${jsContent}
    </script>
  </body>
</html>
`;

const outStandalone = path.join(distDir, 'standalone.html');
const outAppHtml = path.resolve('app.html');

fs.writeFileSync(outStandalone, standaloneHtml, 'utf8');
fs.writeFileSync(outAppHtml, standaloneHtml, 'utf8');

console.log(`✅ Standalone HTML gerado com sucesso!`);
console.log(`   - ${outStandalone} (${(standaloneHtml.length / 1024).toFixed(1)} KB)`);
console.log(`   - ${outAppHtml} (${(standaloneHtml.length / 1024).toFixed(1)} KB)`);
