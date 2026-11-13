# Dashboard

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-PAGE-001
- Path: src/routes/index.tsx; src/lib/mock.ts
- Responsibility: Resumo executivo de atividade, casos, agenda, alertas e análise.
- Dependencies: AppShell, Panel, Tag, Recharts, mock arrays.
- Current appearance: Hero, four metrics, agenda and grouped analytics panels; some numbers/strings fixed demo.
- Current tokens: body/display, gold, chart-1..5, card, border, shadow.
- Future tokens: standard on summary surfaces; dense for lists and charts; glass only selective.
- Visual references: REF-001, REF-003, SUP-007
- Recommended tier: mixed standard + dense
- Anatomy: hero shell; stable chart plate; data panels.
- Variants: desktop grid to responsive stack.
- States: data, empty/errors when wired; current fixtures illustrative.
- Responsiveness: charts resize; lists stack; no hidden key metric.
- Accessibility: chart summary/table alternative, headings and labels.
- Risks: demo metrics mistaken as real; too many shiny cards.
- Invariants: meaning/order of KPI and links/actions.
- Migration priority: P2

## Acceptance criteria
prioritize key alert and metric; same palette, contrast at all contexts.

## Required checks
narrow grid, chart legend, large text, empty data.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
