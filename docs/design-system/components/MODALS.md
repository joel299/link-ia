# Dialog, modal, sheet e drawer

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-OVERLAY-001
- Path: src/components/ui/dialog.tsx; sheet.tsx; drawer.tsx
- Responsibility: Detalhe, confirmação ou fluxo contextual sem perder local da tarefa.
- Dependencies: Radix dialog/sheet, portal, focus management.
- Current appearance: Backdrop e container sólidos, border/background, shadow; jurisprudência abre Dialog.
- Current tokens: popover, background, border, foreground, ring.
- Future tokens: glass.elevated shell; scrim e plate; focus ring no topo.
- Visual references: REF-004, REF-006, REF-002, SUP-008
- Recommended tier: glass.elevated com dense content plate
- Anatomy: scrim → shell → plate → content → close/focus.
- Variants: center dialog, side sheet, mobile drawer.
- States: open/closed, initial focus, invalid, loading.
- Responsiveness: max height, internal scroll, full-width mobile where needed.
- Accessibility: role/name/description, focus trap, Escape, return focus, inert background.
- Risks: nested scroll, backdrop blur and clipping focus.
- Invariants: Radix semantics and action flow.
- Migration priority: P2

## Acceptance criteria
same modal layout and content on glass/fallback; focus never hidden.

## Required checks
keyboard, screen reader name, long content, narrow viewport.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
