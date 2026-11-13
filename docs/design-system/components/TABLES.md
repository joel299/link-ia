# Tabelas e listas densas

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-DATA-001
- Path: src/components/ui/table.tsx; lists in routes
- Responsibility: Exibir itens comparáveis com leitura rápida.
- Dependencies: table wrapper, sorting/filtering if later present.
- Current appearance: Wrapper semantic; no business table usage confirmed in route screenshots/source.
- Current tokens: background, foreground, muted, border, chart/status.
- Future tokens: glass.dense/fallback; plate mais forte; row separators claros.
- Visual references: REF-003, SUP-007
- Recommended tier: glass.dense or fallback
- Anatomy: containing panel; stable header; row surface; separators; focusable actions.
- Variants: responsive list or scroll container; not yet product-confirmed.
- States: empty, loading, sort/focus if implemented, selected, error.
- Responsiveness: retain column labels; use row cards only when semantics preserved; accessible horizontal scroll alternative.
- Accessibility: caption, th scope, headers, keyboard, status text not color alone.
- Risks: blur merges columns; dense numbers and legal citations unreadable.
- Invariants: data order, filtering/sort semantics, row actions.
- Migration priority: P2

## Acceptance criteria
all rows scan on calm/hotspot/dark; no text under raw blur.

## Required checks
large dataset, zoom, contrast, keyboard, screen reader.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
