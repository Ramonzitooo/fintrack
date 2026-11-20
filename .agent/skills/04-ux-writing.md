# 4. UX Writing e Microcopy Estruturado

## Engenharia de Conteúdo e Frameworks de Usabilidade Textual

A redação para produtos digitais (UX Writing) opera como interface conversacional funcional, minimizando a sobrecarga cognitiva através de regras de clareza contextual. O Shopify Polaris estrutura o conteúdo em torno da escaneabilidade (*scannability*), orientando o texto para a ação objetiva e banindo jargões técnicos ou terminologias centradas na implementação do sistema³⁰. O Nielsen Norman Group (NN/g) determina quatro pilares para mensagens de erro: visibilidade explícita por indicadores multimodo (não dependendo apenas de cor), uso de linguagem natural acessível, tom cortês desprovido de atribuição de culpa ao utilizador e, fundamentalmente, orientação prescritiva para resolução imediata³¹. O Mailchimp Content Style Guide complementa este paradigma através da calibração entre voz (imutável e humana) e tom (maleável ao contexto emocional do utilizador, priorizando brevidade e sobriedade em pontos de falha operacional).

A comunicação técnica de exceções exige uma decomposição analítica precisa:
Uma mensagem de erro canónica articula-se em três partes: o relato factual do ocorrido, a sua causa imediata e o passo corretivo fornecido ao utilizador. A mensagem deixa de ser um mero aviso de falha e passa a funcionar como um guia para desbloqueio da interface. Em vez de emitir alertas crípticos do tipo *"Falha na transação. Parâmetros inválidos"*, a interface deve apresentar a informação de forma acionável: *"Não foi possível debitar o valor no seu cartão. O banco emissor recusou a operação por falta de saldo disponível. Utilize outro método de pagamento ou contacte a sua instituição bancária."*

Os estados vazios (*empty states*) não devem representar apenas a ausência temporária de dados, mas sim funcionar como momentos de indução de produtividade. Estruturam-se através de um título que contextualiza o estado atual, uma descrição que explicita o valor prático da funcionalidade e um gatilho de ação (*Call to Action* primário) que inicia a geração de dados.

A rotulagem de elementos interativos segue a sintaxe imperativa baseada na fórmula **[Verbo de Ação] + [Substantivo Contextual]**. Rótulos passivos, ambíguos ou abstratos como *"Submeter"*, *"OK"*, *"Processar"* ou *"Enviar"* são rejeitados, substituindo-se por comandos direcionados ao resultado concreto da interação, tais como *"Guardar Alterações"*, *"Transferir Ficheiro CSV"* ou *"Confirmar Transferência"*.

---

## Tabela de Parâmetros e Tokens Obrigatórios

| Componente Textual | Dimensão / Regra | Especificação Estrutural Obrigatória | Exemplo Não Conforme (Reprovado) | Exemplo Conforme (Aprovado) |
| :--- | :--- | :--- | :--- | :--- |
| **Mensagem de Erro** | Comprimento do Título | $\le 45$ carateres; direto ao ponto | "Ocorreu um problema grave no servidor" | "Não foi possível carregar os ficheiros" |
| **Mensagem de Erro** | Resolução Acionável | Presença obrigatória de instrução de contingência | "Falha de rede (0x80041)" | "Verifique a sua ligação à Internet e tente novamente" |
| **Estado Vazio** | Estrutura Canónica | Título + Proposta de Valor + CTA Primário | "Não há nada para ver aqui." | "Nenhum relatório criado. Crie um relatório para monitorizar as vendas diárias." |
| **Botão de Ação Primária** | Comprimento Máximo | $\le 25$ carateres; verbo de ação direto | "Clique aqui para finalizar" | "Concluir Pagamento" |
| **Botão de Confirmação** | Mapeamento Semântico | O verbo reflete o impacto exato da ação | "Sim / Não" | "Eliminar Conta" / "Manter Conta" |
| **Dica de Ferramenta** | Tempo de Leitura | $\le 100$ carateres; conteúdo meramente contextual | "Este botão serve para executar uma ação" | "Exporta os dados da tabela em formato CSV" |

---

## Checklist Booleano de Validação

- [ ] **PASS**: As mensagens de erro explicam com clareza o problema e definem o próximo passo concreto de resolução para o utilizador.
- [ ] **PASS**: Os botões de ação utilizam a estrutura sintática canónica composta por Verbo + Substantivo Contextual.
- [ ] **PASS**: Rótulos em modais de confirmação de exclusão declaram explicitamente a ação destrutiva ("Eliminar Documento" em vez de "Sim" ou "OK").
- [ ] **PASS**: Estados vazios integram uma chamada para a ação (*Call to Action*) construtiva orientada a preencher ou iniciar o conteúdo ausente.
- [ ] **FAIL**: Apresentar mensagens de erro que expõem códigos técnicos brutos sem explicação em linguagem natural (ex.: "Error: Status code 400 Bad Request").
- [ ] **FAIL**: Utilizar termos de atribuição de culpa ao utilizador (ex.: "Introduziu os dados errados", "Cometeu um erro").
- [ ] **FAIL**: Recorrer a rótulos passivos ou indefinidos em botões de envio de formulários (ex.: "Submeter", "Enviar", "Processar").
- [ ] **FAIL**: Criar estados vazios limitados a ícones ou textos informativos passivos sem indicar como originar dados na vista.

---

## Lista de Links Oficiais Canónicos

- [Shopify Polaris - Fundamentos de Conteúdo e UX Writing](https://polaris.shopify.com/content/actionable-language)
- [Nielsen Norman Group - Error Message Guidelines](https://www.nngroup.com/articles/error-message-guidelines/)
- [Nielsen Norman Group - Empty State Design Principles](https://www.nngroup.com/articles/empty-state-interface-design/)
- [Mailchimp Content Style Guide - Diretrizes de Voz e Tom](https://styleguide.mailchimp.com/voice-and-tone/)

---

## Exemplo de Código Mínimo Ideal

### TypeScript (Catálogo de Erros Estruturados e Acionáveis)

```typescript
export interface ActionableErrorSchema {
  id: string;
  category: "network" | "validation" | "authorization" | "server";
  title: string;
  explanation: string;
  action: {
    label: string;
    type: "retry" | "redirect" | "contact_support";
    targetUrl?: string;
  };
}

export const PaymentProcessingErrorCatalog: Record<string, ActionableErrorSchema> = {
  INSUFFICIENT_FUNDS: {
    id: "ERR_PAY_001",
    category: "validation",
    title: "Saldo Insuficiente",
    explanation:
      "A instituição bancária rejeitou a transação por falta de fundos na conta selecionada.",
    action: {
      label: "Selecionar Outro Cartão",
      type: "redirect",
      targetUrl: "/checkout/payment-methods"
    }
  },
  NETWORK_TIMEOUT: {
    id: "ERR_NET_002",
    category: "network",
    title: "Tempo de Resposta Esgotado",
    explanation:
      "Não foi possível estabelecer ligação segura com o gateway de processamento.",
    action: {
      label: "Tentar Novamente",
      type: "retry"
    }
  }
};
```
