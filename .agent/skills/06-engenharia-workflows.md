# 6. Engenharia de Software, Workflows e Operações Defensivas

## Princípios Arquiteturais e Execução Orientada a Evidências

A excelência em engenharia apoia-se em determinismo, verificação empírica contínua e tolerância zero a regressões silenciosas. Todo ciclo de modificação de código deve ser estritamente baseado em evidências antes, durante e após a intervenção. Modificações em bases de código em produção exigem isolamento cirúrgico de escopo: primeiro constrói-se o diagnóstico do estado de falha ou baseline de testes, aplica-se o diff estritamente necessário para satisfazer o requisito e comprova-se o sucesso através de testes automatizados e comandos de verificação reprodutíveis.

---

## 1. Padrões de Refatoração & Eliminação Segura de Código Morto (Refactor Clean)

A refatoração contínua preserva a sanidade da arquitetura, mas nunca deve ser executada simultaneamente à introdução de novas funcionalidades (*Separation of Concerns*).

### Classificação de Risco de Remoção (Tiering)
- **SAFE (Baixo Risco):** Funções utilitárias puras não exportadas, helpers de testes obsoletos, código interno comprovadamente sem referências. Deleção direta após validação de testes.
- **CAUTION (Médio Risco):** Componentes UI, rotas de API, hooks e middlewares. Exige busca exaustiva por chamadas dinâmicas (`import()`, injeção por string, registros em tabelas de rotas).
- **DANGER (Alto Risco):** Arquivos de configuração, esquemas de tipos públicos, pontos de entrada (entry points) e adaptadores de runtime. Nunca remover sem auditoria explícita de impacto e aprovação.

### Ciclo de Deleção Cirúrgica Atômica
1. **Baseline de Validação:** Executar suite de testes para garantir estado 100% verde antes de qualquer remoção.
2. **Deleção Atômica:** Remover um único elemento de cada vez via edição cirúrgica (nunca efetuar limpezas em lote cego).
3. **Re-execução de Testes:** Validar imediatamente se o sistema permanece íntegro.
4. **Rollback Imediato:** Se qualquer teste falhar, abortar a remoção (`git checkout -- <arquivo>`) e documentar a dependência oculta.
5. **Consolidação de Duplicatas:** Funções com mais de 80% de similaridade devem ser unificadas em abstrações compartilhadas reais (evitando generalizações especulativas - YAGNI).

---

## 2. Automação de Testes e Metodologia TDD Rigorosa (Test-Driven Development)

O desenvolvimento orientado por testes é a garantia matemática contra regressões. O código de produção só existe para satisfazer um teste que falhou previamente.

### O Ciclo RED-GREEN-REFACTOR
1. **RED (Teste Primeiro):** Escrever o teste unitário, de integração ou E2E definindo o comportamento esperado antes de qualquer linha de implementação. Executar o teste e comprovar que ele FALHA com o motivo exato esperado.
2. **GREEN (Implementação Mínima):** Escrever a menor quantidade de código possível para fazer o teste passar. Não antecipar otimizações ou cenários secundários.
3. **REFACTOR (Melhoria Contínua):** Limpar o código, eliminar duplicações, melhorar legibilidade e aplicar tipagem rigorosa, garantindo que todos os testes continuem passando incondicionalmente.

### Estrutura Canônica AAA (Arrange, Act, Assert)
Todo teste automatizado deve segregar claramente três blocos lógicos:
```javascript
test("deve calcular o rendimento do saldo bancário com base no percentual do CDI", () => {
  // Arrange (Preparação do cenário)
  const conta = { saldo: 1000.00, rendeJuros: true, pctCDI: 100 };
  const taxaDiaria = 0.00045; // Exemplo hipotético

  // Act (Execução da unidade de lógica)
  const rendimento = calcularRendimentoDiario(conta, taxaDiaria);

  // Assert (Verificação determinística dos resultados)
  expect(rendimento).toBeCloseTo(0.45, 2);
});
```

### Critérios de Nomenclatura de Testes
Os nomes de testes devem ser sentenças autoexplicativas que declaram a garantia comportamental:
- `test("deve rejeitar transação Pix quando o saldo for insuficiente")`
- `test("deve disparar feedback háptico ao confirmar a quitação da despesa")`
- `test("deve sanitizar chaves reservadas (__proto__) ao importar payload de backup")`

### Meta de Cobertura
- Cobertura mínima de **80%** de linhas e branches para lógicas de negócio críticas (cálculos financeiros, regras de validação, controle de sessão, criptografia e parsing de dados).

---

## 3. O Loop de Verificação Contínua (Verification Loop)

Antes de considerar qualquer entrega ou pull request pronto, a esteira de verificação local deve cumprir 6 fases mandatórias e sequenciais:

```
[Fase 1: Build] ──► [Fase 2: Tipagem] ──► [Fase 3: Linting] ──► [Fase 4: Testes/Coverage] ──► [Fase 5: Segurança] ──► [Fase 6: Diff Review]
```

1. **Fase 1 (Build):** Compilação e empacotamento livre de erros (`npm run build` ou validação de integridade sintática `node -c`).
2. **Fase 2 (Tipagem/Typecheck):** Análise estática estrita (`tsc --noEmit` ou linters de tipo) sem warnings suprimidos arbitrariamente.
3. **Fase 3 (Linting & Estilo):** Formatação consistente e conformidade com regras de qualidade sem ignorar erros com flags permissivas.
4. **Fase 4 (Suite de Testes & Cobertura):** Execução da suite completa de testes garantindo taxa de aprovação de 100% e cobertura mínima de 80%.
5. **Fase 5 (Varredura de Segurança & Segredos):** Auditoria estática em busca de chaves de API (`sk-`, `bearer`), tokens de acesso, credenciais hardcoded e logs com dados confidenciais (`console.log(senha)`).
6. **Fase 6 (Revisão de Diff):** Inspeção de `git diff --stat` e `git diff` linha a linha para certificar que nenhum arquivo não intencional ou alteração supérflua foi incluída.

---

## 4. Convenção Padronizada de Commits & Git Workflow

Seguimento rigoroso da convenção **Conventional Commits (v1.0.0)** para histórico legível e rastreabilidade total.

### Estrutura Canônica
```
<tipo>(<escopo opcional>): <descrição no imperativo e em minúsculas>

[corpo explicativo opcional: contextualiza o porquê e a motivação da mudança]

[rodapé opcional: referências a issues, breaking changes, etc.]
```

### Tipos Permitidos
- `feat`: Nova funcionalidade para o usuário final.
- `fix`: Correção de bug ou falha no sistema.
- `refactor`: Alteração de código que não corrige bug nem adiciona funcionalidade.
- `test`: Adição ou correção de testes automatizados.
- `style`: Ajustes estritamente cosméticos, formatação, espaçamento (sem impacto funcional).
- `perf`: Melhoria de desempenho ou otimização de processamento.
- `chore`: Atualização de tarefas de build, pacotes, ferramentas de desenvolvimento.
- `ci`: Alterações nos scripts de integração contínua ou automação de pipeline.
- `build`: Modificações que afetam o sistema de compilação ou dependências externas.
- `revert`: Reversão de commit anterior.

### Regras de Ouro de Commit
- O cabeçalho (header) não deve exceder **100 caracteres**.
- A descrição deve iniciar com verbo de ação em letras minúsculas (nunca Capitalizada ou com ponto final): `fix(auth): sanitizar chaves de protótipo no backup` em vez de `Fix: backup fix.`.
- Commits atômicos: cada commit deve representar uma única unidade lógica e reversível de trabalho.

---

## 5. Operações de Terminal Baseadas em Evidências & Caça a Falhas Silenciosas

### Workflow de Operação de Terminal (Terminal Ops)
Ao executar comandos no ambiente do projeto:
1. **Inspecionar Primeiro:** Compreender o erro ou log fornecido antes de tentar execuções cegas.
2. **Resolver uma Falha por Vez:** Focar no erro raiz que bloqueia a esteira; não tentar consertar múltiplos sintomas dispersos simultaneamente.
3. **Estado Declarativo de Execução:** Toda entrega deve reportar claramente seu estado atual:
   - `inspected` (diagnosticado)
   - `changed locally` (modificado localmente)
   - `verified locally` (validado e testado com sucesso localmente)
   - `committed` (registrado em commit local)
   - `pushed` (enviado com sucesso ao remoto)
   - `blocked` (impedido por dependência externa ou decisão técnica)

### Tolerância Zero a Falhas Silenciosas (Silent Failure Hunting)
- **Catch Vazio Proibido:** É estritamente vedado o uso de `catch(e) {}` sem tratamento, telemetria contextual ou notificação acionável.
- **Fallbacks Mascaradores Vedados:** Evitar `.catch(() => [])` ou retornos padrão nulos que escondam erros de rede ou de banco de dados, transformando exceções reais em bugs invisíveis a jusante.
- **Preservação de Stack Trace:** Ao reencaminhar erros, preservar a causa original (`throw new Error("Falha ao salvar", { cause: err })`).

---

## Tabela de Parâmetros e Tokens Normativos de Engenharia

| Domínio de Engenharia | Parâmetro Normativo | Implementação Obrigatória | Risco Mitigado Principal |
| :--- | :--- | :--- | :--- |
| **Metodologia de Testes** | Cobertura Mínima | `Coverage >= 80%` (Lines & Branches) | Regressões ocultas em lógicas financeiras e de negócio. |
| **Padrão de Teste** | Estrutura de Asserção | Padrão AAA (`Arrange`, `Act`, `Assert`) | Testes confusos, frágeis e com efeitos colaterais. |
| **Qualidade de Código** | Imutabilidade de Estado | Criação de novos objetos (`structuredClone`, spread) | Efeitos colaterais acidentais e mutação de estado global. |
| **Complexidade** | Limite de Funções | Máximo de 50 linhas por função lógica | Código espaguete e dificuldade de teste unitário. |
| **Manutenibilidade** | Limite de Módulos | Teto suave de 400 a 800 linhas por arquivo fonte | Acoplamento excessivo e perda de coesão arquitetural. |
| **Commits** | Conventional Commits | `<type>(<scope>): <subject>` (máx 100 caracteres) | Histórico de versão ilegível e falhas de rastreabilidade. |
| **Resiliência** | Gestão de Erros | Proibição de catch vazio e fallbacks cegos | Degradação silenciosa de dados e exceções mascaradas. |

---

## Checklist Booleano de Validação Técnica

- [ ] **PASS**: Todos os testes unitários da alteração foram executados e aprovados antes de qualquer declaração de sucesso.
- [ ] **PASS**: O commit segue rigorosamente o formato `<type>(<scope>): <descrição>`, em minúsculas e com até 100 caracteres.
- [ ] **PASS**: Todo bloco `catch` trata o erro explicitamente, fornece mensagem de contexto e preserva a causa raiz.
- [ ] **PASS**: A remoção de código seguiu o ciclo de deleção atômica com testes verdes antes e depois da operação.
- [ ] **PASS**: O `git diff` foi auditado e comprova a inexistência de arquivos indesejados, logs acidentais ou credenciais.
- [ ] **FAIL**: Submeter commit com mensagens genéricas como `fix`, `update`, `wip` ou `ajustes`.
- [ ] **FAIL**: Engolir exceções em blocos `try/catch` vazios ou com `.catch(() => {})`.
- [ ] **FAIL**: Mutar objetos de estado globais diretamente no lugar de retornar novos estados imutáveis.
- [ ] **FAIL**: Afirmar que uma tarefa foi concluída ou corrigida sem ter executado o comando de teste ou validação técnica correspondente.

---

## Links Oficiais Canônicos

- [Conventional Commits v1.0.0 - Especificação Oficial](https://www.conventionalcommits.org/en/v1.0.0/)
- [Martin Fowler - Refactoring and Code Smells](https://refactoring.guru/refactoring)
- [Kent Beck - Test-Driven Development by Example](https://www.oreilly.com/library/view/test-driven-development/0321146530/)
- [Google Testing Blog - Test Automation & Code Health](https://testing.googleblog.com/)
- [Node.js Best Practices - Error Handling & Defensive Coding](https://github.com/goldbergyoni/nodebestpractices)

---

## Exemplo Mínimo Ideal: Módulo Defensivo com TDD e Tratamento Estrito

```javascript
/**
 * @file calculo-juros.js
 * Exemplo de função pura, imutável, com validação de limites e erro explícito.
 */

export function aplicarRendimentoMensal(saldoAtual, taxaCDIAnual, percentualAplicado) {
  // 1. Validação estrita de limites numéricos (Fail Fast)
  if (!Number.isFinite(saldoAtual) || saldoAtual < 0) {
    throw new TypeError("O saldo atual deve ser um número real positivo.");
  }
  if (!Number.isFinite(taxaCDIAnual) || taxaCDIAnual < 0) {
    throw new TypeError("A taxa CDI anual deve ser um percentual positivo.");
  }
  if (!Number.isFinite(percentualAplicado) || percentualAplicado < 0) {
    throw new TypeError("O percentual de aplicação sobre o CDI deve ser positivo.");
  }

  // 2. Cálculo determinístico imutável (taxa proporcional mensal)
  const taxaEfetivaAnual = (taxaCDIAnual / 100) * (percentualAplicado / 100);
  const taxaMensal = Math.pow(1 + taxaEfetivaAnual, 1 / 12) - 1;
  const rendimento = saldoAtual * taxaMensal;
  const novoSaldo = saldoAtual + rendimento;

  // 3. Retorno de novo registro imutável com arredondamento seguro
  return {
    saldoAnterior: Math.round(saldoAtual * 100) / 100,
    rendimento: Math.round(rendimento * 100) / 100,
    novoSaldo: Math.round(novoSaldo * 100) / 100
  };
}
```
