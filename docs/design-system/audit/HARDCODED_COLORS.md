# Inventário de cores literais
Status: AUDITED

## Paleta do produto
Os tokens do :root em src/styles.css estão transcritos em foundations/COLORS.md e tokens/primitives.json com valores OKLCH exatos. Incluem background, foreground, card/popover, gold, primary/secondary, muted/accent, status, border/input/ring, charts e sidebar. Gradientes e sombras também são tokens existentes.

## Literais fora da paleta
src/lib/error-page.ts contém #fafafa, #111, #4b5563, #fff e #d1d5db para uma página de erro isolada. src/components/ui/chart.tsx contém #ccc e #fff dentro de seletores de compatibilidade Recharts. Não são a paleta da aplicação.

## Utilities e JSX
Rotas referenciam tokens por classes (gold, background, border) e opacidade Tailwind (por exemplo bg-gold/10). Esses usos não criam novas primitivas. Estilos inline pontuais e charts devem ser revisados quando forem migrados.

## Política futura
Não inserir novos hex/OKLCH em JSX. Adicionar primitive e mapping semântico primeiro; validar texto, ícone, estado e foco sobre shell/plate; manter original.json como baseline.
