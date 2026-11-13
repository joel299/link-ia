# Baseline de preservação
Status: LOCKED FOR V1

## Identidade
Manter tokens preto/carvão, bege/creme e dourado em src/styles.css, Cormorant Garamond, Manrope e ícones Lucide. As cores azuis/claras das referências ensinam material, não substituem a paleta.

## Navegação e operação
Manter todas as rotas, sessão e redirect, abrir/fechar nav mobile, logout, busca, notification affordance, perfil e conteúdo. Camada de vidro não pode encobrir header, nav, mensagens ou foco.

## Integrações
Preservar chamadas de sessão, logout, settings de classificação, device login Codex e pesquisa/paginação/detalhe de jurisprudência; manter api/openapi.yaml e migrations sem alteração.

## Dados e estados
Não tornar exemplos de src/lib/mock.ts em dados juridicamente confirmados. Preservar carregamento, erro, vazio e sucesso existentes. Não alterar APIs ou lógica para acomodar efeito visual.

## Limite documental
Esta entrega escreve somente design-system/**, cópias de referências, uma nota curta de instrução no AGENTS.md e documentação de acurácia no SDD existente. Nenhum componente/style/API/schema/dado de negócio é modificado.
