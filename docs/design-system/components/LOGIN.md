# Login local

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-PAGE-006
- Path: src/routes/login.tsx; backend/internal/httpapi
- Responsibility: Acesso local demonstrativo e autenticação da sessão.
- Dependencies: AppShell session boundary, API dev-login, form state.
- Current appearance: Local dev login; production OIDC readiness is separate/incomplete per backend README.
- Current tokens: background, foreground, gold, input, focus.
- Future tokens: fallback or subtle decorative glass; form itself dense and stable.
- Visual references: REF-002, REF-004, SUP-008
- Recommended tier: glass.dense/fallback
- Anatomy: background shell; solid content plate; visible form fields.
- Variants: ready, submitting, failed, authenticated redirect.
- States: invalid/error/loading.
- Responsiveness: centered form and narrow viewport.
- Accessibility: label, errors near fields, form submission keyboard, password semantics.
- Risks: never confuse demo with production identity; avoid data capture in visual doc.
- Invariants: dev login contract and redirect.
- Migration priority: P2

## Acceptance criteria
form readable without blur and error announced.

## Required checks
keyboard submit, bad credential, mobile, focus.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
