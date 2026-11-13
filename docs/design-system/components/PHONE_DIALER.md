# Discador flutuante

Status: keypad and confirmation interaction implemented; focused regression test, ESLint, build, and local desktop smoke confirmed; mobile/accessibility QA PENDING

## Registry

- ID: UI-PHONE-001
- Paths: `src/components/AppShell.tsx`, `src/components/PhoneDialer.tsx`, `src/lib/phone.ts`
- Responsibility: expose an authenticated outbound dialer from the existing application topbar.
- Dependencies: Lucide phone icons, existing Button and AlertDialog, Aurum Lex session/CSRF API, Go phone API.
- Tier: glass.standard outer panel with a stabilized glass plate; the call confirmation dialog must layer above the panel and its mobile scrim.
- Semantic tokens: surface.overlay/panel, text.primary/secondary, action.accent/focus, status.error/success/warning, border.default/control.
- References: REF-002 (states), REF-003 (overlay risk), REF-004 (shell/plate/content), REF-005 (edge), REF-006 (tiers), SUP-008 (fallback), SUP-009/010 (stable plate); user-provided keypad and connected-call screenshots (their sample identity, labels, tabs, and palette are not product data).

## Anatomy and behavior

1. Named 44px phone trigger in the existing topbar; active calls have a status dot and accessible name.
2. Compact fixed panel aligned to the viewport's right edge, with a standard glass shell, stabilized inner plate, and stable content layer. Because `.glass-standard` sets `position: relative`, the panel explicitly restores `position: fixed`; opening it must not change page geometry.
3. Idle/dialing view: readable number display/input and a 3-by-4 numeric keypad for entering the destination. Keep direct keyboard entry, paste, backspace, and screen-reader labels available. A primary call action opens a confirmation that states the destination.
4. The confirmation overlay and content must be above both the floating panel and the mobile backdrop. Since `.glass-standard` sets `position: relative`, keep the confirmation's fixed positioning explicitly. Only “Confirmar e ligar” sends `POST /api/v1/phone/calls`; “Ligar” only opens confirmation.
5. In-call view follows the reference hierarchy: call identity/number, live status, elapsed time, and a clear hangup action. After a confirmed end, keep the floating panel open and immediately return to the empty number field and keypad. Only controls backed by the current API may be interactive; the current integration supports start, status, and end. Do not render pretend controls for transfer, conference, mute, hold, video, or in-call DTMF.
6. Connection and agent come from server-side integration configuration. No history/recents, contacts/team/chat/voicemail navigation, agent selector, or connection selector is rendered.

Closing the panel must leave a call running; reopening it restores the current call from the authenticated API. Polling is bounded to one status request every three seconds while a call is active.

The BFF accepts 10–15 ASCII digits after normalization. The user may enter spaces, hyphens, parentheses, periods, and one leading `+`; remove these separators and the leading plus before sending. Reject other characters and lengths outside 10–15 digits. Preserve the user's entered presentation in the input and confirmation; do not infer a country code or add a mask. The elapsed counter starts from the BFF's persisted `startedAt` when the attempt begins and updates locally; it approximates attempt time, not connected/audio duration. `duration_ms` does not schedule hangup.

The database holds one row per configured SDR session (`session_id` primary key). Reservation is an atomic conditional insert/update allowed only when prior state is `ended`. State transitions are `starting` (reserved before SDR POST), `active` (call ID bound), `uncertain` (ambiguous outcome), and `ended` (reservation released). An `uncertain` state blocks the shared connection. Recovery is operationally limited: escalate to the SDR/BFF maintainer; do not blind-retry or edit SQL manually. Production requires a verified runbook for checking the SDR outcome and controlled reconciliation.

## Accessibility and invariants

- Preserve existing topbar, route behavior, palette, labels, and shell geometry.
- Trigger, keypad keys, number display, confirmation, retry, and hangup work by keyboard and show visible focus. Controls meet the project's 44px target where applicable.
- The dialog has an accessible heading and the trigger has a state-aware accessible name. Escape closes the panel unless confirmation is open, then focus returns to the trigger.
- On narrow screens, keep the panel within the viewport. If presented as a modal sheet, set modal semantics and keep Tab/Shift+Tab within it; otherwise keep it explicitly non-modal and do not claim focus containment.
- Keep text/icons on stable plates with existing foreground/status tokens; respect reduced motion and provide a legible fallback without backdrop blur.
- No phone number, SDR token, transcript, or call history is persisted or rendered beyond the current call's UI state.
- Ambiguous call creation results must keep the retry-blocking state visible; never prompt a blind second call.
- A shared configured SDR connection can have one unresolved call at a time. A second user gets a generic busy state without the first user's number or call identifier.

## Acceptance criteria

- One topbar action opens and closes the compact dialer without changing existing shell dimensions or routes; opening the panel does not move page content.
- A user can enter a valid number with the keypad or keyboard and correct it with backspace.
- “Ligar” visibly opens a confirmation above the panel on desktop and mobile; confirming sends exactly one BFF start request. Cancel sends none.
- Active state and duration update; hangup is an explicit action; a successful hangup returns to the empty keypad while leaving the floating panel open; closing/reopening does not terminate the call.
- Busy shared connection and uncertain result states explain the block without exposing another user's call details; uncertain results do not offer blind redial.
- Input accepts only the documented 10–15 digit normalization rules; visible duration is based on persisted BFF attempt start time, not asserted connected duration.
- No agent/connection selector or call history is present; unsupported in-call controls are not presented as active.
- Keyboard, focus restoration, narrow viewport/reflow, reduced motion, glass fallback, and contrast pass the applicable Aurum Lex acceptance criteria.

## QA status

Regression coverage verifies fixed positioning, cancel-without-POST, one POST only after explicit confirmation, and return to the empty keypad after successful hangup. Local desktop QA confirmed the panel stays fixed and header/content geometry is identical before and after opening. Mobile screenshots, keyboard/focus checks, contrast measurements, fallback review, and manual confirmation that the keypad fits remain NOT_VERIFIED. Production readiness also requires a verified operational runbook for uncertain-call reconciliation.
