# Design System Registry do Aurum Lex

Status: V1 documental + primeira fatia de implementação em revisão · 27/10/2026

Fonte única de verdade para a evolução visual do Aurum Lex. Preserva a identidade atual preto/carvão, bege/creme e dourado. A primeira fatia implementa o material Liquid Glass no shell e no resumo do dashboard; sua validação visual e de acessibilidade ainda está pendente.

## Como usar
1. Ler DESIGN_SYSTEM.md e GOVERNANCE.md.
2. Consultar audit/PROJECT_ANALYSIS.md e a ficha em components/ do elemento afetado.
3. Ler foundations/, materials/ e tokens/ pertinentes.
4. Abrir as referências de references/INDEX.md.
5. Planejar a implementação com agents/ e validar com quality/.

## Estados de informação
EXISTING = conferido no código indicado. PROPOSED = decisão para protótipo futuro, ainda não aplicada/calibrada. PENDING = evidência ou decisão ainda ausente. Não declarar proposta como teste aprovado.

## Mapa
audit/ registra o sistema atual; foundations/ define identidade; materials/ especifica glass; tokens/ estrutura valores; themes/ prepara personalização futura; components/ mapeia peças reais; quality/ define critérios; agents/ fixa prompts/hand-offs; roadmap/ ordena as fases.

## Fontes internas
O SDD existente está em ../docs/SDD.md; schema lógico em ../docs/SCHEMA-BANCO.md; planos e integrações em ../docs/. Há divergência no SDD sobre existência do backend Go; veja audit/PROJECT_ANALYSIS.md e use backend/README.md como referência da slice atual.

## Limite
A criação deste registry altera apenas documentos e arquivos de referência. Páginas, estilos produtivos, APIs, migrations, dados e regras permanecem intocados.
