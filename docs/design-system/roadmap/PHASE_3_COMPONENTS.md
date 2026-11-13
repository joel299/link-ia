# Fase 3 — Component Migration
Status: proposta

## Objetivo
Aplicar glass gradualmente aos componentes e rotas com valor de UX claro.

## Ordem candidata
Header/overlay e navegação → painéis de resumo → dialogs/drawers → controles → forms → listas/tabelas densas (dense/fallback por padrão). Rotas jurídicas longas exigem maior legibilidade e revisão humana.

## Dependências
Material aprovado; ficha de componente; tarefas com arquivos exclusivos; fluxos funcionais e screenshots baseline.

## Riscos
Over-cardification, efeito decorativo em dados, regressão de foco/overflow, screenshots inconsistentes, demo confundida com real.

## Aceite
Cada componente possui tier/estado; nenhum handler/API muda; background/state/density/fallback aplicáveis PASS; reviewer sem finding blocking.

## Rollback
Reverter um componente/rota por vez para .panel/tema original. Não rollback em massa de páginas já validadas.

## Responsável/evidência
Agentes Frontend por unidade; QA e reviewer independentes; usuário valida preview. Evidência por rota/component/viewport.
