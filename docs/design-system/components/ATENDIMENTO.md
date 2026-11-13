# Atendimento IA

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-PAGE-004
- Path: src/routes/atendimento.tsx; src/lib/mock.ts
- Responsibility: Fila de conversa, mensagens, contexto e composer de demonstração.
- Dependencies: AppShell, Tag, mock conversations, local React state.
- Current appearance: Three-column layout, client-side send and timed canned reply; no durable conversation integration shown.
- Current tokens: card/background, gold, success, border, input.
- Future tokens: subtle navigation/sidebar, dense message panel, solid plate behind long content.
- Visual references: REF-001, REF-002, REF-003, SUP-007, SUP-008
- Recommended tier: dense conversation + subtle nav
- Anatomy: queue; transcript; message plate; composer.
- Variants: active conversation, typing demo, no selection if added.
- States: local sending/typing, not API-backed in this route.
- Responsiveness: minimum height 600px current; mobile collapse queue/transcript with back affordance.
- Accessibility: label composer, send name, announce new message, preserve reading position.
- Risks: mock reply appears real; background blur harms transcript.
- Invariants: local demo and visual flow until functional redesign is separately requested.
- Migration priority: P2

## Acceptance criteria
message text readable; keyboard can compose/send; no horizontal overflow.

## Required checks
long message, queue overflow, 320px, live-region behavior.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
