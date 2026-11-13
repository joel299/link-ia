# Changelog

## 2026-10-29 — Síntese final do Debate
- Adicionada uma síntese final responsiva após a conclusão do Juiz, usando somente dados já persistidos e decisões da base local.
- Separadas decisões candidatas da base e citações declaradas pelo Juiz; fontes e estado de verificação permanecem visíveis.
- Mantida a métrica Cobertura de verificação; nenhum nível de confiança ou botão de encaminhamento fictício foi adicionado.
- Registrados como congelados os contratos dos três perfis Hermes validados pelo proprietário. Nenhuma chamada, prompt, contrato ou sequência Hermes foi alterada.
- QA visual em navegador permanece pendente.

## 2026-10-28 — Referências do painel de entrada do Debate
- Copiadas três capturas do usuário byte a byte e registradas como REF-011–REF-013 com hashes SHA-256.
- Documentada a proposta de Magic Step, barra Plano/Perguntar/Modelo/Esforço e formato comum dos resultados em `components/DEBATE.md`.
- Mantida a paleta Aurum Lex; a implementação na rota continua pendente.
- Registradas as três personas em prompts separados e contratos backend por perfil; a API de aplicação ainda está em integração.
- O contrato de interface documenta que o primeiro fluxo recebe o resumo do processo informado pelo usuário; não existe cadastro de processos no banco desta versão.

## 2026-10-27 — Correção de shell, Liquid Glass e carga inicial da jurisprudência
- Corrigida a colisão de cascata CSS que mantinha a sidebar no fluxo e criava um segundo gutter; conteúdo passa a iniciar após uma largura da sidebar.
- Corrigidos sticky e contorno superior do header; removidos contornos que faziam busca/perfil parecerem cápsulas independentes.
- Aplicado material visível a shell e painéis compartilhados, preservando listas jurídicas densas com superfície estável e cores existentes.
- Removida a paginação automática: busca inicial limitada a 20 pelo backend e próxima página somente pelo botão; cache da pesquisa mantido por 30 segundos.
- Prompt de classificação recolhido por padrão. Consulta nova classifica resultados atuais; falha pode ser reenfileirada por decisão, mantendo cache válido para economizar.
- Seed e registros existentes foram preservados. QA visual e contraste seguem pendentes até conferência no navegador.

## 2026-10-27 — Primeira fatia Liquid Glass
- Aplicados shell/plate/content no shell, navegação e resumo do dashboard, preservando a paleta e os fluxos existentes.
- Drawer móvel recebe foco inicial, ciclo de foco, fechamento por Escape e retorno do foco ao botão acionador.
- Estado de QA visual, contraste e performance registrado como pendente; validação humana ainda necessária.
- Atualizado o plano de migração para refletir implementação parcial, sem declarar a fase concluída.

## 2026-10-27 — Registry V1 documental
- Criadas auditoria, foundations, materiais, tokens, temas futuros, fichas de componentes, QA, agentes e roadmap.
- Copiados dez ativos de referência únicos; os originais foram preservados e SHA-256 registrado.
- Registrada divergência entre SDD de 26/10 e backend Go parcial encontrado em 27/10.
- Nenhum código produtivo, API, migration, dado ou regra de negócio alterado.
- Estado: READY FOR HUMAN REVIEW; valores de vidro e contraste ainda dependem de protótipo e teste.
