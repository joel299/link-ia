# Material Liquid Glass
Status: material implementado parcialmente; intensidade visual reprovada pelo usuário; calibragem/QA PENDING

## Definição
Superfície em camadas que mantém o fundo perceptível, conteúdo estável e comportamento previsível. A aparência não vem apenas de blur: depende de shell, borda, highlight, placa, conteúdo, luz consistente e fallback.

## Elementos e responsabilidades
| Elemento | Responsabilidade | Tokens | Referência | Critério |
|---|---|---|---|---|
| Outer shell | comunica material e espessura | glass tier, surface, border | REF-004/006 | fundo ainda reconhecível sem afetar hierarquia |
| Border edge | define silhueta e separação | glass.edge | REF-005 | contorno visível em dark e hotspot |
| Highlight band | sugere luz e espessura | glass.highlight | REF-005 | direção única e faixa contida |
| Inner stroke | separa shell e placa | glass.stroke | REF-005 | linha fina; não produz borda dupla excessiva |
| Micro-noise | quebra perfeição artificial | glass.texture | REF-005/001 | sutil, estático e sem custo de repaint perceptível |
| Shadow cue | marca elevação | elevation tokens | REF-005/006 | separa camadas sem glow dominante |
| Inner stabilized plate | estabiliza letras, números e ícones | glass.plate | REF-004/009/010 | contraste consistente entre fundos |
| Content layer | carrega conteúdo e controles | foreground/status/focus | REF-004 | legível, selecionável, navegável, nunca dependente do fundo |
| Backdrop blur | amacia detalhe sob shell | glass.blur | REF-001/010 | só overlay; nunca única técnica de contraste |
| Saturation/tint | preserva nuance do entorno | glass.tint | artigo | não transforma cenário em névoa ou recolore paleta |
| Refração aproximada | highlight gradiente pode sugerir curvatura | glass.highlight | REF-005 | descrever como efeito visual aproximado, sem alegar refração óptica real |

## Stack e exemplo futuro
Ordem: outer shell → inner plate → conteúdo; estados/foco ficam na camada superior. Shell pode receber border, gradient e backdrop-filter. Plate recebe uma superfície estável sob todo o texto, inclusive microcopy. Exemplo meramente futuro:

    .glass-surface { background: var(--glass-shell); border: 1px solid var(--glass-edge); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation)); }
    .glass-surface__plate { background: var(--glass-plate); }
    .glass-surface__content { position: relative; z-index: 1; }

Os estilos `.glass-*` já existem no código. A existência de CSS não comprova resultado visual: a intensidade atual foi considerada superficial e precisa ser corrigida nas superfícies delegadas. Valores específicos permanecem sujeitos a contraste e QA; não copiar valores arbitrários para outras superfícies.

## CSS versus óptica
CSS padrão oferece transparência, gradiente, borda, inset stroke, sombra, backdrop-filter blur/saturate e animações leves. Não há deslocamento óptico de pixels ou refração física nativa. SVG displacement pode aproximar; shader WebGL/WebGPU ou biblioteca adiciona custo, suporte e manutenção. Não adicionar por estética sem aprovação.

## Regras de uso
Glass mais forte em header, nav flutuante, sheet, drawer, modal, tooltip e toast. Painel de métricas pode usar tier standard com conteúdo estável. Tabela, lista jurídica, form denso e parágrafo longo usam dense/fallback. Não pôr blur atrás de cada card; não cobrir fundo todo; não mudar cor da marca.

## Aceite visual vinculante desta correção
- Em comparação direta na mesma tela e viewport, o efeito deve ser percebido sem precisar procurar: a borda recorta a superfície, highlight sugere espessura, blur deixa o fundo reconhecível e uma plate estabilizada separa conteúdo do backdrop.
- A percepção vem da transparência, blur e camadas, não de aumentar brilho neon ou mudar as cores de marca. Fundo, texto e estados mantêm a paleta existente.
- A superfície não pode virar uma placa opaca uniforme, gerar halo dominante, reduzir contraste ou deixar texto dependente do fundo.
- A camada externa recebe material; texto/ícones/controles ficam em camada de conteúdo estável e legível. Em listas densas, glass no contêiner principal apenas; cada linha não ganha blur individual.
- Se screenshot no navegador não estiver disponível, registrar visual QA como NOT_VERIFIED; não declarar que o vidro está corrigido só porque as classes existem.

## Acessibilidade
Textos 4.5:1 (normal), 3:1 (large); componentes/ícones/foco relevantes 3:1 contra cores adjacentes conforme critério aplicável WCAG 2.2 AA. Foco deve permanecer nítido; fornecer estrutura para error/loading/disabled; testar teclado, zoom, contraste elevado e reduced motion. Preferência genérica reduced-transparency não é uniformemente suportada: oferecer fallback determinístico mesmo sem ela.

## Aceitação
Mesmo componente permanece legível em seis cenários REF-001; os estados são distintos sem legenda REF-002; densidade longa passa REF-007; fallback conserva layout REF-008; texto não depende de fundo REF-009; ordem de stack obedece REF-010. Valor de blur/opacidade só vira token final após QA.
