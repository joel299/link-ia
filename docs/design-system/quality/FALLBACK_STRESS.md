# Fallback Stress
Status: test plan

## Procedimento
Testar backdrop-filter indisponível (override browser/CSS), prefers-reduced-motion, forced-colors/high contrast, zoom, viewport baixo e dispositivo/browser de menor capacidade. Preferência reduced-transparency só quando suportada; validar fallback manualmente também. Referências SUP-008 e SUP-010.

## Esperado
Mesma anatomia/ordem/semântica; superfície sólida intencional, plate permanece; foco/estados não dependem de blur; navegação/controls não somem.

## Aprovação
Nenhuma feature quebra sem filtro. Sem mudança de layout/content; leitura e estados passam critérios AA. Evidência mostra glass e fallback do mesmo componente no mesmo viewport.

## Falhas
Fallback genérico que perde separators, foco ou hierarchy = major/blocker conforme efeito. Corrigir estrutura, não adicionar opacidade local por tela.
