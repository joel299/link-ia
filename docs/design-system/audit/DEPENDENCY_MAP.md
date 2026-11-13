# Mapa de dependências visuais
Status: AUDITED

## Root
src/routes/__root.tsx importa src/styles.css, declara HTML/root e carrega Google Fonts. routeTree.gen.ts é gerado; AGENTS.md proíbe edição manual.

## Shell e rotas
Rotas autenticadas importam AppShell. AppShell depende de TanStack Router, Lucide e endpoints de sessão/logout; Panel depende da utility .panel; Tag depende de tokens de status. Jurisprudências também depende de TanStack Query e API. Settings depende de auth, settings de jurisprudência e Codex device login.

## Estilos e tokens
src/styles.css tem :root, @theme inline, radius derivado, gradients, shadows, panel/hover, gold-line, page-enter, stagger e pulse-gold. Header/overlay têm backdrop blur; não há stylesheet por feature no inventário auditado. Tailwind class strings e poucos styles inline são usados por rota.

## UI local
src/components/ui/* contém wrappers Radix/shadcn. Componentes consomem tokens Tailwind/CSS. Reutilizar dependências instaladas; não adicionar outra biblioteca para produzir borda ou blur.

## Dados
src/lib/mock.ts fornece parte de dashboard/debate/atendimento. API e backend têm jurisprudência, Codex e login local. Modificação visual não deve mudar propriedade ou fluxo de dados.
