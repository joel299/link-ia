# Inventário de componentes e páginas
Status: AUDITED

## Shell compartilhado
src/components/AppShell.tsx: AppShell controla sessão, redirect, nav, mobile drawer, header, busca, notificações, perfil e logout. Panel aplica .panel. Tag mapeia tons gold, success, warning, danger e muted.

## Rotas
src/routes/index.tsx: hero do dashboard, métricas, gráficos, agenda, casos, alertas e análises; muitos dados são mock.
src/routes/jurisprudencias.tsx: filtros, busca, query/paginação, resultados e Dialog de detalhe; consulta API.
src/routes/debate.tsx: resumo de caso, etapas de agentes, argumentos, riscos, precedentes e conclusão demonstrativa; transições por timer.
src/routes/atendimento.tsx: fila, conversa, mensagens, composer e resposta simulada local.
src/routes/configuracoes.tsx: settings de modelo/prompt, conexão Codex e seções auxiliares; parte da API real.
src/routes/login.tsx: sessão/login de desenvolvimento.
src/routes/__root.tsx: metadata, CSS, fontes, layout global e boundary.

## Wrappers disponíveis
src/components/ui contém button, card, badge, input, textarea, form, table, dialog, sheet, sidebar, alert, alert-dialog, sonner/toast, select, tabs, tooltip, popover, menus, checkbox, radio, switch, slider, calendar e chart, além de primitives. A presença de arquivo não prova uso atual na página.

## Padrões atuais
AppShell → conteúdo da rota → Panel/Tag e wrappers semânticos. Painel agrupa conteúdo; Tag sinaliza estado curto. Não transformar cada linha em mini-card; não multiplicar badges tipo pill. Tabelas são wrapper existente e uma ficha para aplicação futura, não alegação de uso em rota atual.

## Catálogo
Fichas individuais cobrem shell, nav, botão, input, modal, tabela, painel e feedback. Consultar a ficha, path e critérios antes de migrar.
