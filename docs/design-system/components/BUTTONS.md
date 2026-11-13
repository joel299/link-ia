# Botões

Status: EXISTING component; glass treatment PROPOSED.

## Registry
- ID: UI-ACT-001
- Path: src/components/ui/button.tsx; rotas usam alguns button nativos
- Responsibility: Executar uma ação primária/secundária com retorno claro.
- Dependencies: CVA, Tailwind, focus ring, token primary.
- Current appearance: Variants default/destructive/outline/secondary/ghost/link; rota também usa classes diretas.
- Current tokens: primary, primary-foreground, destructive, border/input, ring.
- Future tokens: subtle/dense surface conforme hierarquia; glass não transforma botão em pill genérico.
- Visual references: REF-002, REF-005
- Recommended tier: glass.subtle; não aplicar shell elevada a todo botão
- Anatomy: fundo/borda, label/icon, focus outline externo.
- Variants: variants da CVA e botões de rota existentes.
- States: default, hover, focus-visible, pressed, disabled, loading, error result.
- Responsiveness: hit target confortável e label pode quebrar sem crop.
- Accessibility: button type explícito; accessible name; foco visível; disabled real.
- Risks: botões nativos diretos variam; shimmer não substitui estado.
- Invariants: handlers, submit semantics, disabled logic.
- Migration priority: P2

## Acceptance criteria
uma ação primária por seção; no row of pills; foco permanece claro.

## Required checks
teclado, pressed visual, disabled, loading e fallback.

No proposed material is present in production. Implement only in a separately approved task, compare to baseline and preserve existing route and API contracts.
