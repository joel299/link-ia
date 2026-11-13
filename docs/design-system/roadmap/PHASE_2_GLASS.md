# Fase 2 — Glass Material
Status: primeira fatia implementada; revisão visual e QA pendentes

## Objetivo
Criar shell/plate/edge/light/blur/fallback reutilizáveis a partir da especificação. A primeira fatia já aplica o material ao shell/navegação e ao resumo do dashboard; não significa conclusão da fase.

## Pré-requisitos
Fase 1 aprovada; design tokens existentes verificados; baseline; aceitar ranges de blur propostos ou recalibrados.

## Sequência
Implementar camada de material em laboratório isolado; testar seis fundos; testar contraste e estados; exercitar fallback sem blur e forced colors; inspecionar performance em scroll/overlay; obter review read-only.

## Riscos
Blur caro, contraste instável, pixel displacement entendido como CSS nativo, material excessivo, baixa performance em dispositivo.

## Aceite
Uma surface demonstra shell/plate; conteúdo estável; tier/fallback selecionados; nenhuma cor da marca muda; QA PASS em background/state/fallback e screenshot comparável. Estado atual: NOT_VERIFIED no navegador.

## Rollback
Desativar classe/material de glass e manter superfície atual; sem alterar conteúdo de página.

## Responsável/evidência
Frontend implementa; QA Visual testa; reviewer verifica arquitetura. Guardar screenshots, perf notes, contraste e commit da tarefa.
