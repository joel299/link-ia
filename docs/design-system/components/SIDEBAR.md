# Sidebar e drawer mobile

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-NAV-001
- Path: src/components/AppShell.tsx
- Responsibility: Acesso às cinco rotas e indicador de status.
- Dependencies: TanStack Link/useRouterState, Lucide, tokens sidebar.
- Current appearance: Painel lateral escuro com marca e linha dourada, nav ativa, card de disponibilidade; desktop fixa e mobile sobre overlay.
- Current tokens: sidebar, sidebar-foreground, sidebar-accent, sidebar-border, gold, success.
- Future tokens: subtle shell apenas se separar do conteúdo; a lista mantém plate estável.
- Visual references: REF-003, REF-004
- Recommended tier: glass.subtle/fallback
- Anatomy: shell; plate atrás da lista; indicador selecionado e foco acima.
- Variants: wide desktop; drawer mobile.
- States: active, inactive, hover, focus, open, closed.
- Responsiveness: fixed lg; drawer abaixo; fechar após selecionar e por Escape.
- Accessibility: nav landmark, link names, aria-current, close button label, focus trap do dialog.
- Risks: não depender de dourado apenas; status hardcoded precisa permanecer demo.
- Invariants: to URLs e estado selected.
- Migration priority: P1

## Acceptance criteria
cada rota focável e reconhecível; drawer não bloqueia scroll/foco indevidamente.

## Required checks
keyboard nav, mobile narrow, contrast active/inactive.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
