# Acessibilidade
Status: acceptance spec; no new design tests executed

## Baseline mínima
WCAG 2.2 AA aplicável: contraste de texto 4.5:1 (normal), 3:1 (large); componentes/ícones e foco 3:1 quando o critério se aplicar; operação por teclado, foco não obscurecido (2.4.11), labels, name/role/value, zoom/reflow e target size mínimo WCAG (2.5.8). Meta confortável do produto: alvos 44px, sem confundir com mínimo normativo.

## Procedimento
Testar fundo preto/brand, superfícies, hotspot e fallback; medir cor renderizada, não só token. Tab/Shift+Tab/Enter/Space/Escape; foco visível/sem clipping; screen reader em forms, dialog, toast, errors; zoom 200% e viewport estreito; prefers-reduced-motion; forced-colors/contraste elevado.

## Critério
Nenhum texto/ícone funcional depende apenas de cor. Focus ring sempre visível. Error tem texto associado. Layout reflow sem perda de função. Evidência: browser, viewport, estado, screenshot + ratio calculado e ferramenta. A palette actual not measured here; mark NOT_VERIFIED until run.
