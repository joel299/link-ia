# Regressão visual
Status: procedure proposed

## Objetivo
Comparar layout/estados antes e depois de aplicar tokens, sem confundir diferença intencional de material com regressão funcional.

## Pré-condições e passos
Capturar baseline e branch com mesmo commit/dados de demonstração, browser, viewport, zoom e estado. Capturar rota completa e detalhes por componentes em desktop/tablet/mobile. Comparar alinhamento, tipografia, overflow, hierarquia, foco, conteúdo e comportamento fallback.

## Critério PASS
Sem conteúdo/ação ausente, sem regressão de rota, overflow ou foco; contraste medido; mudanças materiais estão documentadas e dentro dos tokens. Screenshot não prova API ou acessibilidade sozinha.

## Evidência
Nome do browser/versão, viewport, zoom, route, estado, screenshot, build/commit e diferenças anotadas. Severidade: blocker (ação/leitura/foco), major (hierarquia/layout), minor (acabamento).
