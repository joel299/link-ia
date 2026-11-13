# Component Registry
Status: features and shared components audited; future styles proposed.

| ID | Component | Real source | Tier futuro |
|---|---|---|---|
| UI-SHELL-001 | AppShell | src/components/AppShell.tsx; src/routes/__root.tsx | glass.subtle; fallback denso/sólido |
| UI-NAV-001 | Sidebar e drawer mobile | src/components/AppShell.tsx | glass.subtle/fallback |
| UI-NAV-002 | Header, breadcrumb/actions e navegação | src/components/AppShell.tsx | glass.subtle |
| UI-ACT-001 | Botões | src/components/ui/button.tsx; rotas usam alguns button nativos | glass.subtle; não aplicar shell elevada a todo botão |
| UI-FORM-001 | Inputs, labels e formulários | src/components/ui/input.tsx; textarea.tsx; form.tsx; formulários em rotas | glass.dense |
| UI-OVERLAY-001 | Dialog, modal, sheet e drawer | src/components/ui/dialog.tsx; sheet.tsx; drawer.tsx | glass.elevated com dense content plate |
| UI-DATA-001 | Tabelas e listas densas | src/components/ui/table.tsx; lists in routes | glass.dense or fallback |
| UI-SURFACE-001 | Panel e cards de conteúdo | src/components/AppShell.tsx; src/styles.css utility .panel; src/components/ui/card.tsx | glass.standard/dense |
| UI-FEEDBACK-001 | Tags, alerts, toast, progress and empty/error feedback | src/components/AppShell.tsx Tag; src/components/ui/alert.tsx; sonner.tsx; progress.tsx; skeleton.tsx | glass.subtle; toast may elevate; inline dense |
| UI-PAGE-001 | Dashboard | src/routes/index.tsx; src/lib/mock.ts | mixed standard + dense |
| UI-PAGE-002 | Pesquisa de jurisprudência | src/routes/jurisprudencias.tsx; backend/internal/jurisprudence; api/openapi.yaml | dense list + elevated dialog |
| UI-PAGE-003 | Debate jurídico | src/routes/debate.tsx | standard shell + dense evidence |
| UI-PAGE-004 | Atendimento IA | src/routes/atendimento.tsx; src/lib/mock.ts | dense conversation + subtle nav |
| UI-PAGE-005 | Configurações | src/routes/configuracoes.tsx | glass.dense/fallback |
| UI-PAGE-006 | Login local | src/routes/login.tsx; backend/internal/httpapi | glass.dense/fallback |

The existing primitive wrappers under src/components/ui are listed in audit/COMPONENT_INVENTORY.md. Categories are covered by BUTTONS, INPUTS, MODALS, TABLES, PANELS and FEEDBACK; a file existing does not imply use on a route. Each ficha below carries the required ownership, behavior and acceptance checks.
