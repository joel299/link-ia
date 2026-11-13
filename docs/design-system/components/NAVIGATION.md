# Header, breadcrumb/actions e navegação

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-NAV-002
- Path: src/components/AppShell.tsx
- Responsibility: Título de rota, busca, notificações, perfil e saída.
- Dependencies: Router, sessão, Lucide.
- Current appearance: Barra sticky com fundo semitransparente e blur existente; busca e profile pills, ícones de bell/logout.
- Current tokens: background, border, card, gold, muted-foreground.
- Future tokens: glass.subtle com shell e stabilized plate no input; manter 80px como baseline observado.
- Visual references: REF-003, REF-004, REF-006
- Recommended tier: glass.subtle
- Anatomy: shell na barra; plate no input; content/focus em cima.
- Variants: título com subtítulo opcional; busca oculta em viewport pequena.
- States: sticky, focus, hover, mobile nav toggle, loading session.
- Responsiveness: busca desaparece em md pequeno; evitar overflow no header.
- Accessibility: aria-label busca/sino/menu, skip-to-content, heading H1 por tela.
- Risks: fixed action cluster pode colidir em largura pequena.
- Invariants: logout, title/subtitle, profile/session, route nav.
- Migration priority: P1

## Acceptance criteria
topbar remains readable on page hotspots; keyboard and fallback work.

## Required checks
320px, 200% zoom, tab sequence, scroll screenshot.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
