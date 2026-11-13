# Arquitetura visual e dependências

Status: CURRENT + TARGET

Grafo de responsabilidades observadas, não promessa de que todos os domínios já estejam completos.

    Usuário → TanStack Router → AppShell (sessão, navegação e header)
      → rotas: Dashboard | Jurisprudência | Debate | Atendimento | Configurações
      → Panel / Tag / componentes shadcn-Radix / tokens CSS
      → API Go /api/v1 (fatias implementadas)
          → PostgreSQL e migrations
          → worker de jurisprudência → dados oficiais STJ
          → Codex para classificação
    Design System Registry --tokens e baseline--> UI compartilhada

O grafo não implica dados reais em toda rota: Debate e Atendimento exibem estados de demonstração; Jurisprudência e parte de Configurações possuem chamadas ao backend.

## Stack observada
React ^19.2.0; TanStack Start 1.168.60; Router 1.170.41; Tailwind CSS ^4.2.1; Vite 8.1.5; TypeScript ^5.8.3; TanStack Query, Zod, Recharts, Lucide e wrappers Radix/shadcn. Backend Go em backend/, API OpenAPI em api/openapi.yaml, migrations PostgreSQL e worker de jurisprudência.

## Estilo atual
Tokens e utilities em src/styles.css: fundo, texto, surfaces, radius, gradient, shadow, panel, hover, entry motion. AppShell tem backdrop-blur-xl no header e blur no overlay mobile; isso não constitui material Liquid Glass completo. Não foi achada engine ou persistência de tema.

## Futura cadeia visual
Componente → token semântico → glass tier → shell → plate → conteúdo e estado → fallback. Componente não inventa paleta nem recalcula cores. QA usa a mesma peça em vários fundos, densidades e viewports.

## Temas futuros
Não existe persistência visual. Tema deve ficar no escopo de usuário/escritório após decidir a autoridade de conta/permissões. Nenhum endpoint ou migration foi criado nesta tarefa.
