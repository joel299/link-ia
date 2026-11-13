# Riscos e decisões abertas
Status: tracked

| Risco | Evidência | Impacto | Mitigação/proprietário |
|---|---|---|---|
| Paleta com texto/transparência pode falhar AA | contrast ratios ainda não calculados | leitura/foco | medir composição final; QA |
| SDD declara backend ausente embora haja slice Go | docs/SDD.md vs backend/README e migrations | arquitetura desatualizada | corrigir SDD em tarefa documental |
| Projeto não tem .git no caminho informado | git rev-parse falhou e .git ausente | registry não versionado/sem diff | confirmar checkout e inicializar/usar VCS em processo separado |
| Não há screenshot runtime da UI nesta execução | browser automation inacessível | baseline apenas source-based | capturar baseline no próximo task |
| Valores glass são aproximados | sem prototype real | estética/performance | tratar números como proposta e medir |
| Refração pode exigir shader | não é CSS nativo | dependência/custo | usar cues CSS simples; justificar shader à parte |
| Temas não têm persistência/escopo definido | busca não achou store | preferência/vazamento | decidir auth/office scope antes do backend |
| Mock de debate/atendimento parece real | código e timers locais | confiança do usuário | preservar rótulo demo e QA |
| Imagens claras conflitam com identidade dark | ativos supplied | troca indevida da paleta | reference material only, palette locked |

## Gates
Nenhum risco é declarado resolvido por documento. Itens que afetem contrato, produção ou dados são separados da implementação visual.
