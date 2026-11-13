# Cores
Status: EXISTING palette + PROPOSED theme rules

Valores literais confirmados em src/styles.css, :root. Não converter para hex nem alterar na V1. Os tokens de effort são escala de intensidade da tela de configurações, não cor de marca.

| Token CSS | Valor exato | Grupo |
|---|---|---|
| --background | oklch(0.13 0.004 80) | Existente |
| --foreground | oklch(0.94 0.012 85) | Existente |
| --card | oklch(0.175 0.005 80) | Existente |
| --card-foreground | oklch(0.94 0.012 85) | Existente |
| --popover | oklch(0.17 0.005 80) | Existente |
| --popover-foreground | oklch(0.94 0.012 85) | Existente |
| --gold | oklch(0.78 0.12 82) | Existente |
| --gold-soft | oklch(0.86 0.08 88) | Existente |
| --effort-low | oklch(0.9 0.13 74) | Existente |
| --effort-medium | oklch(0.84 0.15 65) | Existente |
| --effort-high | oklch(0.78 0.16 56) | Existente |
| --effort-xhigh | oklch(0.72 0.17 48) | Existente |
| --effort-ultra | oklch(0.66 0.17 40) | Existente |
| --primary | oklch(0.78 0.12 82) | Existente |
| --primary-foreground | oklch(0.14 0.01 80) | Existente |
| --secondary | oklch(0.22 0.006 80) | Existente |
| --secondary-foreground | oklch(0.92 0.012 85) | Existente |
| --muted | oklch(0.21 0.005 80) | Existente |
| --muted-foreground | oklch(0.66 0.015 85) | Existente |
| --accent | oklch(0.25 0.02 82) | Existente |
| --accent-foreground | oklch(0.88 0.09 86) | Existente |
| --destructive | oklch(0.62 0.19 25) | Existente |
| --destructive-foreground | oklch(0.97 0 0) | Existente |
| --success | oklch(0.72 0.14 155) | Existente |
| --warning | oklch(0.78 0.15 65) | Existente |
| --border | oklch(0.78 0.12 82 / 14%) | Existente |
| --input | oklch(0.78 0.12 82 / 18%) | Existente |
| --ring | oklch(0.78 0.12 82 / 60%) | Existente |
| --chart-1 | oklch(0.78 0.12 82) | Existente |
| --chart-2 | oklch(0.6 0.08 80) | Existente |
| --chart-3 | oklch(0.45 0.04 80) | Existente |
| --chart-4 | oklch(0.86 0.08 88) | Existente |
| --chart-5 | oklch(0.35 0.02 80) | Existente |
| --sidebar | oklch(0.105 0.004 80) | Existente |
| --sidebar-foreground | oklch(0.85 0.012 85) | Existente |
| --sidebar-primary | oklch(0.78 0.12 82) | Existente |
| --sidebar-primary-foreground | oklch(0.14 0.01 80) | Existente |
| --sidebar-accent | oklch(0.2 0.015 82) | Existente |
| --sidebar-accent-foreground | oklch(0.88 0.09 86) | Existente |
| --sidebar-border | oklch(0.78 0.12 82 / 12%) | Existente |
| --sidebar-ring | oklch(0.78 0.12 82 / 60%) | Existente |

Gradientes existentes: gradient-gold = linear-gradient(135deg, oklch(0.88 0.09 90), oklch(0.74 0.13 78) 50%, oklch(0.6 0.11 70)); gradient-card = linear-gradient(160deg, oklch(0.2 0.008 80), oklch(0.155 0.004 80)). Sombras: shadow-gold = 0 10px 40px -12px oklch(0.78 0.12 82 / 35%); shadow-card = 0 1px 0 0 oklch(1 0 0 / 4%) inset, 0 20px 40px -24px oklch(0 0 0 / 80%).

Semântica existente: background/card/sidebar são superfícies; foreground e muted-foreground são texto; gold/gold-soft são marca e ação; destructive/success/warning são feedback. Não inferir contraste pelo nome. Contraste atual não foi calculado; QA deve medir em cada layer e estado antes de declarar WCAG.
