# Design atual — baseline
Status: EXISTING

## Canvas e shell
src/styles.css define color-scheme dark e fundo com radial-gradient dourado discreto fixo. AppShell usa sidebar fixa no desktop, header sticky de 80px, main com p-5 e md:p-8. A coluna lateral é ocultada abaixo de lg e abre drawer mobile.

## Superfícies
Utility .panel usa gradient-card, borda border, radius-xl e shadow-card. .panel-hover transiciona 300ms e faz lift de 2px. Header usa fundo background/75 e backdrop-blur-xl; overlay mobile usa background/80 e blur. Não há faixa de highlight, micro-noise ou placa interna unificada.

## Tipografia e hierarquia
Cormorant Garamond em títulos; Manrope no corpo. Títulos principais variam em classes text-2xl a text-5xl; corpo usual text-sm e metadados text-xs ou 10px. O tamanho mínimo observado requer QA em zoom e densidade.

## Rotas e dados
Dashboard usa arrays de src/lib/mock.ts. Jurisprudência chama API e pagina resultados. Debate exibe atores/argumentos fixos e avança por setTimeout. Atendimento usa conversas e resposta mock local temporizada. Configurações usa APIs de sessão, análise jurídica e login Codex. Login demonstra autenticação local de desenvolvimento.

## Funcionalidades a preservar
Nav ativa, drawer, sessão/redirect/logout, busca, botão de notificações, perfil, consultas/paginação, detalhe em Dialog, salvar configurações de IA, iniciar login Codex, loading/error e conteúdo de cada rota. Estados de demonstração permanecem identificados como tais.

## Acessibilidade observada
Slider possui foco e reduced motion local. Primitives Radix incluem suporte de teclado, mas não provam conformidade dos usos. Root declara lang=en enquanto conteúdo está em português; alguns botões de ícone, como busca/notificação/menu, merecem revisão. Sem verificação runtime.
