# Fase 1 — Foundation
Status: proposta

## Objetivo
Consolidar tokens de identidade sem mudar aparência/produto até a aprovação do registry.

## Dependências e sequência
Aprovar registry; corrigir a divergência factual do SDD em tarefa documental; confirmar estados e componentes via screenshot runtime; medir contraste da paleta atual; fechar token aliases sem alterar valores. Depois criar baseline por rota.

## Afetados
src/styles.css apenas numa tarefa de implementação explicitamente autorizada; documentação do Design System; nenhum backend.

## Riscos
Medições de contraste podem revelar problemas atuais; aliases podem duplicar tokens; Google Fonts pode faltar em offline.

## Aceite
Todos valores existentes rastreados; pares AA medidos; nenhuma alteração de paleta; todos componentes principais têm baseline e owner.

## Rollback
Se export de token alterar valor visual, reverter só foundation diff e revalidar.

## Responsável/evidência
Orchestrator coordena; Frontend/Gemini prepara token mapping e QA valida contraste/screenshot. Evidência: token diff, contrast report, captures com viewport e resultado do reviewer.
