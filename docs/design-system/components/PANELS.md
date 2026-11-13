# Panel e cards de conteúdo

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-SURFACE-001
- Path: src/components/AppShell.tsx; src/styles.css utility .panel; src/components/ui/card.tsx
- Responsibility: Agrupar conteúdo relacionado e orientar hierarquia.
- Dependencies: tokens surface/card, radius-xl, gradient-card, shadow-card.
- Current appearance: Panel shared component with padding; .panel has dark gradient, 1px border, radius and shadow.
- Current tokens: card, card-foreground, border, radius-xl, shadow-card, gold.
- Future tokens: standard for hero/summary panels; dense for long content; elevate only overlay.
- Visual references: REF-004, REF-005, REF-006, SUP-009
- Recommended tier: glass.standard/dense
- Anatomy: outer shell, plate, content, border/shadow.
- Variants: title/action optional; className; standalone Card wrapper exists.
- States: hover only where panel-hover intentional; avoid making static panel look clickable.
- Responsiveness: flex/min-width zero, padding adapts, content wraps.
- Accessibility: section heading hierarchy; no focus unless interactive.
- Risks: card proliferation, text background-dependence, oversized glow.
- Invariants: Panel props and child layout.
- Migration priority: P1

## Acceptance criteria
one surface per semantic group; large content stays readable.

## Required checks
dark background, density, responsive, focusable descendants.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
