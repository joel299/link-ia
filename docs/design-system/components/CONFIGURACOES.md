# Configurações

Status: EXISTING component; prompt de classificação recolhido por padrão; disclosure acessível.

## Registry
- ID: UI-PAGE-005
- Path: src/routes/configuracoes.tsx
- Responsibility: Configurar prompt/model/effort de classificação e conexão Codex.
- Dependencies: API session, classification settings, Codex device login, Switch and slider.
- Current appearance: API-backed classification settings and Codex device-login; visual theme editor is absent.
- Current tokens: semantic surface, input, ring, gold, effort scale.
- Future tokens: Glass dense; color editor remains future Theme Editor, not this implementation.
- Visual references: REF-002, REF-003, SUP-007, SUP-009
- Recommended tier: glass.dense/fallback
- Anatomy: section groups, labels/controls/helper feedback, save action.
- Variants: loading, saved, error, connecting/disconnected.
- States: settings load/save, auth, connect/disconnect, range control.
- Responsiveness: rows stack; selectors and helper text fit.
- Accessibility: visible labels, range value, save feedback, device login state text; prompt revelado por disclosure nativo `details/summary`, fechado por padrão.
- Risks: visual theme choices mistakenly wired to Codex setting; don't change API payload.
- Invariants: model/prompt/effort save, CSRF, device auth flow.
- Migration priority: P1

## Acceptance criteria
all controls legible; prompt starts hidden and opens by keyboard/click; model, prompt and effort remain saved through the existing API; theme controls are not added in V1.

## Required checks
validation, API error, focus, viewport.

The prompt disclosure is implemented. Do not expose its full text by default; preserve the existing save/API contract. No theme controls are added.
