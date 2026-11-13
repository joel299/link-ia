# Tipografia
Status: EXISTING + PROPOSED

## Fontes confirmadas
Display: Cormorant Garamond, fallback Georgia/serif. Corpo: Manrope, fallback system-ui/sans-serif. Pesos importados em src/routes/__root.tsx: Manrope 400, 500, 600, 700; Cormorant Garamond 500, 600, 700. Títulos h1-h3 e .font-display usam display e letter-spacing 0.01em.

## Hierarquia atual observada
Dashboard hero usa 4xl e md:5xl; títulos de rota 2xl/md:3xl; headings de painel xl; corpo frequente sm; captions e metadados xs e 10px. Trata-se de inventário, não de aprovação de legibilidade.

## Preservação e proposta
Manter famílias e hierarquia, nunca reduzir texto para acomodar glass. Para texto corrido em mobile, alvo futuro mínimo 16px; texto abaixo de 12px precisa justificativa, alternativa e validação de zoom. Usar Manrope/tabular figures para colunas de números e processos. Long copy deve sentar sobre plate reforçada.

## Verificação
Confirmar fonte em rede lenta/offline, fallback, 200% zoom, line-wrap e largura de leitura. Root declara lang=en apesar da interface PT-BR; registrar como pendência, não corrigir nesta tarefa.
