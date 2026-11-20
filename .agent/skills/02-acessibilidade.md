# 2. Acessibilidade Digital e Usabilidade Estrutural (a11y)

## Requisitos Normativos WCAG 2.2 e Matriz WAI-ARIA APG

A acessibilidade digital estabelece condições operacionais mensuráveis para assegurar a usabilidade por tecnologias assistivas e utilizadores com restrições motoras ou visuais. O rácio de contraste da WCAG 2.2 fundamenta-se na luminância relativa ponderada entre o primeiro plano e o fundo. Para conformidade de Nível AA (Critério 1.4.3), o rácio mínimo é de $4.5 : 1$ para texto regular (<18pt ou <14pt em negrito) e $3.0 : 1$ para texto de grandes dimensões ($\ge 18pt$ ou $\ge 14pt$ com peso em negrito), aplicando-se esta última métrica também a elementos gráficos ativos e componentes de interface essenciais (Critério 1.4.11). O patamar estrito de Nível AAA (Critério 1.4.6) eleva a exigência para $7.0 : 1$ em texto padrão e $4.5 : 1$ para texto grande.

Quanto à ergonomia de alvos interativos, a WCAG 2.2 introduziu o Critério 2.5.8 (Nível AA), que estabelece a dimensão física mínima de $24 \times 24$ píxeis CSS para alvos de toque, mitigando toques acidentais através da imposição de espaçamento perimétrico compensatório até elementos adjacentes. O Critério 2.5.5 (Nível AAA) eleva este limiar para $44 \times 44$ píxeis CSS, convergindo com as recomendações de contacto físico de plataformas nativas. A conformidade de foco (Critério 2.4.13 AAA) requer que o indicador visual apresente uma área de perímetro mínima contínua de 2 píxeis CSS com rácio de contraste $\ge 3.0 : 1$ entre os estados focado e não focado.

A semântica estrutural para leitores de ecrã (VoiceOver, NVDA, JAWS) exige conformidade estrita com o WAI-ARIA Authoring Practices Guide (APG):
Nas caixas de diálogo modais (`role="dialog"` ou `role="alertdialog"`), a raiz deve declarar `aria-modal="true"` e vincular os seus nós textuais descritivos via `aria-labelledby` e `aria-describedby`²⁰. O foco do teclado deve ser capturado no contentor através de armadilha de foco (*focus trap*), circulando ciclicamente com Tab e Shift+Tab. O acionamento da tecla Escape deve encerrar a camada e devolver o foco ao disparador.

No padrão de abas (*tabs*), o elemento circundante define `role="tablist"`, os seletores individuais operam como `role="tab"` — expondo `aria-selected="true|false"` e vinculando o contentor através de `aria-controls` — e os painéis de visualização assumem `role="tabpanel"` com `aria-labelledby` apontando para a aba correspondente²⁰. A alternância de foco dentro de um grupo de abas não é realizada por Tab, mas sim exclusivamente pelas teclas direcionais (`ArrowRight`, `ArrowLeft`), reservando o Tab para a entrada direta no painel ativo²⁰.

Nos menus suspensos, o elemento acionador define `aria-haspopup="menu"` e reflete o seu estado via `aria-expanded`, enquanto o menu interno assume `role="menu"` com itens `role="menuitem"`, cuja navegação vertical responde estritamente a `ArrowDown` e `ArrowUp`. As superfícies inferiores móveis (*bottom sheets*) espelham a semântica de diálogos modais (`role="dialog"`, `aria-modal="true"`), exigindo que pegas táteis decorativas incluam `aria-hidden="true"` e que a interface ofereça um botão de fecho explícito na ordem de leitura.

---

## Tabela de Parâmetros e Tokens Obrigatórios

| Critério / Especificação | Norma / Versão | Métrica Mínima Obrigatória | Exceções Legítimas |
| :--- | :--- | :--- | :--- |
| **Contraste de Texto Normal** | WCAG 2.2 AA (1.4.3) | $\ge 4.5 : 1$ de luminância relativa | Elementos puramente decorativos ou desativados (*disabled*). |
| **Contraste de Texto Grande** | WCAG 2.2 AA (1.4.3) | $\ge 3.0 : 1$ de luminância relativa | Texto integrado em logótipos ou bandeiras de marca. |
| **Contraste de UI / Gráficos** | WCAG 2.2 AA (1.4.11) | $\ge 3.0 : 1$ contra fundos adjacentes | Elementos visuais não essenciais à compreensão da interface. |
| **Contraste Reforçado** | WCAG 2.2 AAA (1.4.6) | $\ge 7.0 : 1$ (Normal), $\ge 4.5 : 1$ (Grande) | Nenhum texto de conteúdo essencial dispensado. |
| **Dimensão de Alvo (AA)** | WCAG 2.2 AA (2.5.8) | $24 \times 24$ píxeis CSS | Alvo em linha (*inline text*); espaçamento perimétrico de 24px. |
| **Dimensão de Alvo (AAA)** | WCAG 2.2 AAA (2.5.5) | $44 \times 44$ píxeis CSS | Controlos essenciais do agente de utilizador; alvos em linha. |
| **Espessura do Anel de Foco** | WCAG 2.2 AAA (2.4.13) | Área periférica $\ge 2\text{px}$ de espessura | Mecanismo de destaque visual nativo de SO não modificado. |
| **Movimento por Arrastamento** | WCAG 2.2 AA (2.5.7) | Alternativa por clique simples obrigatória | Quando o arrastamento é essencial à funcionalidade primária. |

---

## Checklist Booleano de Validação

- [ ] **PASS**: Todos os controlos interativos de formulários possuem rótulos acessíveis associados via `<label for="...">` ou `aria-label`/`aria-labelledby`.
- [ ] **PASS**: A alternância de abas (*tabs*) responde nativamente às setas direcionais do teclado (`ArrowLeft` e `ArrowRight`), desativando o avanço via Tab entre seletores irmãos²⁰.
- [ ] **PASS**: Diálogos modais mantêm o foco de navegação fechado (*focus trap*), impedindo a seleção de elementos da árvore principal de fundo²⁰.
- [ ] **PASS**: A ação de encerramento de um componente flutuante (modal, popover, menu) restaura o foco para o elemento original que iniciou a abertura.
- [ ] **FAIL**: Suprimir o indicador visual de foco via folhas de estilo através de regras genéricas (`outline: none` ou `outline: 0`) sem fornecer estilo alternativo de destaque.
- [ ] **FAIL**: Criar botões interativos clicáveis com dimensões físicas inferiores a $24 \times 24$ píxeis CSS sem espaçamento circundante de compensação (violação do critério WCAG 2.2 2.5.8).
- [ ] **FAIL**: Utilizar contentores genéricos semânticos (`<div>`, `<span>`) para ações de clique sem atribuição de `role="button"`, `tabindex="0"` e gestão manual de eventos de Enter e Space.
- [ ] **FAIL**: Atribuir `aria-hidden="true"` a contentores que incluem elementos focáveis ativos, isolando-os dos leitores de ecrã mas permitindo a sua seleção via teclado.

---

## Lista de Links Oficiais Canónicos

- [W3C WCAG 2.2 - Recomendação Oficial Completa](https://www.w3.org/TR/WCAG22/)
- [W3C WAI-ARIA 1.2 Specification](https://www.w3.org/TR/wai-aria-1.2/)
- [WAI-ARIA APG - Padrões de Desenho de Componentes](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [WAI-ARIA APG - Especificação de Caixas de Diálogo Modais](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WAI-ARIA APG - Especificação de Sistema de Abas (Tabs)](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

---

## Exemplo de Código Mínimo Ideal

### TypeScript (Sistema de Abas Acessível conforme WAI-ARIA APG)

```typescript
import React, { useRef, useEffect } from "react";

interface AccessibleTabsProps {
  tabs: { id: string; label: string; content: React.ReactNode }[];
}

export const AccessibleTabs: React.FC<AccessibleTabsProps> = ({ tabs }) => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let targetIndex = index;
    if (event.key === "ArrowRight") {
      targetIndex = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setSelectedIndex(targetIndex);
    tabRefs.current[targetIndex]?.focus();
  };

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex border-b border-neutral-200 dark:border-neutral-700"
      >
        {tabs.map((tab, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <button
              key={tab.id}
              ref={(el) => (tabRefs.current[idx] = el)}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelectedIndex(idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isSelected
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, idx) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`tabpanel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={selectedIndex !== idx}
          tabIndex={0}
          className="p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};
```
