# Plano de migração visual
Status: fases 1 e 2 parcialmente implementadas; validação da primeira fatia pendente

## Ordem
1 Foundation: registry e inventário documentados; confirmar baseline visual e contraste.
2 Glass Material: primeira fatia no shell, navegação e resumo do dashboard; falta validar contraste, estados, fallback e performance.
3 Component Migration: migrar gradualmente por componente/rota, com QA por fatia.
4 Theme Engine: permitir temas e persistência somente após autorização de API/modelo de conta.

## Governança
Cada fase usa task template, ownership de arquivos, handoff, reviewer e QA. Uma fase não libera a próxima automaticamente; findings bloqueadores e decisões humanas param avanço. Rollback é por componente/feature flag ou restauração do diff da fase, sem migrations nesta entrega.

## Definition of done
Código executado e testado por fase separada; registry atualizado; contraste e screenshots evidenciados; baseline funcional preservada; validação humana do produto. Esta V1 não prova nenhuma mudança runtime.
