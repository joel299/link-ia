# Fase 4 — Theme Engine
Status: proposta condicional; não há preference store

## Objetivo
Habilitar temas configuráveis e editor somente depois de definir escopo e política de acesso.

## Pré-requisitos
Sessão/authorization estável; decisão se escopo é usuário ou escritório; schema/version; política de contraste e tema default; backend contract e armazenamento aprovados.

## Sequência
Prototipar editor isolado; validar schema e contrast; aplicar preview sem persistência; aprovar modelo/contrato; implementar serviço/endpoints/migrations numa tarefa própria; criar persistência/versionamento e rollback; QA de acesso e temas.

## Riscos
Uma preferência vazar entre escritórios, custom color falhar contraste, schema incompatível, aplicar CSS arbitrário, fallback sem tema.

## Aceite
Permissões verificadas no servidor; tema original restaurável; schema versionado; inválidos rejeitados; contraste e fallback passam.

## Rollback
Aplicar original.json; manter último tema válido; feature flag para desligar editor. Storage/migrations necessitam plano próprio aprovado.

## Responsável/evidência
Arquitetura/orchestrator define contrato; Frontend editor; backend persiste após aprovação; QA verifica autorização, contraste e carregamento.
