# 5. Benchmarking de Produtos de Classe Mundial e Análise de Disparidades (Gap Analysis)

## Metodologia de Engenharia para Gap Analysis de UI/UX

A avaliação comparativa contra produtos de excelência (tais como referências de mercado mapeadas pelo Mobbin e aplicações distinguidas pelo Apple Design Awards) exige uma metodologia quantitativa para analisar diferenças de usabilidade e arquitetura³². A matriz de maturidade adota as seis dimensões avaliadas pelo Apple Design Awards: Inclusão (*Inclusivity*), Deleite (*Delight and Fun*), Interação (*Interaction*), Impacto Social (*Social Impact*), Aspeto Gráfico (*Visuals and Graphics*) e Inovação (*Innovation*)³². Cada uma destas áreas é convertida em pontos de auditoria técnica no fluxo avaliado.

A execução do processo estrutura-se em quatro fases metodológicas contínuas:
1. **O Mapeamento do Fluxo Atual** decompõe o percurso do utilizador nos seus estados atómicos, registando tempos de carregamento, nós de decisão e pontos de transição de tela.
2. **A Extração do Padrão de Classe Mundial** compila dados homólogos a partir de líderes de mercado no repositório Mobbin, estabelecendo referências de cadência temporal e contagem total de toques até à finalização da tarefa (*taps-to-completion*).
3. **A Identificação de Disparidades (*Gap Identification*)** compara diretamente as métricas de tempo total de tarefa (*Time to Complete* - TTC), taxa de sucesso de execução (*Task Completion Rate* - TCR) e métricas vitais da Web (como *Interaction to Next Paint* - INP e *Cumulative Layout Shift* - CLS).
4. **A Matriz de Priorização** baseada no modelo RICE (*Reach, Impact, Confidence, Effort*), convertendo fragilidades de interface em requisitos funcionais priorizados para a equipa de engenharia.

---

## Tabela de Parâmetros e Tokens Obrigatórios

| Dimensão de Auditoria | Métrica Quantitativa / Limiar | Referência de Excelência (Benchmark) | Impacto no Utilizador |
| :--- | :--- | :--- | :--- |
| **Latência de Feedback Tátil** | $< 50\text{ms}$ pós-interação | Resposta imediata por animação ou feedback háptico | Confirmação percetual da receção do comando de toque. |
| **Tempo de Resposta (INP)** | $\le 200\text{ms}$ (Interação com o Próximo Paint) | Classificação Good nas métricas Core Web Vitals | Fluidez do processamento no segmento principal de execução. |
| **Toques até à Conclusão** | Desvio $\le 1.2\times$ face ao padrão Mobbin | Fluxos simplificados de checkout (ex.: Stripe Checkout) | Redução substancial do atrito de abandono transacional. |
| **Conclusão de Tarefas (TCR)** | $\ge 95\%$ em ambiente de teste | Padrão mínimo de fluxos críticos de registo e pagamento | Eficácia operacional na conclusão da jornada do produto. |
| **Inclusão (Acessibilidade)** | $100\%$ de conformidade WCAG 2.2 AA | Categoria de Excelência Inclusivity (Apple Design Awards)³⁴ | Ausência de barreiras de consumo para utilizadores com deficiência. |
| **Estabilidade Visual (CLS)** | $\le 0.1$ Cumulative Layout Shift | Ausência de saltos em ecrã na injeção de imagens ou dados | Eliminação de erros de seleção acidental em botões móveis. |

---

## Checklist Booleano de Validação

- [ ] **PASS**: A jornada de checkout ou autenticação não possui mais de $1.2\times$ etapas do que o produto de referência comparado no Mobbin.
- [ ] **PASS**: Elementos acionáveis exibem microinterações ativas ou transições fluidas no exato momento da interação física ($< 50\text{ms}$).
- [ ] **PASS**: Todas as quebras visuais e tempos de espera assíncronos utilizam marcadores de carregamento (*skeleton screens*) proporcionais ao layout final, evitando indicadores circulares genéricos centralizados.
- [ ] **PASS**: O fluxo foi testado e validado quanto à retenção de dados durante regressões de ecrã ou quebras transitórias de rede celular.
- [ ] **FAIL**: Interromper a navegação do utilizador com bloqueios modais que demandam permissões acessórias fora de contexto (ex.: solicitar câmara sem o utilizador clicar na leitura de documentos).
- [ ] **FAIL**: Apresentar transições de layout desfasadas que alterem o posicionamento de alvos interativos durante o carregamento de imagens ou fontes ($\text{CLS} > 0.1$).
- [ ] **FAIL**: Reter o utilizador em processos cegos de espera sem indicação visual de progresso proporcional ou estado de processamento assíncrono.
- [ ] **FAIL**: Exigir que o utilizador insira novamente dados cadastrais já fornecidos em passos anteriores dentro da mesma sessão de navegação (violação do critério WCAG 2.2 3.3.7).

---

## Lista de Links Oficiais Canónicos

- [Apple Design Awards - Critérios Oficiais e Vencedores](https://developer.apple.com/design/awards/)
- [Mobbin - Diretório Canónico de Padrões e Fluxos Móveis/Web](https://mobbin.com/)
- [Nielsen Norman Group - Metodologias de Avaliação Comparativa de Usabilidade](https://www.nngroup.com/articles/benchmarking-usability/)
- [Web Vitals Specification - Métricas Oficiais de Desempenho de Interface](https://web.dev/vitals/)

---

## Exemplo de Código Mínimo Ideal

### JSON Schema (UIGapAnalysisReport)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "UIGapAnalysisReport",
  "type": "object",
  "required": [
    "auditMetadata",
    "benchmarkComparison",
    "metricsEvaluation",
    "gapMatrix"
  ],
  "properties": {
    "auditMetadata": {
      "type": "object",
      "required": ["productName", "auditedFlow", "benchmarkTarget", "date"],
      "properties": {
        "productName": { "type": "string" },
        "auditedFlow": { "type": "string" },
        "benchmarkTarget": { "type": "string" },
        "date": { "type": "string", "format": "date" }
      }
    },
    "benchmarkComparison": {
      "type": "object"
    },
    "metricsEvaluation": {
      "type": "object",
      "required": [
        "taskCompletionRate",
        "timeToCompleteSec",
        "interactionToNextPaintMs",
        "cumulativeLayoutShift"
      ],
      "properties": {
        "taskCompletionRate": { "type": "number", "minimum": 0, "maximum": 100 },
        "timeToCompleteSec": { "type": "number" },
        "interactionToNextPaintMs": { "type": "number" },
        "cumulativeLayoutShift": { "type": "number" }
      }
    },
    "gapMatrix": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "stepIdentified",
          "benchmarkBehavior",
          "currentFriction",
          "severity",
          "riceScore"
        ],
        "properties": {
          "stepIdentified": { "type": "string" },
          "benchmarkBehavior": { "type": "string" },
          "currentFriction": { "type": "string" },
          "severity": { "type": "string", "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          "riceScore": { "type": "number" }
        }
      }
    }
  }
}
```
