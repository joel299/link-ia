# AppShell

Status: EXISTING component; shared desktop shell and glass refinements implemented; browser spot-check passed at 1476×720; contrast, mobile and scroll QA PENDING.

## Registry
- ID: UI-SHELL-001
- Path: src/components/AppShell.tsx; src/routes/__root.tsx
- Responsibility: Envolve rotas autenticadas com navegação, topbar, sessão, conteúdo e mobile drawer.
- Dependencies: TanStack Router, fetch session/logout, Lucide, styles.css.
- Current appearance: Sidebar e header compartilham camada de vidro; header sticky contínuo, com divisor inferior e controles de conta sem cápsulas/contornos independentes.
- Current tokens: background, sidebar, border, foreground, gold, radius, shadow.
- Applied tokens: glass.subtle no header/sidebar/drawer; glass.standard em painéis; resultados jurídicos densos mantêm superfície estável; foco acima da superfície.
- Visual references: REF-003, REF-004, REF-006, SUP-008
- Recommended tier: glass.subtle; fallback denso/sólido
- Anatomy: shell externa; plate para menu e conteúdo; nav; foco topmost.
- Variants: desktop sidebar fixa; mobile drawer.
- States: loading session, authenticated, redirect; nav active/open; hover/focus; logout.
- Responsiveness: sidebar em lg; drawer abaixo; manter viewport e scroll.
- Accessibility: menu, busca e notificações nomeados; drawer modal com Escape, foco inicial, ciclo de Tab e retorno do foco ao acionador. Skip link permanece pendente.
- Risks: blur sob header pode reduzir contraste; action icon sem label; não mudar sessão.
- Invariants: rotas, logout, redirect, perfil, nav ativa e largura de conteúdo.
- Geometria obrigatória: uma sidebar fixa na borda esquerda. Header e conteúdo começam exatamente depois dela. Não combinar sidebar reservada no fluxo flex com outro `padding-left`/`margin-left` de largura igual. Gutter preto vazio de uma largura de sidebar é FAIL.
- Causa confirmada: a regra `.glass-subtle { position: relative }` sem camada sobrescrevia a utility `fixed`, mantendo a sidebar no fluxo flex; `lg:pl-64` acrescentava uma segunda largura. A sidebar agora usa o seletor semântico `.glass-subtle.app-sidebar` para permanecer fixa, e o conteúdo recebe um único `lg:ml-64`.
- Paleta imutável nesta tarefa: carvão/preto, creme/bege e dourado existentes. Referências de vidro não substituem as cores do produto.
- Migration priority: P1

## Acceptance criteria
navegação e teclado iguais; shell continua legível em scroll e fallback; screenshot desktop mostra sidebar encostada à borda e conteúdo imediatamente após a sidebar, sem gutter duplicado; efeito glass perceptível por borda, highlight, blur e plate mantendo leitura.

## Required checks
screenshots desktop/mobile; Tab/Shift+Tab/Escape; session loading/error.

No browser spot-check em desktop 1476×720, a barra superior alinhou com a sidebar e o material ficou visível nos painéis compartilhados. Ainda faltam comparação arquivada antes/depois, mobile, scroll prolongado, contraste medido e fallback. Preserve contratos de rota e API.
