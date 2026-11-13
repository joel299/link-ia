# Motion
Status: EXISTING + PROPOSED

## Baseline
.panel-hover tem transição de 300ms; page-enter 550ms; stagger chega a 600ms; pulse-gold repete 2.2s. .effort-slider remove transição em prefers-reduced-motion, mas não foi localizada regra global de movimento reduzido.

## Proposta futura
Microestado estrutural: 160–240ms; entrada até 300ms; saída mais curta que entrada. Animar opacity/transform quando possível. Não animar blur em áreas grandes nem bloquear ação. Motion deve explicar foco, pressão, abertura ou feedback, não decorar.

## Acessibilidade
Respeitar prefers-reduced-motion em toda animação visual, preservar estado sem animação e manter interação imediatamente disponível. Os valores são alvos propostos, não medidos.
