# Análise do projeto existente
Status: AUDITED FROM SOURCE · 27/10/2026
Diretório auditado: C:\Users\Usuario\Documents\IA-Juridica. A captura de runtime não foi obtida; esta análise descreve código e configuração.

## Framework e dependências
React ^19.2.0; TanStack Start 1.168.60 e Router 1.170.41; Tailwind CSS ^4.2.1; Vite 8.1.5; TypeScript ^5.8.3; TanStack Query ^5.101.1; Zod ^3.25.76; Recharts ^2.15.4; Lucide React ^0.575.0; wrappers locais Radix/shadcn. Conferir package.json e components.json.

## Estrutura
src/routes contém dashboard, jurisprudências, debate, atendimento, configurações, login e root. src/components/AppShell.tsx expõe AppShell, Panel e Tag. src/components/ui reúne wrappers. src/styles.css possui tokens/estilos globais. src/lib/mock.ts guarda demonstrações. backend contém módulo Go, API, worker, testes e migrations. api/openapi.yaml contém contrato.

## Backend atual
Confirmados backend/go.mod, cmd/api/main.go, cmd/jurisprudence-worker/main.go, handlers HTTP, autenticação/Codex/jurisprudência, Postgres e migrations 0001 a 0005. backend/README.md descreve login local temporário, pesquisa STJ e classificação via Codex. Outros domínios são parciais/contract-only; não chamar o backend inteiro de concluído.

## Divergência existente
docs/SDD.md, versão 0.1 de 26/10/2026, diz que ainda não existe código Go, API ou banco. Isso conflita com a árvore atual. A referência factual para a slice implementada é backend/README.md e o código; o SDD requer atualização editorial futura. Não assumir que todas as rotas de negócio estão implementadas.

## Estilo e identidade
src/styles.css declara preto/carvão, texto creme, dourados, estados e charts em OKLCH; Cormorant Garamond e Manrope. src/routes/__root.tsx carrega Google Fonts. Paleta literal completa: foundations/COLORS.md. O material das imagens não troca essas cores.

## Estado dos elementos
AppShell, Panel e Tag existem; wrappers de UI locais cobrem botões, forms, table, dialog, sheet e feedback. Existe backdrop blur localizado no header e menu mobile. Não há shell/plate/highlight/stroke/noise/fallback padronizados como material.

## Preferências visuais
Busca por theme, localStorage, sessionStorage e IndexedDB não encontrou engine/persistência de temas. Configurações salva opções de classificação jurídica e Codex, não cores ou aparência. Nenhum endpoint/migration de tema está definido.

## Limitações
O prompt colado foi lido do arquivo de anexo. O link da conversa não expôs o conteúdo sem sessão; ele não foi usado como fonte. Captura visual automatizada da aplicação não foi obtida; comparações atuais são de fonte. O diretório informado não contém .git; arquivos ficam em disco, mas não estão atualmente versionados por Git.
