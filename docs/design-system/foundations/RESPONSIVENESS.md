# Responsividade
Status: EXISTING + PROPOSED

O projeto usa classes Tailwind sm, md e lg; existe src/hooks/use-mobile.tsx. Nenhum breakpoint custom está definido em src/styles.css. Referência dos defaults Tailwind comuns: 640, 768, 1024px; confirmar config efetiva antes de congelar números.

## Atual
AppShell mantém sidebar fixa em lg e drawer abaixo. Dashboard usa grids responsivos. Atendimento tem três colunas em lg e min-height 600px, o que requer revisão de viewport baixa.

## Futuro
Mobile-first, sem zoom bloqueado nem scroll horizontal inesperado. Refluxo em tabelas com solução acessível. Reduzir blur em mobile ou hardware restrito; fallback conserva layout e estado. Testar retrato/paisagem, 320 CSS px, tablet e desktop, zoom a 200% e teclado.
