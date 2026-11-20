# 1. Arquitetura Visual e Sistemas de Design Nativos

## Fundamentos Estruturais do Google Material Design 3 e Apple HIG

A arquitetura visual contemporânea transita de abstrações puramente estéticas para sistemas determinísticos baseados em física ótica e modelos perceptuais¹. O Google Material Design 3 (M3) baseia a sua geração cromática no espaço de cores HCT (Hue, Chroma, Tone), que resolve as distorções perceptuais inerentes aos espaços sRGB e HSL através da parametrização isolada da luminância aparente ($T \in [0, 100]$)¹. A derivação algorítmica parte de uma cor-semente (seed color) para sintetizar seis paletas tonais estruturadas: Primária, Secundária, Terciária, Neutra, Neutra Variante e Erro¹. Cada paleta gera treze paragens tonais discretas: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99 e 100, nas quais o tom 100 representa o branco absoluto e o tom 0 o preto absoluto¹.

A elevação no M3 substituiu as sombras projetadas por preenchimentos tonais e níveis de contentor². Embora a métrica subjacente mantenha a escala física em pontos de densidade independente ($dp$), a sobreposição de matiz (surface tint) foi preterida em favor de papéis semânticos de contentores de superfície (surface-container-lowest até surface-container-highest) para eliminar a dependência de opacidades translúcidas dinâmicas sobrepostas⁹. O motor responsivo do M3 baseia-se em Window Size Classes, que categorizam a largura do ecrã em Compact (<600dp), Medium (600–839dp), Expanded (840–1199dp), Large (1200–1599dp) e Extra-Large ($\ge 1600dp$), desencadeando adaptações no layout de navegação⁶.

Nas diretrizes da Apple (Human Interface Guidelines), a renderização para iOS e iPadOS exige obediência estrita às margens de corte de hardware através das Safe Areas, evitando oclusões pela Dynamic Island, pelo entalhe de sensores e pelo indicador da interface inicial (Home Indicator). A escala do Dynamic Type parametriza onze estilos tipográficos com base na tipografia San Francisco, garantindo a sua legibilidade por meio de proporções de redimensionamento proporcionais entre tamanho de corpo e entrelinha (leading). O escalonamento em profundidade adota materiais translúcidos nativos com desfoque gaussiano contínuo (.ultraThinMaterial, .thinMaterial, .regularMaterial, .thickMaterial e .ultraThickMaterial), acoplados a efeitos de vibração ótica (vibrancy) que garantem legibilidade contra fundos arbitrários¹⁴. A navegação estrutural apoia-se em pilhas canónicas com transição lateral acionada por gesto no limite do ecrã e apresentação de superfícies modais com ancoragens predefinidas (.medium() e .large()).

A integração entre estes ecossistemas e a Web moderna apoia-se na especificação do W3C Design Tokens Community Group (DTCG), que padroniza os esquemas de declaração através dos modificadores prefixados com cifrão ($value, $type)¹⁷. Nos ambientes sem interface pré-definida (headless), bibliotecas como Radix UI Primitives e arquiteturas como shadcn/ui separam o comportamento e a acessibilidade da camada visual através da delegação de elementos (asChild), expondo o estado semântico via atributos data-* nativos (data-state="open|closed"), permitindo a composição de componentes acessíveis sem nós redundantes no DOM.

---

## Tabela de Parâmetros e Tokens Obrigatórios

| Domínio / Subsistema | Parâmetro Canónico | Valor / Sintaxe Obrigatória | Descrição Técnica Normativa |
| :--- | :--- | :--- | :--- |
| **M3 Tonal Palettes** | Paragens de Tom (HCT) | 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100 | Escala fixa de luminância perceptual da paleta tonal¹. |
| **M3 Elevation Scale** | Níveis 0 a 5 | 0dp, 1dp, 3dp, 6dp, 8dp, 12dp | Alturas $z$ nominais para contentores e componentes¹¹. |
| **M3 Window Classes** | Quebras de Ecrã (Largura) | <600dp (Compact), 600-839dp (Medium), 840-1199dp (Expanded), 1200-1599dp (Large), $\ge 1600dp$ (Extra-Large) | Limiares de largura para reconfiguração adaptativa de navegação⁶. |
| **W3C DTCG Format** | Estrutura de Token | `"$value"`, `"$type"`, `"$description"` | Especificação canónica do Design Tokens Community Group¹⁷. |
| **Apple Dynamic Type** | Estilo Base: Body | 17pt tamanho, 22pt entrelinha (leading), Regular | Estilo textual principal por omissão no iOS (nível Large). |
| **Apple Dynamic Type** | Estilo: Large Title | 34pt tamanho, 41pt entrelinha, Regular | Título principal de cabeçalho com colapso em rolagem. |
| **Apple Safe Areas** | Insets Mínimos (iPhone) | Topo: 47pt / 59pt (Dynamic Island); Fundo: 34pt | Margens de segurança mínimas para evitar corte físico de hardware. |
| **Apple Materials** | Níveis de Transluzência | `.ultraThin`, `.thin`, `.regular`, `.thick`, `.ultraThick` | Blends nativos com saturação adaptativa e blur gaussiano¹⁴. |
| **Headless Radix / shadcn** | Composição de Nó | `asChild = {true}` | Delegação de nó DOM para elemento filho sem envelope adicional. |
| **Headless Atributos** | Indicadores de Estado | `data-state="open \| closed"`, `data-disabled` | Seletores de estado para estilização dinâmica via CSS / Tailwind. |

---

## Checklist Booleano de Validação

- [ ] **PASS**: A raiz do tema define paletas tonais com exatamente as 13 paragens canónicas do espaço HCT do M3¹.
- [ ] **PASS**: O formato de exportação de tokens adere rigorosamente à sintaxe W3C DTCG utilizando chaves prefixadas por cifrão ($value, $type)¹⁷.
- [ ] **PASS**: Os alvos interativos em iOS respeitam as margens da `safeAreaLayoutGuide` em todas as orientações.
- [ ] **PASS**: As primitivas headless utilizam o padrão `asChild` para evitar o anidamento de botões dentro de âncoras (`<button>` dentro de `<a>`).
- [ ] **FAIL**: Utilizar sombras projetadas (*drop shadows*) manuais com valores arbitrários em vez dos níveis canónicos de contentor de superfície do M3⁶.
- [ ] **FAIL**: Fixar tipografia em pixels (px) absolutos em aplicações iOS nativas, quebrando o suporte ao Dynamic Type.
- [ ] **FAIL**: Intercetar ou anular o gesto nativo de deslizamento no limite esquerdo do ecrã para retroceder na pilha de navegação iOS.
- [ ] **FAIL**: Utilizar propriedades personalizadas de CSS fora do formato W3C DTCG sem o atributo `$type` declarado no nível do token ou de grupo¹⁷.

---

## Lista de Links Oficiais Canónicos

- [Google Material Design 3 - Especificação Geral](https://m3.material.io/)
- [Google Material Design 3 - Elevação e Tokens](https://m3.material.io/styles/elevation/tokens)
- [W3C Design Tokens Community Group (DTCG) Format Module](https://www.designtokens.org/tr/third-editors-draft/format/)
- [Apple Human Interface Guidelines - Fundamentos de Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple Human Interface Guidelines - Dynamic Type e Tipografia](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Radix UI Primitives - Arquitetura de Acessibilidade e Composição](https://www.radix-ui.com/primitives)

---

## Exemplo de Código Mínimo Ideal

### JSON (Tokens W3C DTCG)

```json
{
  "color": {
    "primary": {
      "$type": "color",
      "40": {
        "$value": "#6750A4",
        "$description": "Paragem tonal 40 da cor primária canónica no espaço HCT"
      },
      "100": {
        "$value": "#FFFFFF",
        "$description": "Luminância máxima absoluta (Branco)"
      }
    }
  },
  "elevation": {
    "level": {
      "$type": "dimension",
      "0": { "$value": "0dp" },
      "1": { "$value": "1dp" },
      "2": { "$value": "3dp" },
      "3": { "$value": "6dp" },
      "4": { "$value": "8dp" },
      "5": { "$value": "12dp" }
    }
  }
}
```

### TypeScript (Componente Headless Radix UI com Padrão asChild e Tailwind)

```typescript
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const ModalDialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
        "rounded-2xl bg-neutral-50 p-6 shadow-xl dark:bg-neutral-900",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ModalDialog.displayName = DialogPrimitive.Content.displayName;

export { ModalDialog };
```
