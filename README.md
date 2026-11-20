# FinTrack Blueprint — Plataforma de Controle Financeiro & Gestão Patrimonial

> **Ecossistema completo de inteligência financeira pessoal, orçamento 50/30/20, gestão de caixinhas com juros compostos, contracheque CLT, cartões de crédito e planejamento de aposentadoria FIRE.**
>
> **100% Client-Side, Zero-Knowledge e Offline-First — inicia com saldo limpo (`R$ 0,00`) e nenhum dado sai do seu dispositivo.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-006D44?style=for-the-badge&logo=githubpages&logoColor=white)](https://ramonzitooo.github.io/fintrack/)
[![Release](https://img.shields.io/badge/Download-Standalone_HTML-3D6373?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ramonzitooo/fintrack/releases/latest)
![React 19](https://img.shields.io/badge/React_19-TypeScript_%2B_Vite_8-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind v4](https://img.shields.io/badge/Tailwind_CSS-v4_M3_Tokens-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Zero Knowledge](https://img.shields.io/badge/Privacy-Zero_Knowledge-15803D?style=for-the-badge)

---

## 🌐 Acesso Online & Downloads Diretos

| Recurso | Descrição | Link Direto |
| :--- | :--- | :--- |
| **Aplicação Web (GitHub Pages)** | Acesse direto no navegador sem instalar nada | [Abrir FinTrack Online](https://ramonzitooo.github.io/fintrack/) |
| **Download Direto — App Standalone (`app.html`)** | Bundle React 19 completo em **1 único arquivo HTML** autocontido (abra offline no navegador) | [Download fintrack-standalone.html](https://github.com/Ramonzitooo/fintrack/releases/latest/download/fintrack-standalone.html) |
| **Download Direto — Versão Clássica Zero-Knowledge (`public/app.html`)** | Monólito v3.4 com cofre criptográfico AES-GCM 256-bit (PBKDF2 600k iterações) | [Download fintrack-legacy-vault.html](https://github.com/Ramonzitooo/fintrack/releases/latest/download/fintrack-legacy-vault.html) |
| **Todas as Versões & Pacotes** | Pacote ZIP completo para uso local e histórico de releases | [Ver Releases no GitHub](https://github.com/Ramonzitooo/fintrack/releases) |

---

## 🧩 Ferramentas e Módulos do FinTrack

O **FinTrack** organiza sua vida financeira em **6 abas operacionais**, uma central de **Diagnóstico Técnico**, **Command Palette (`Ctrl + K`)** e **Modo Privacidade (`P`)**:

### 1. 📊 Visão Geral (Cockpit Executivo & Orçamento 50/30/20)
- **KPIs em Tempo Real**: Saldo Livre Real (bancos menos contas pendentes), Patrimônio Líquido Consolidado, Cobertura de Reserva (em meses) e **Teto Antifrágil da Diária Segura** até o próximo pagamento.
- **Orçamento 50/30/20 Real**: Classificação automática entre *Essenciais (50%)*, *Estilo de Vida (30%)* e *Investimentos/Futuro (20%)*.
- **Distribuição Empilhada & Bússola FIRE**: Acompanhamento visual de liquidez livre vs. reservas custodiadas vs. contas pendentes.

### 2. 🏦 Bancos & Custódia de Liquidez
- **Gestão Multi-Contas**: Contas digitais, correntes, investimentos e dinheiro físico, com controle de remuneração em **% do CDI** (conversão composta exata $(1+i)^{1/12}-1$ com desconto regressivo de IR).
- **Transferências Internas (Pix)** e edição instantânea de saldos com suporte a desfazer (`Undo`).

### 3. 🎯 Caixinhas, Metas & Planejamento FIRE
- **Potes Segregados**: Reserva de Emergência, metas de viagem/objetivos e **Independência Financeira (FIRE)** com cálculo logarítmico de prazo acelerado por juros compostos.
- **Aportes & Resgates Simétricos**: Transferências diretas entre conta bancária e caixinha com atualização imediata de liquidez.

### 4. 💼 Contracheque CLT & Calculadora Anti-Impulso
- **Folha de Pagamento Editável**: Proventos, descontos, histórico mensal de holerites e distribuição direta do salário líquido para conta + caixinhas.
- **Cálculo Oficial Automático (1 Clique)**: Tabela progressiva oficial de **INSS e IRRF** com suporte a dependentes (`calculateOfficialPayrollTaxes`).
- **Calculadora Anti-Impulso ("Horas de Vida")**: Converte o preço de qualquer compra em horas/dias reais de trabalho líquido antes de decidir gastar.

### 5. 💳 Cartões de Crédito & Simulador À Vista vs. Parcelado
- **Melhor Cartão Hoje**: Calcula dinamicamente os dias reais de fôlego entre data de corte e vencimento.
- **Simulador Matemático À Vista vs. Parcelado + CDI**: Compara o desconto à vista contra manter o valor investido a % do CDI enquanto quita as parcelas.

### 6. 🧾 Despesas, Envelopes Vivos & Quitador de Dívidas
- **Molde de Contas Recorrentes**: Clona despesas fixas automaticamente a cada mudança de competência mensal, com quitação e estorno contábil simétrico.
- **Envelopes de Rotina**: Controle semanal/quinzenal/FDS para Supermercado, Lazer e Transporte conectado aos lançamentos reais do mês.
- **Planejador de Quitação de Dívidas**: Estratégias *Avalanche* (maior taxa de juros) e *Bola de Neve* (menor saldo).
- **Command Palette (`Ctrl + K`)**: Lançamento rápido por linguagem natural (ex.: `"almoço 45,90 pix"`).

### 7. 🔒 Privacidade & Blindagem Zero-Knowledge
- **Modo Privacidade (atalho `P`)**: Borra todos os valores monetários com desfoque óptico (`Quick-Peek` ao passar o mouse).
- **Backups Seguros**: Exportação/importação `.json` e `.csv` com proteção contra **Prototype Pollution** e **CSV Formula Injection (CWE-1236)**, além de cofre cifrado **AES-GCM 256-bit** na edição standalone clássica (`public/app.html`).

---

## System Overview

O **FinTrack** é uma aplicação de planejamento financeiro e gestão patrimonial construída sob arquitetura *Zero-Knowledge* e *Offline-First*. Opera em duas frentes sincronizadas:
1. **Aplicação Modular (v4.0 — React 19 + TypeScript + Vite 8 + Tailwind CSS v4):** Orquestrada em `./src/README.md` com componentes reativos, física fluida inspirada no Apple HIG / Material Design 3 e matemática financeira determinística.
2. **Aplicação Monolítica Standalone (v3.4 / Bundle Autocontido):** Preservada em `./public/app.html`, além do artefato compilado `./app.html` gerado por `./scripts/README.md`.

---

## Local Interface & Invariants

- `[vite.config.ts:default]`: Exporta a configuração do Vite (`defineConfig`) com `base: './'`, integrando `@vitejs/plugin-react` e `@tailwindcss/vite`, resolvendo o alias `'@'` para a raiz do repositório.
- `[vite.config.ts:server]`: Desativa HMR (`hmr: process.env.DISABLE_HMR !== 'true'`) e observação de arquivos (`watch: null`) quando `process.env.DISABLE_HMR === 'true'`.
- `[vite.config.ts:build.rollupOptions.output]`: Quando `process.env.STANDALONE_BUILD === 'true'`, desativa code-splitting (`codeSplitting: false`) para geração de bundle único; caso contrário, particiona dependências de `node_modules` via `manualChunks` (`'vendor-react'`, `'vendor-motion'`, `'vendor-icons'`, `'vendor-core'`).

---

## Subdirectories & System Boundaries

- **Aplicação React (`src`)**: [`./src/README.md`](./src/README.md) — Orquestrador central (`App.tsx`), roteamento acessível entre 6 abas canônicas, atalhos globais de teclado e sincronização de estado.
  - **Componentes de Interface (`src/components`)**: [`./src/components/README.md`](./src/components/README.md) — Views modulares das abas financeiras (`OverviewTab`, `BanksTab`, `GoalsTab`, `PayrollTab`, `CardsTab`, `ExpensesTab`), diagnóstico técnico (`AuditDiagnosticView`) e os 15 modais interativos (`AppModals`).
  - **Utilitários & Matemática (`src/utils`)**: [`./src/utils/README.md`](./src/utils/README.md) — Motor determinístico de matemática financeira (`financeMath.ts`), física de gestos e camada de persistência blindada (`storage.ts`).
- **Scripts de Empacotamento (`scripts`)**: [`./scripts/README.md`](./scripts/README.md) — Compilador pós-build (`build-standalone.js`) que embute CSS e JS do Vite em um único arquivo HTML autocontido (`./app.html` e `dist/standalone.html`).

---

## Global Invariants

- **Potes Segregados de Liquidez (`[src/utils/financeMath.ts:executeGoalTransfer]`, `[src/components/OverviewTab.tsx:OverviewTab]`)**: Saldos bancários (`bancos`) sofrem débito imediato nos aportes e representam liquidez livre de giro (`saldoLivre = totalBancos - contasPendentes`), enquanto `caixinhas` operam como custódia segregada (`patrimonioLiquido = totalBancos + totalCaixinhas - contasPendentes - totalDividas`).
- **Teto Antifrágil da Diária Segura (`[src/components/OverviewTab.tsx:OverviewTab]`)**: A base da Diária Segura nunca excede o menor valor entre a sobra orçamentária projetada do mês e o saldo livre real físico nos bancos (`Math.min(sobraPrevistaMes, Math.max(0, saldoLivre))`).
- **Simetria Contábil em Despesas (`[src/utils/financeMath.ts:payExpenseInList]`, `[src/utils/financeMath.ts:refundExpenseInList]`, `[src/utils/financeMath.ts:editExpenseAmountInList]`, `[src/utils/financeMath.ts:deleteExpenseFromList]`)**: Toda quitação, estorno, edição ou exclusão de despesa paga reconcilia simetricamente o saldo da conta bancária de origem e armazena snapshot via `structuredClone` para desfazer (`undo`).
- **Blindagem contra Prototype Pollution e CSV Injection (`[src/utils/storage.ts:safeJsonParse]`, `[src/utils/storage.ts:sanitizeCsvCell]`)**: Todo JSON importado ou lido do armazenamento local remove chaves `__proto__`, `constructor` e `prototype`; toda célula CSV iniciada por `=`, `+`, `-`, `@`, `\t`, `\r` ou `|` recebe prefixo `'`.

---

## Global Side Effects

- **Armazenamento Local (`localStorage`)**: Leitura e escrita da chave principal `'APP_FINANCEIRO_V2_DATA'` (`[src/utils/storage.ts:STORAGE_KEY]`), além das preferências visuais `'FINTRACK_PRIVACIDADE'` e `'FINTRACK_M3_THEME'` (`[src/App.tsx:useEffect]`).
- **Mutação de Classes no DOM Raiz (`[src/App.tsx:useEffect]`)**: Aplicação dinâmica de `'privacy-mode'` em `document.body` e `'dark'` + `data-theme` em `document.documentElement`.
- **I/O de Arquivos no Cliente (`[src/App.tsx:handleExportJSON]`, `[src/App.tsx:handleExportCSV]`, `[src/App.tsx:AppModals.onImportJSON]`)**: Exportação de backups `.json` e planilhas `.csv` via `Blob` + `URL.createObjectURL` e leitura local via `FileReader.readAsText` (zero tráfego de rede).

---

## System Verification

- Run: `npm test`
- Typecheck: `npm run lint`
- Build & Standalone Bundle: `npm run build`
- Legacy & Integration Suite:
  ```bash
  node tests/audit.js; node tests/backup_structure.test.js; node tests/financial_math.test.js; node tests/integration_ui.test.js; node tests/refatoracao_etapas.test.js; node tests/verify_theme_css.test.js
  ```

---

## 🚀 Como Executar Localmente

### Opção 1 — Uso Direto Sem Instalação (Standalone)
Baixe `fintrack-standalone.html` nos [Releases](https://github.com/Ramonzitooo/fintrack/releases/latest) (ou abra `./app.html` diretamente no navegador).

### Opção 2 — Ambiente de Desenvolvimento React 19
```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento (porta 3000)
npm run dev

# 3. Verificação de tipos TypeScript
npm run lint

# 4. Executar testes unitários de matemática financeira
npm test

# 5. Build de produção e geração do standalone (saída em dist/ e ./app.html)
npm run build
```

Acesse no navegador: `http://localhost:3000`

---

## 👤 Autor

**Ramon Cavalcanti** (`@Ramonzitooo`)
