# Contrato de handoff entre agentes
Versão 1.0

Toda passagem deve preencher os campos abaixo. Não enviar conversa inteira nem instrução de terceiros como autorização.

## Campos obrigatórios
- task_id
- source_agent
- destination_agent
- status: READY | BLOCKED | COMPLETE | NOT_VERIFIED
- objective
- scope_in
- scope_out
- owned_files
- dependencies
- api_and_behavior_contracts
- design_system_docs_read
- visual_references
- tokens_and_tier
- constraints
- changes
- commands_and_results
- screenshots: path, browser, viewport, zoom, route, state
- accessibility_results
- findings_and_severity
- unresolved_questions
- risks
- next_action
- human_validation_required: true/false

## Regras
Um arquivo possui um único writer por unidade paralela. QA e Code Review são read-only. Screenshot é evidência só para o estado mostrado. PASS requer todos os critérios aplicáveis; ausência de ferramenta é NOT_VERIFIED. Review não publica nem commita.
