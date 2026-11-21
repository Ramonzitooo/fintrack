# GEMINI.md — Documentação Técnica & Constituição do FinTrack

> **FinTrack — Plataforma de Soberania Financeira, Gestão Patrimonial e Segurança Zero-Knowledge**  
> *Versão:* 4.0 (React 19 + Vite 8) & 3.4 (Monólito Standalone) | *Padrão de Engenharia:* Clean Architecture, Defesa em Profundidade (OWASP), ECC e WCAG 2.2 AA.

---

## 1. Visão Geral do Projeto

O **FinTrack** é um ecossistema de inteligência financeira pessoal e planejamento patrimonial projetado sob a filosofia **100% Client-Side e PWA Offline-First** (CSP estrita e zero fontes externas).

A aplicação opera em duas frentes interoperáveis:
1. **Aplicação Principal (v4.0):** Construída em **React 19 + TypeScript + Vite 8 + Tailwind CSS v4**, modularizada em componentes reativos, tipagem estrita (`strict: true`), Cofre Zero-Knowledge AES-256-GCM (interoperável com `.vault` v3.4) e animações aceleradas via Motion.
2. **Aplicação Monolítica Standalone (v3.4):** Preservada em arquivo único ([`public/app.html`](./public/app.html)), operando em JavaScript Vanilla puro sem necessidade de build.

### Pilares Fundamentais
1. **Soberania e Privacidade:** Arquitetura *Zero-Knowledge* — nenhum dado financeiro trafega pela internet.
2. **Determinismo Financeiro:** Toda projeção patrimonial, curva de juros ou cálculo orçamentário é baseada em matemática financeira pura e comprovada, sem aproximações aleatórias.
3. **Ergonomia e Acessibilidade:** Interface fluida construída sobre os preceitos do **Google Material 3 (M3 Expressive)**, grade espacial de 8pt, monocromia estrita (zero emojis) e conformidade integral com WCAG 2.2 nível AA.
4. **Resiliência Defensiva:** Blindagem contra corrupção de estado, ataques de injeção de fórmulas CSV (CWE-1236) e *Prototype Pollution*.

---

## 2. Tecnologias Utilizadas

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STACK TÉCNICA DO FINTRACK                       │
├────────────────────────────────────────────────────────────────────────┤
│ • Camada Visual:   React 19 + TypeScript + Lucide React + Motion       │
│ • Camada Estilo:   Tailwind CSS v4 + Tokens HCT M3 Expressive          │
│ • Camada Build:    Vite 8 (ES2022 / Bundler) — Tempo de build < 500ms  │
│ • Versão Legado:   HTML5 + CSS3 + JS Vanilla autocontido (app.html)    │
│ • Armazenamento:   Web Storage (localStorage) + Cofre AES-256-GCM      │
│ • PWA & Blindagem: Offline-First (Service Worker + CSP + zero fontes externas) │
│ • Testes & CI/CD:  Node.js Native Test Suite (37 testes unitários TS: 28 financeMath + 9 cryptoVault + 6 suítes legado) │
└────────────────────────────────────────────────────────────────────────┘
```

### Detalhamento da Stack

* **Front-end & Interface:**
  * **HTML5 Semântico:** Uso rigoroso de tags semânticas (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<dialog>`), atributos `role="tablist"`, `role="tab"`, `role="dialog"` e regiões ao vivo `aria-live="polite"` para leitores de tela (TalkBack, NVDA e VoiceOver).
  * **CSS3 Nativo com Tokens HCT:** Sistema de variáveis CSS sem dependência de pré-processadores. Paleta tonal gerada pelo algoritmo HCT (*Hue, Chroma, Tone*) do Material 3, com suporte dinâmico a tema claro e escuro (`[data-theme="dark"]`) e pilha tipográfica nativa do sistema (**zero fontes externas**, garantindo operação **PWA Offline-First** sob **CSP** estrita).
  * **Runtime Modular v4.0 (`src/`):** **React 19 + TypeScript (`strict`) + Vite 8 + Tailwind CSS v4 + Motion**, compilado tanto para deploy PWA quanto para bundle standalone (`./app.html`).
  * **JavaScript Puro (Vanilla ES2022+) — Exclusivo do Monólito Legado (`public/app.html` v3.4):** Aplicado apenas à edição monolítica legada, sem React, Vue, Angular ou jQuery em runtime, mantendo inicialização instantânea (< 30ms) e consumo mínimo de memória RAM.

* **Segurança e Criptografia em Repouso (Ativo na v4.0 React via `src/utils/cryptoVault.ts` e interoperável com `.vault` da edição monolítica v3.4 `public/app.html`):**
  * **W3C WebCrypto API Nativa:** Criptografia operada na CPU do dispositivo.
  * **KDF (Key Derivation Function):** PBKDF2-HMAC-SHA256 com **600.000 iterações**, em conformidade estrita com as normas OWASP para derivação da chave mestra a partir da senha do usuário.
  * **Cifragem Autenticada (AEAD):** AES-GCM de 256 bits com Vetor de Inicialização (IV) de 96 bits (12 bytes) gerado via gerador pseudoaleatório criptograficamente seguro (`crypto.getRandomValues`) e tag de autenticação de 128 bits.
  * **Chaves Inextratíveis:** Objetos `CryptoKey` instanciados com `extractable: false`, impossibilitando o roubo de chaves brutas da memória através do console do navegador.
  * **Chave de Recuperação de 120 bits:** Entropia de 24 caracteres sob alfabeto base32 sem caracteres ambíguos (excluindo 0, O, 1, I).

* **Parsers Multimodais e Processamento Local (Edição Monolítica v3.4 `public/app.html`):**
  * **PDF.js (Mozilla):** Carregado sob demanda de forma assíncrona para extração de texto vetorial em contracheques e demonstrativos bancários.
  * **Tesseract.js:** Engine OCR executada em Web Workers dedicados para leitura ótica de contracheques escaneados ou imagens de holerites, processada 100% no cliente.

---

## 3. Design System & Acessibilidade

O FinTrack adota a especificação **Google Material 3 (M3 Expressive)** enriquecida com diretrizes do **Apple Human Interface Guidelines (HIG)** para dispositivos móveis.

### 3.1. Tokens Semânticos de Cor (Paleta HCT)
* **Primária (`--md-sys-color-primary`):** Esmeralda Financeiro (`#006D44` Claro / `#5DDC97` Escuro) — representa saúde do caixa, liquidez e sustentabilidade.
* **Secundária (`--md-sys-color-secondary`):** Floresta Neutra (`#4C6356` Claro / `#B2CCBC` Escuro) — botões auxiliares, tags e controles estruturais.
* **Terciária (`--md-sys-color-tertiary`):** Azul Safira (`#3D6373` Claro / `#A5CDDF` Escuro) — métricas de independência financeira (FIRE), metas e rendimento CDI.
* **Erro (`--md-sys-color-error`):** Coral de Alerta (`#BA1A1A` Claro / `#FFB4AB` Escuro) — déficits de liquidez, despesas vencidas e bloqueios.
* **Hierarquia de Superfícies Tonais:** Eliminação de drop-shadows pretos pesados em favor de superfícies tonais de 5 níveis (`surface-container-lowest` até `surface-container-highest`).

### 3.2. Grade Espacial e Tipografia
* **Grade Espacial 8pt / 4pt:** Todos os espaçamentos, margens e paddings seguem rigorosamente múltiplos de 8px e micro-espaçamentos de 4px (`--space-05` a `--space-8`), eliminando números mágicos.
* **Escala Tipográfica Hierárquica:** Pilha de fontes nativas do sistema (zero fontes externas, em conformidade com PWA Offline-First e CSP estrita), variando de Display Large (`font-display-lg`: 2.5rem/800) a Legendas (`font-label-sm`: 0.6875rem/700).
* **Tipografia Numérica Tabular Universal:** Todas as células de valores monetários, tabelas e badges utilizam `font-variant-numeric: tabular-nums lining-nums` e `font-feature-settings: "tnum" 1, "lnum" 1`. Isso garante que dígitos possuam a mesma largura física, eliminando qualquer tremulação (*jitter*) ou deslocamento de layout (*Layout Shift*) em atualizações em tempo real.

### 3.3. Conformidade Estética e Acessibilidade (WCAG 2.2 AA)
* **Política Tolerância ZERO para Emojis:** Todos os glifos de interface utilizam exclusivamente **ícones SVG Outline monocromáticos** da biblioteca Google Material Symbols, configurados com `fill="none"`, `stroke="currentColor"`, `stroke-width="2"` e `aria-hidden="true"`.
* **Alvos de Toque Mínimos de 48x48px (WCAG 2.5.8):** Botões compactos (`.btn-sm`), ícones interativos (`.btn-icon`) e chips de valor expandem sua área de acionamento invisível para no mínimo 48x48px via pseudo-elementos com `pointer-events: auto`.
* **Foco Visível de Alto Contraste:** Suporte total a navegação por teclado com indicador visual `:focus-visible` de 3px contínuo e anel de deslocamento (`outline-offset: 3px`).
* **Máscara Ótica do Modo Privacidade:** Mecanismo universal acionado pelo cabeçalho que aplica desfoque gaussiano (`filter: blur(8px)`) e bloqueio de seleção (`user-select: none`) sobre todos os saldos, aportes, holerites, envelopes e gráficos. Inclui comportamento *Quick-Peek* que desanuvia o valor momentaneamente ao passar o mouse (`:hover`) ou focar via teclado.

---

## 4. Estrutura de Telas, Navegação e Modais

A navegação primária organiza o ciclo financeiro do usuário em **6 abas canônicas**, complementadas por um **Command Palette global (`Ctrl+K`)** e **modais de operação assistida**.

```
[ HEADER SUPERIOR ] ──► Logo | Status Sync | Busca (Ctrl+K) | Privacidade | Cofre | Tema | Backup
      │
[ NAVEGAÇÃO DE ABAS ]
      ├── 1. Visão Geral (Cockpit Vital & Diária Segura)
      ├── 2. Bancos & Saldos (Custódia & Rendimento CDI)
      ├── 3. Caixinhas & Aposentadoria (Metas & FIRE)
      ├── 4. Contracheque (Folha, Horas de Vida & Deduções)
      ├── 5. Cartões (Melhor Cartão & Simulador CDI)
      └── 6. Despesas (Lançamentos, Envelopes & Molde)
```

### 4.1. As 6 Abas Principais

1. **Visão Geral (`tab-visao-geral`):**
   * **Cockpit Vital:** Cards consolidados de Salário Líquido, Contas Fixas do Mês, Patrimônio Guardado em Caixinhas e Saldo Livre Real com Badge de Saúde de Caixa (Saudável, Apertado ou Negativo).
   * **Diária Segura até o Próximo Salário:** Indicador proeminente que converte a sobra financeira em um teto diário de gastos com badge de ritmo (Folgado, Equilibrado, Apertado ou Sobra Esgotada).
   * **Termômetro do Ciclo 50/30/20:** Monitor visual da divisão da renda entre Essenciais ($\le 50\%$), Aportes ($\ge 20\%$) e Margem Residual.
   * **Matriz de Conciliação:** Balanço bidirecional cruzando custódia física (Bancos) com carimbos financeiros (Caixinhas, Contas a Pagar e Saldo Livre).
   * **Monitor de Velocidade das Caixinhas:** Previsão temporal de conclusão das metas com simulação *What-If*.
   * **Radar Operacional:** Recomendação do melhor cartão de crédito para compras no dia e anos até a independência financeira (FIRE).
   * **Mentor Financeiro Determinístico:** Painel de inteligência que analisa a distribuição do patrimônio e emite alertas comportamentais baseados em evidências.

2. **Bancos & Saldos (`tab-bancos`):**
   * Gestão de contas bancárias, contas de pagamento e carteira física com **edição inline (CRUD)** de instituição, modalidade, saldo e rentabilidade.
   * Classificação por modalidade: Corrente, Poupança, Investimentos ou Carteira.
   * Marcador de rentabilidade automática (Rende 100% CDI vs. Dinheiro Parado sem rendimento).
   * KPIs de liquidez total, volume rendendo juros e rendimento passivo mensal estimado.
   * Ação de Transferência Entre Contas com validação de saldo de origem.

3. **Caixinhas & Aposentadoria (`tab-caixinhas`):**
   * Arquitetura estratégica dos **3 Potes**: Reserva de Emergência (6 meses de despesas fixas), Metas de Médio Prazo e Aposentadoria Perpétua (FIRE).
   * Radar de Aposentadoria com cálculo do Patrimônio Crítico via SWR padrão de 4,0% a.a. (configurável em `src/`, 4,5% a.a. no monólito v3.4) e renda passiva perpétua.
   * Cards interativos de caixinhas com **edição inline (CRUD)**, progresso percentual, aporte mensal programado e botão de aporte rápido.

4. **Contracheque & Salário (`tab-contracheque`):**
   * Configuração da cadência de pagamento: 5º dia útil (com salto automático de sábados e domingos), dia fixo mensal ou data personalizada.
   * Discriminação de proventos (salário base, bonificações, extras) e descontos legais calculados automaticamente pelas **tabelas oficiais INSS/IRRF 2026 (Lei 15.270/2025)** com suporte a dependentes.
   * Botão de execução **"Receber Salário"**: credita o valor líquido na conta bancária de escolha e executa automaticamente as transferências para as caixinhas programadas.
   * **Motor Anti-Impulso de "Horas de Vida":** Converte o valor de qualquer compra no tempo líquido exato de trabalho necessário para quitá-la com base no valor-hora oficial da CLT.
   * Histórico de folhas de pagamento com relatórios de evolução salarial.

5. **Cartões de Crédito (`tab-cartoes`):**
   * Cadastro e **edição inline (CRUD)** de cartões com dias de fechamento/corte de fatura, dias de vencimento, limite e programa de fidelidade/pontos.
   * **Algoritmo da Janela de Ouro:** Aponta qual cartão oferece o maior prazo sem juros para uma compra realizada na data atual (até 35 a 40 dias de prazo).
   * **Simulador À Vista vs. Parcelado + CDI:** Avalia matematicamente se o desconto à vista supera o rendimento obtido ao manter o dinheiro na conta rendendo 100% do CDI durante as parcelas.

6. **Despesas, Receitas Avulsas, Envelopes & Dívidas (`tab-despesas`):**
   * Monitor da competência ativa: Total lançado, contas já quitadas, contas pendentes e progresso de quitação.
   * **Parcelas Multi-Mês (1x a 48x):** Geração automática de parcelas distribuídas nas competências futuras (`generateInstallmentExpenses`), com preservação de grupo de parcelamento e ajuste de centavos na primeira parcela.
   * **Receitas Avulsas Mensais (`receitasPorMes`):** Cadastro, marcação de recebimento e exclusão de entradas extras integradas ao fluxo de caixa.
   * **Simulador de Quitação de Dívidas (Avalanche vs. Bola de Neve):** Comparação determinística (`simulateDebtPayoff`) entre priorização por maior taxa de juros (*Avalanche*) e menor saldo devedor (*Bola de Neve*), exibindo prazo, juros totais e ordem de quitação.
   * **Fatiador Semanal de Envelopes:** Decomposição dos gastos variáveis mensais em metas de consumo semanal ou quinzenal para Supermercado, Lazer e Combustível.
   * **Lançamento Rápido em 1 Toque:** Chips ergonômicos com atalhos de valor (R$ 15, R$ 30, R$ 50, R$ 100, R$ 200).
   * **Molde de Despesas Fixas Recorrentes:** Cadastro de despesas molde (aluguel, condomínio, internet, luz) que são replicadas automaticamente a cada nova competência mensal.
   * Listagem de lançamentos com **edição inline (CRUD)**, status de quitação (Paga/Pendente), filtro por categorias e estorno automático com recomposição do saldo da conta bancária de débito.

---

### 4.2. Modais Operacionais do Sistema

| ID do Modal | Nome / Função | Descrição de Operação |
|---|---|---|
| `modalCmdk` | **Command Palette (`Ctrl+K`)** | Barra de busca e comandos rápidos estilo Raycast/Spotlight. Permite cadastrar despesas por linguagem natural (ex: *"almoço 35,50 débito nubank"*), navegar por atalhos e acionar funções do sistema. |
| `modalSeguranca` | **Central do Cofre Criptográfico** | Configuração da chave mestra (mínimo 8 caracteres), ativação/desativação da cifragem WebCrypto AES-GCM, visualização da Recovery Key de emergência e ajuste de tempo de auto-bloqueio por inatividade (2 a 30 min). |
| `modalBackup` | **Central de Dados & Backup** | Exportação de Backup Estruturado JSON (`schemaVersion: 3.4`), exportação de Planilha Consolidada CSV com cabeçalhos sanitizados, importação segura com higienização contra *prototype pollution* e reinicialização de fábrica com dupla confirmação. |
| `modalNovaDespesa` | **Cadastro de Despesa** | Inclusão de lançamentos avulsos com descrição, valor, data de vencimento, categoria, conta de débito e indicação de status inicial (paga ou pendente). |
| `modalNovoBanco` | **Cadastro de Conta Bancária** | Definição de instituição, modalidade da conta, saldo atual, taxa CDI e marcadores de rendimento automático. |
| `modalTransferencia` | **Transferência Entre Contas** | Movimentação financeira direta entre duas contas cadastradas com verificação de saldo disponível. |
| `modalNovaCaixinha` | **Criação de Meta / Caixinha** | Definição do nome do objetivo, pote estratégico (Emergência, Médio Prazo, FIRE), meta financeira, aporte mensal e instituição custodiante. |
| `modalAporteCaixinha` | **Aporte Direto em Caixinha** | Transferência de recursos de uma conta corrente para a caixinha selecionada com atualização simultânea do progresso. |
| `modalNovoCartao` | **Cadastro de Cartão de Crédito** | Registro de bandeira, limites, dia do corte e vencimento da fatura. |
| `modalNovoMolde` | **Molde de Contas Fixas** | Criação de despesas recorrentes automáticas mensais. |
| `modalReceberSalario` | **Efetivação de Salário** | Reconciliação do crédito do holerite na conta e distribuição programada das reservas. |
| `modalImportarHolerite` | **Importador de Folha via OCR/PDF** | Carregamento de PDF ou imagem do contracheque para parsing automatizado das rubricas. |
| `modalQuitarDespesa` | **Liquidação de Despesa** | Seleção da conta bancária de onde o recurso físico será debitado ao marcar uma conta como paga. |
| `modalRecoveryKey` | **Recuperação de Acesso** | Desbloqueio do cofre criptográfico utilizando a chave alfanumérica de emergência de 24 caracteres. |

---

## 5. Regras de Negócio e Modelagem Matemática

### 5.1. Regra da Diária Segura Antifrágil
A Diária Segura é o indicador tático mais importante do aplicativo. Para evitar que o usuário seja induzido a gastar acima de sua capacidade real, sua base de cálculo é rigorosamente travada pelo menor valor entre a sobra orçamentária projetada e a liquidez livre física existente nos bancos:

$$\text{Base para Diária} = \begin{cases} 
\min(\text{Sobra do Mês}, \max(0, \text{Saldo Livre Real})) & \text{se Salário Líquido} > 0 \\
\max(0, \text{Saldo Livre Real}) & \text{se Salário Líquido} = 0 
\end{cases}$$

$$\text{Diária Segura} = \frac{\text{Base para Diária}}{\max(1, \text{Dias Restantes até o Próximo Pagamento})}$$

* **Regra do 5º Dia Útil:** Na cadência padrão, o próximo pagamento é calculado ignorando sábados e domingos. Se o 5º dia útil do mês atual já transcorreu, o cálculo projeta automaticamente para o mês subsequente.

### 5.2. Equações Fundamentais de Liquidez e Patrimônio
A conciliação patrimonial adota a arquitetura de **Potes Segregados**: como os saldos bancários sofrem débito real nos aportes (`banco.saldo -= valor`), eles já representam a liquidez de giro livre, enquanto as caixinhas operam como custódia segregada:

$$\text{Saldo Livre Real} = \text{Total em Bancos} - \text{Contas Pendentes do Mês}$$

$$\text{Total Consolidado de Liquidez} = \text{Total em Bancos} + \text{Total em Caixinhas}$$

$$\text{Patrimônio Líquido Consolidado} = \text{Total Consolidado de Liquidez} - \text{Contas Pendentes} - \text{Total de Dívidas}$$

* **Critérios de Saúde de Caixa:**
  * **Caixa Negativo:** $\text{Saldo Livre} < 0$ $\implies$ badge de alerta crítico e exibição do botão de resolução de déficit.
  * **Caixa Apertado:** $0 \le \text{Saldo Livre} < 300$ $\implies$ badge de atenção amarela.
  * **Caixa Saudável:** $\text{Saldo Livre} \ge 300$ $\implies$ badge verde de estabilidade operacional.

### 5.3. Regra Orçamentária 50/30/20
A alocação da renda líquida é monitorada contra parâmetros normativos de saúde financeira:
* **Gastos Essenciais Fixos:** $\text{Alvo} \le 50\%$ da renda líquida.
* **Aportes e Poupança (Savings Rate):** $\text{Alvo} \ge 20\%$ da renda líquida.
* **Margem Residual Livre:** $\text{Alvo} \le 30\%$ da renda líquida.

### 5.4. Modelo de Independência Financeira (Aposentadoria FIRE)
Baseado na metodologia da Trinity University (*Safe Withdrawal Rate* — SWR calibrado para o mercado brasileiro de juros reais):
* **Taxa Segura de Retirada (SWR):** $4{,}0\%$ ao ano por padrão na v4.0 React (`DEFAULT_STATE.configuracoes.swrAnualPct`, configurável pelo usuário) e $4{,}5\%$ ao ano no monólito v3.4.
* **Patrimônio Crítico de Independência:**
  $$\text{Patrimônio Crítico} = \frac{\text{Despesas Anuais Fixas}}{\text{SWR}}$$
* **Projeção Temporal de Anos até a Aposentadoria:**
  Calculado via logaritmo da equação de amortização contínua com juros reais compostos ($r = 5\%$ a.a. $\implies r_{\text{mensal}} = (1 + 0{,}05)^{1/12} - 1$):
  $$n_{\text{meses}} = \frac{\ln\left(\frac{\text{Patrimônio Crítico} \cdot r + \text{Aporte Mensal}}{\text{Patrimônio Atual} \cdot r + \text{Aporte Mensal}}\right)}{\ln(1 + r)}$$
  $$\text{Anos Restantes} = \left\lceil \frac{n_{\text{meses}}}{12} \right\rceil$$

### 5.5. Divisor de "Horas de Vida" (Legislação Trabalhista — CLT Art. 64)
O aplicativo adota a regra legal do Descanso Semanal Remunerado (DSR) e a jurisprudência da Súmula 431 do TST:
* **Jornada de 44h semanais:** Divisor oficial de **220 horas mensais** ($\frac{44}{6} \times 30$).
* **Jornada de 40h semanais:** Divisor oficial de **200 horas mensais** ($\frac{40}{6} \times 30$).
* **Jornada de 36h semanais:** Divisor oficial de **180 horas mensais** ($\frac{36}{6} \times 30$).
* **Jornada de 30h semanais:** Divisor oficial de **150 horas mensais** ($\frac{30}{6} \times 30$).
* **Fórmula do Valor-Hora Líquido:**
  $$\text{Valor-Hora} = \frac{\text{Salário Líquido}}{\text{Divisor da Jornada}}$$
  $$\text{Tempo de Vida Necessário} = \frac{\text{Preço do Produto}}{\text{Valor-Hora}}$$

### 5.6. Simulador de Compras: À Vista vs. Parcelado + CDI
Avalia o custo de oportunidade mantendo o capital rendendo em títulos de liquidez diária a 100% do CDI ($\approx 10{,}5\%$ a.a.):
* O montante que seria gasto à vista permanece aplicado rendendo juros compostos mensais enquanto cada parcela mensal é subtraída do saldo remanescente.
* Se $\text{Valor à Vista} \le (\text{Valor Total Parcelado} - \text{Juros Acumulados no CDI})$, o veredito determinístico recomenda **Pagar à Vista**; caso contrário, recomenda **Parcelar no Cartão**.

### 5.7. Defesa contra Injeção de Fórmulas CSV (CWE-1236)
Toda exportação tabular (CSV) sanitiza individualmente cada célula via `sanitizeCsvCell()` (`src/utils/storage.ts`) e `sanitizarCelulaCSV()` (`legacy/app.html`):
* Qualquer dado que se inicie com caracteres executáveis em planilhas (`=`, `+`, `-`, `@`, `\t`, `\r`, `|`) recebe o prefixo de apóstrofo (`'`), forçando o software leitor (Excel, Calc, Numbers, Google Sheets) a interpretá-lo como texto puro literal.
* Todas as aspas duplas internas são escapadas duplicando-as (`""`) sob a RFC 4180.
* Os arquivos são gravados com Byte Order Mark UTF-8 (`\uFEFF`) e delimitador `;`.

---

## 6. Governança Multi-Agente & Protocolos de Engenharia

O desenvolvimento do FinTrack segue o protocolo de consenso multi-agente estabelecido no [`AGENTS.md`](./AGENTS.md), integrando os princípios de simplicidade de Karpathy e engenharia defensiva do ECC.

### 6.1. O Enxame de Subagentes Especializados

```
┌──────────────────────────────┬──────────────────┬──────────────────────────────────────────┐
│ Subagente                    │ Gatilho Operação │ Escopo e Superpoder                      │
├──────────────────────────────┼──────────────────┼──────────────────────────────────────────┤
│ fintrack-cashflow-sentinel   │ @DiariaSegura    │ Tesouraria, stress-testing de caixa      │
│ fintrack-wealth-engine       │ @FIRE            │ Juros compostos, metas e SWR 4.5%        │
│ fintrack-payroll-auditor     │ @Holerite        │ Auditoria salarial, horas de vida, CLT   │
│ fintrack-vault-sentinel      │ @SecVault        │ WebCrypto, anti-XSS, anti-CSV Injection  │
│ fintrack-m3-guardian         │ @M3UX            │ Material 3, WCAG 2.2 AA, Modo Privacidade│
└──────────────────────────────┴──────────────────┴──────────────────────────────────────────┘
```

### 6.2. Portão de Consenso Tripartite Obrigatório
Nenhuma funcionalidade, tela ou refatoração é considerada concluída (`STATUS: VERIFIED`) sem aprovação simultânea e independente:
1. **Implementação:** Desenvolvida sob os tokens semânticos M3 (`@UI`).
2. **Aval de Segurança (`@SecVault`):** Verificação de sanitização, integridade de estado e ausência de vazamento de segredos.
3. **Aval de Acessibilidade (`@M3UX`):** Verificação de contraste WCAG 2.2 AA, alvos de 48px e vedação completa de saldos no modo privacidade.

### 6.3. Lei de Verificação Prévia
Nenhuma conclusão de tarefa pode ser declarada sem evidência de teste executado no terminal. A suíte de testes do projeto (37 testes unitários TS: 28 `financeMath` + 9 `cryptoVault`, além das suítes legado) deve rodar e retornar código 0 antes de qualquer entrega:

```powershell
npm run lint; npm test; node tests/audit.js; node tests/backup_structure.test.js; node tests/financial_math.test.js
```

---

## 7. Estrutura de Diretórios do Repositório

```text
PROJETOS/APPS/APP FINANCEIRO/
├── .agent/
│   └── skills/                  # Biblioteca de habilidades de engenharia e governança
│       ├── 01-design-system.md  # Tokens M3, grade 8pt, layout mobile-first
│       ├── 02-acessibilidade.md # WCAG 2.2 AA/AAA, ARIA, foco e contraste
│       ├── 03-seguranca.md      # OWASP, criptografia, sanitização de entrada
│       ├── 04-ux-writing.md     # Microcopy, clareza e prevenção de erros
│       ├── 06-engenharia-workflows.md # TDD, refatoração atômica, testes
│       ├── 07-swarm-protocol.md # Topologias de enxame e consenso tripartite
│       ├── 09-engenharia-pragmatica.md # Filtro anti-inchaço e Karpathy
│       └── 10-ferramental-ambiente.md # Procedimentos operacionais de terminal
├── data/
│   └── dados.json               # Molde e semente de dados financeiros padrão
├── src/
│   ├── App.tsx                  # Orquestrador central React 19
│   ├── index.css                # Tokens M3 Expressive, Apple Fluid Design e Tailwind v4
│   ├── main.tsx                 # Ponto de entrada React
│   ├── README.md                # Contrato EGM do pacote src
│   ├── components/              # Componentes das 6 abas, modais (AppModals) e diagnóstico
│   └── utils/                   # Matemática financeira (financeMath.ts), Cofre AES-256-GCM (cryptoVault.ts), persistência (storage.ts) e 37 testes unitários TS (28 financeMath + 9 cryptoVault)
├── scripts/
│   └── build-standalone.js      # Empacotador do bundle autocontido (dist/standalone.html e app.html)
├── public/
│   └── app.html                 # Versão monolítica servida estaticamente
├── tests/
│   ├── audit.js                 # Auditoria contínua de qualidade (zero emojis, SVGs, sintaxe)
│   ├── backup_structure.test.js # Testes de schema 3.4, round-trip, CWE-1236 e prototype pollution
│   ├── financial_math.test.js   # Testes unitários das fórmulas financeiras e parsers
│   ├── integration_ui.test.js   # Verificação de integridade estrutural do DOM e modais
│   ├── refatoracao_etapas.test.js # Testes de regressão das etapas de refatoração
│   └── verify_theme_css.test.js # Verificação do bundle standalone e CSS de temas
├── AGENTS.md                    # Regras de conduta operacional e governança do enxame
├── GEMINI.md                    # Constituição do projeto, arquitetura e documentação técnica
└── README.md                    # Blueprint EGM raiz e guia de execução
```

---

*Documento gerado e verificado pelo ecossistema de engenharia Antigravity.*
