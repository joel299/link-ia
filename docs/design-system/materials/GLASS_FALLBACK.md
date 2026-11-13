# Fallback sem blur
Status: PROPOSED

Fallback é a mesma interface numa superfície sólida/estável, não versão degradada sem estrutura. Preservar layout, conteúdo, ordem, estado, focus, bordas e operação.

## Gatilhos
Sem suporte backdrop-filter; browser com desempenho restrito; forced-colors/high contrast; usuário opta por menor transparência; efeito causa legibilidade ruim; motion reduzido afeta transição.

## Estratégia futura
Usar @supports para detectar backdrop-filter e aplicar versão sem blur. Não depender de media query de reduced-transparency sem verificar suporte. A preferência do produto, se criada, precisa ser acessível e persistida só após desenho do Theme Engine. Em forced-colors respeitar cores do sistema e outlines.

## Critério
Sem blur a superfície ainda tem contorno, contraste, plate, heading e estados; nenhum conteúdo ou funcionalidade some. REF-008 compara o mesmo layout em vidro e fallback. REF-010 orienta stack.
