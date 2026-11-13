# Inputs, labels e formulários

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-FORM-001
- Path: src/components/ui/input.tsx; textarea.tsx; form.tsx; formulários em rotas
- Responsibility: Capturar busca, mensagem, prompt, modelo, filtro e configurações.
- Dependencies: Radix/form wrappers, Zod/resolvers quando usados, tokens input/ring.
- Current appearance: Input transparente, borda e focus ring; alguns forms usam placeholder.
- Current tokens: background, input, foreground, muted-foreground, ring, destructive.
- Future tokens: glass.dense com plate sob label, campo e helper/error.
- Visual references: REF-002, REF-004, SUP-007, SUP-009
- Recommended tier: glass.dense
- Anatomy: surface/control plate, label, control, helper/error.
- Variants: text, textarea, search, range/select conforme arquivo.
- States: empty, populated, focus, invalid, disabled, loading, success.
- Responsiveness: width fluida; não autozoom em mobile; labels visíveis.
- Accessibility: label for, aria-describedby, error ligado ao campo, keyboard, 44px produto alvo.
- Risks: placeholder-only label e scrim insuficiente.
- Invariants: names, validation, request payload and handlers.
- Migration priority: P1

## Acceptance criteria
texto legível em seis fundos e erro próximo ao campo.

## Required checks
long label, multiline, focus, invalid, zoom, keyboard.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
