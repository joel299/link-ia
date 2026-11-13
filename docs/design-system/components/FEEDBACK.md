# Tags, alerts, toast, progress and empty/error feedback

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-FEEDBACK-001
- Path: src/components/AppShell.tsx Tag; src/components/ui/alert.tsx; sonner.tsx; progress.tsx; skeleton.tsx
- Responsibility: Representar status, completion, failure, loading and empty state.
- Dependencies: semantic status tokens, Radix/toast and shared labels.
- Current appearance: Tag is compact rounded capsule with five tones; Sonner is themed; alerts/progress/skeleton wrappers exist.
- Current tokens: success, warning, destructive, muted, gold, foreground.
- Future tokens: surface tier subtle/elevated with plate; status icon/message survives glass.
- Visual references: REF-002, REF-005, SUP-008
- Recommended tier: glass.subtle; toast may elevate; inline dense
- Anatomy: signal icon/shape + text + optional dismiss; shell and plate only when overlay.
- Variants: tag, alert, toast, skeleton, progress.
- States: success, warning, error, loading, info, empty.
- Responsiveness: wrap message; toast not obscure main action.
- Accessibility: status role/live region, label, not color-only, dismiss button accessible.
- Risks: too many pills; fake live status; animation noisy.
- Invariants: tone semantics and response timing.
- Migration priority: P1

## Acceptance criteria
state understood without color or background context.

## Required checks
screen reader live, reduced motion, contrast, long error.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
