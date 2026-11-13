# Pesquisa de jurisprudência

Status: EXISTING component; initial page capped at 20, explicit pagination, filter-panel glass and retry for failed classification.

## Registry
- ID: UI-PAGE-002
- Path: src/routes/jurisprudencias.tsx; backend/internal/jurisprudence; api/openapi.yaml
- Responsibility: Pesquisar, paginar, abrir decisão e ver classificação/metadata.
- Dependencies: TanStack Query, API, filters, Dialog, status/errors.
- Current appearance: Real query/pagination path; source/license and classification details are shown; mock data elsewhere is not authority.
- Current tokens: foreground/muted, gold, status, card, popover, ring.
- Future tokens: dense for result list and evidence; elevated Dialog; preserve official source cues.
- Visual references: REF-003, REF-004, REF-007, SUP-009
- Recommended tier: dense list + elevated dialog
- Anatomy: search/form plate; results; source provenance; detail overlay.
- Variants: loading, populated, no result, deep search failed, next page.
- States: fetching, error/retry, selected dialog, classifications; a failed classification can be retried for that decision only.
- Responsiveness: filters collapse without losing query state; source label stays readable.
- Accessibility: input labels, paging names, headings/citations, focus returns from dialog.
- Risks: legal citations/source provenance obscured by blur; mock precedent called real.
- Invariants: API query, cursors, retry, source and result fields.
- Migration priority: P1

## Acceptance criteria
each result and source readable; initial request contains at most 20; changing the case/reference starts analysis for the current first page; explicit retry requeues only a failed decision; valid results with identical query and AI settings may use the server cache; errors/retry stay visible.

## Required checks
query states, pagination, modal keyboard, narrow viewport.

The search/form surface uses shared glass styling; legal result rows remain stable/dense. Changing the case reference starts classification for current results; same query+settings can reuse valid cached output to limit cost. Failed classifications expose a single-decision retry. Keep API cursors and the 20-item page cap.
