# 7. Protocolos de Enxame, Auto-Orquestração e Consenso Multiagente (Swarm Protocols)

## Arquitetura de Coordenação e Topologias de Enxame (Swarm Topologies)

Sistemas multiagente autônomos resolvem problemas complexos de software através da distribuição especializada de competências sob coordenação estruturada. A divisão de responsabilidades previne a saturação de contexto (*context degradation*), alucinações cumulativas e regressões arquiteturais.

### Topologias de Coordenação Canônicas

```
     [ HIERÁRQUICA (Padrão) ]                     [ MALHA (Peer-to-Peer) ]
         ┌─────────────┐                            ┌───────┐     ┌───────┐
         │ Líder/Queen │                            │  @UI  │◄───►│ @A11y │
         └──────┬──────┘                            └───┬───┘     └───┬───┘
     ┌──────────┼──────────┐                            ▲             ▲    
     ▼          ▼          ▼                            └──────┬──────┘    
 ┌───────┐  ┌───────┐  ┌───────┐                               ▼           
 │  @UI  │  │ @Sec  │  │ @A11y │                           ┌───────┐       
 └───────┘  └───────┘  └───────┘                           │ @Sec  │       
                                                           └───────┘       
```

1. **Topologia Hierárquica (*Hierarchical / Queen-Worker Pattern* - Padrão de Engenharia):**
   - **Líder do Enxame (*Swarm Lead / Queen*):** Mantém o estado global, define o plano de entrega, arbitra conflitos e aplica as travas de qualidade (*Quality Gates*). Não executa código diretamente quando delega.
   - **Agentes Operários Especializados (*Specialized Workers*):** Agentes com papéis circunscritos (`@UI`, `@Sec`, `@A11y`, `@Dev`, `@Copy`, `@Bench`). Executam com ferramentas e escopos restritos, reportando evidências para o líder.
   - **Mitigação contra Deriva de Objetivo (*Anti-Drift Controls*):** Enxames restritos a 3 a 8 agentes simultâneos. Metas atômicas e curtas para evitar divergência de contexto em tarefas longas.

2. **Topologia em Malha (*Mesh / Consensus Network*):**
   - Comunicação horizontal direta entre operários para validação mútua rápida.
   - Utilizada para revisões cruzadas de pares (*Peer Code Review*) antes da submissão formal ao Líder.

3. **Topologia em Estrela / Radial (*Star Topology*):**
   - Despacho radial de tarefas paralelas independentes (ex.: execução de múltiplos benchmarks ou auditorias estáticas concorrentes).

---

## 2. Protocolos de Validação Cruzada & Consenso Obrigatório (Consensus & Quality Gates)

A autonomia do enxame depende de regras estritas de encerramento de tarefas. Nenhum agente executor pode auto-aprovar suas próprias alterações sem validação cruzada independente.

### O Portão de Consenso Tripartido (Mandatory Tripartite Consensus Gate)

Quando qualquer funcionalidade, tela, fluxo ou alteração estrutural for solicitada:

```
[Requisição de Tela/Feature]
             │
             ▼
   ┌───────────────────┐
   │    1. Execução    │ ──► @UI (Desenho e Implementação Visual/Funcional)
   └─────────┬─────────┘
             │ (Código implementado localmente)
             ▼
   ┌───────────────────┐
   │ 2. Voto Cruzado   │ ──► @Sec: Auditoria de Segurança, CSP, Injeção, XSS, Protótipos
   │   (Simultâneo)    │ ──► @A11y: Auditoria de Alvos 48px, Contraste, ARIA, Focus Trap
   └─────────┬─────────┘
             │
      Todos Aprovados?
        /          \
     SIM            NÃO (Veto)
      │               │
      ▼               ▼
┌───────────┐   ┌────────────────────────────────────────────────────────┐
│  PRONTO   │   │ Ciclo de Remediação Automática (@UI / @Dev corrige)    │
│ [STATUS:  │   │ e re-submete ao avaliador que vetou até obter consenso │
│  VERIFIED]│   └────────────────────────────────────────────────────────┘
└───────────┘
```

### Algoritmos de Consenso Operacionais
- **Quorum Qualificado Estrito (Unanimidade de Especialistas):** Para alterações em código de produção e telas do usuário, o consenso requer $100\%$ de aprovação dos validadores designados (`@Sec` AND `@A11y` = `PASS`).
- **Tolerância a Falhas Bizantinas (BFT - $f < n/3$):** Proteção contra alucinações de subagentes ou saídas malformadas; nenhuma decisão isolada pode quebrar o contrato do sistema de design ou as políticas de segurança.
- **Raft / Linearidade de Estado:** Apenas o Líder consolida commits e declara status de conclusão. Dois operários nunca escrevem concorrentemente no mesmo arquivo ou árvore de trabalho (*isolated workspaces*).

---

## 3. Gestão de Contexto e Protocolo Interagentes (Context Scoping & Messaging)

Para garantir escalabilidade e impedir poluição de contexto entre agentes:

1. **Isolamento de Escopos de Memória:**
   - **Escopo do Agente (*Local Worker Scope*):** Histórico de chamadas de ferramentas e rascunhos temporários pertencem unicamente ao subagente.
   - **Escopo Coletivo do Enxame (*Swarm Shared Context*):** Apenas relatórios estruturados, artefatos definitivos e diffs consolidados são repassados ao líder e aos demais membros do enxame.
2. **Contrato de Comunicação Orientado a Evidências (*Evidence-Based Messaging*):**
   Todo feedback de validação cruzada deve conter:
   - **Veredito:** `PASS`, `WARN` ou `FAIL / VETO`.
   - **Localização Exata:** Arquivo e intervalo de linhas (`app_m3.html:5880-5895`).
   - **Violação Específica:** Token, norma WCAG ou parâmetro OWASP infringido.
   - **Correção Prescritiva:** Bloco de código exato ou instrução atômica para resolução.
3. **Reconciliação e Veredito:**
   O Líder unifica as aprovações em uma matriz de decisão auditável antes de expor a resposta ao usuário.

---

## Tabela de Parâmetros e Tokens do Protocolo de Enxame

| Domínio de Enxame | Parâmetro Normativo | Implementação Obrigatória | Risco Mitigado Principal |
| :--- | :--- | :--- | :--- |
| **Topologia** | Coordenação Principal | Hierárquica (`Leader-Worker`) com Anti-Drift | Deriva de objetivo e tarefas incompletas. |
| **Escopo de Equipe** | Tamanho Máximo do Enxame | 3 a 8 agentes ativos por ciclo operacional | Sobrecarga de comunicação e estouro de contexto. |
| **Validação de Telas** | Portão Tripartido | `@UI` (Execução) + `@Sec` (Aval) + `@A11y` (Aval) | Lançamento de telas com falhas de acessibilidade ou brechas. |
| **Critério de Consenso** | Quorum de Liberação | Unanimidade dos avaliadores convocados (`PASS`) | Falso positivo e auto-aprovação de código deficiente. |
| **Direito de Veto** | Poder de Bloqueio | Veto unilateral de `@Sec` ou `@A11y` bloqueia o merge | Exposição de vulnerabilidades OWASP ou quebra de WCAG. |
| **Comunicação** | Formato de Feedback | Estrutura de Evidência (Alvo, Violação, Correção) | Críticas vagas sem ação corretiva direta. |

---

## Checklist Booleano de Validação do Enxame

- [ ] **PASS**: Toda tela ou componente novo recebeu o parecer explícito e independente de `@Sec` antes da entrega.
- [ ] **PASS**: Toda tela ou componente novo recebeu o parecer explícito e independente de `@A11y` antes da entrega.
- [ ] **PASS**: O ciclo de remediação foi executado e revalidado caso tenha ocorrido veto ou alerta crítico.
- [ ] **PASS**: O líder reportou a matriz consolidada de consenso evidenciando o status final (`VERIFIED`).
- [ ] **FAIL**: Entregar código ao usuário com a validação de `@Sec` ou `@A11y` pendente, omitida ou assumida sem verificação.
- [ ] **FAIL**: Permitir que o agente executor `@UI` ignore ou desconsidere apontamentos de veto de segurança ou acessibilidade.
- [ ] **FAIL**: Delegar escrita concorrente no mesmo arquivo para mais de um operário sem isolamento atômico.

---

## Links Oficiais Canônicos

- [Multi-Agent Consensus and Coordination Standards](https://github.com/ruvnet/ruflo)
- [W3C Architecture - Decentralized Autonomous Agent Systems](https://www.w3.org/)
- [Byzantine Fault Tolerance in Decentralized Systems (Lamport et al.)](https://lamport.azurewebsites.net/pubs/byz.pdf)
- [Raft Consensus Algorithm - Ongaro & Ousterhout](https://raft.github.io/)

---

## Exemplo Mínimo Ideal: Matriz de Consenso Tripartido em Runtime

```javascript
/**
 * Matriz de Decisão do Portão de Qualidade do Enxame
 */
const consensoTripartido = {
  tarefa: "Implementação de Novo Modal de Transação Financeira",
  timestamp: new Date().toISOString(),
  execucao: {
    agente: "@UI",
    status: "COMPLETED",
    artefato: "app_m3.html"
  },
  validacaoCruzada: {
    seguranca: {
      agente: "@Sec",
      criterios: ["CSP estrita", "Higienização de payload", "Zero XSS", "Anti-Prototype Pollution"],
      resultado: "PASS",
      notas: "Todos os inputs sanitizados com slice e tipagem estrita."
    },
    acessibilidade: {
      agente: "@A11y",
      criterios: ["Contraste 4.5:1", "Alvo 48x48px", "Focus Trap ESC/Tab", "ARIA Labels"],
      resultado: "PASS",
      notas: "Focus trap testado com activeElement fallback e botões com 48px mínimos."
    }
  },
  vereditoConsenso: {
    aprovado: true,
    statusFinal: "VERIFIED",
    prontoParaDeploy: true
  }
};
```
