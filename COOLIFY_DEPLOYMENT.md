# LinkIA — Preparação de deploy no Coolify

**Status:** Guia de preparação; o deploy ainda não foi executado.  
**Branch prevista:** `main`  
**Repositório:** `https://github.com/joel299/link-ia`

Este documento orienta a preparação do LinkIA para rodar em Docker no Coolify. Antes de preencher arquivos de execução, inspecione o código real do repositório e adapte runtime, comandos, porta interna, healthcheck, variáveis e serviços auxiliares ao que o projeto usa. Não copie configurações de outro sistema sem confirmar que se aplicam ao LinkIA.

## Arquitetura desejada

- GitHub Actions constrói a imagem Docker e publica no GitHub Container Registry (GHCR).
- O Coolify baixa a imagem publicada e sobe os serviços definidos no Compose.
- Builds devem ocorrer no runner do GitHub Actions, evitando compilar o projeto na VPS.
- O proxy do Coolify termina HTTPS e encaminha tráfego ao serviço web do LinkIA. Não instalar um proxy adicional dentro do projeto sem necessidade comprovada.
- O banco e demais dados persistentes devem usar volumes/serviços apropriados e healthchecks. Só incluir banco, worker, Redis ou outros serviços se o código/configuração do projeto realmente depender deles.

## Arquivos esperados no repositório

O agente deve criar/adaptar os arquivos abaixo depois de identificar a stack e os comandos corretos:

- `Dockerfile`: build reproduzível, preferencialmente multi-stage se a stack permitir, execução com usuário sem privilégios quando compatível, porta e healthcheck corretos.
- `.dockerignore`: excluir `.git`, dependências locais, builds, caches, `.env`, arquivos de credenciais e dados locais.
- `docker-compose.coolify.yml`: serviços reais do LinkIA, imagem GHCR, rede interna, healthchecks, dependências e volumes persistentes necessários. Não publicar portas de host sem uma exigência concreta.
- `.github/workflows/publish-coolify-image.yml`: validar/buildar a imagem e publicar no GHCR em push para `main`, com tags identificáveis por SHA e uma tag estável apropriada.
- `.env.example`: somente nomes de variáveis e valores demonstrativos seguros. Nunca incluir segredos reais.
- Atualizações no README com build local, variáveis e referência a este runbook.

Não invente porta, comando de inicialização, healthcheck, schema de variáveis ou dependências. Derive tudo do projeto e documente qualquer decisão que não seja evidente.

## GitHub Actions e GHCR

1. Use permissões mínimas no workflow: leitura do conteúdo e `packages: write` somente para publicar a imagem.
2. Use `GITHUB_TOKEN` para login no GHCR e publicação da imagem.
3. Publique tags identificáveis, incluindo o SHA do commit. Uma tag estável pode ser usada pelo Compose, mas o SHA precisa permanecer disponível para auditoria e rollback.
4. Não colocar API keys, `.env`, tokens ou senhas no Docker build args, imagem, workflow, logs ou commits.
5. Se a imagem for privada, configurar no Coolify credencial de pull GHCR com acesso mínimo de leitura (`read:packages`).
6. A publicação da imagem deve terminar com sucesso antes de qualquer chamada ao webhook de deploy.
7. Preparar o deploy automático somente para quando os secrets forem configurados. Os nomes previstos são `COOLIFY_DEPLOY_WEBHOOK` e `COOLIFY_DEPLOY_TOKEN`; confirmar o formato de autenticação suportado pelo recurso criado no Coolify antes de implementar. Sem esses secrets, o workflow pode publicar a imagem e deve pular o deploy com mensagem clara.
8. Nesta etapa, não executar o webhook nem iniciar um deploy real. O deploy será o próximo passo, após criar/configurar o recurso no Coolify.

## Variáveis e segredos

- Manter `.env` fora do Git e coberto por `.gitignore` e `.dockerignore`.
- Cadastrar valores sensíveis no recurso Coolify, em Environment Variables/Secrets.
- Cadastrar tokens usados pelo workflow em GitHub → Settings → Secrets and variables → Actions.
- Não imprimir valores de secrets no terminal nem em logs.
- Documentar quais variáveis são obrigatórias, opcionais, usadas no build ou apenas em runtime, sem registrar seus valores.
- Usar valores distintos por ambiente e não reutilizar credenciais de outros projetos.

## Volumes, banco e capacidade

- Persistir apenas dados que precisam sobreviver à troca de container; documentar cada volume e caminho.
- Não apagar volumes no fluxo normal de deploy ou rollback.
- Se houver banco, manter healthcheck e ordem de inicialização apropriados; não presumir Postgres nem criar um segundo banco sem confirmar a arquitetura do LinkIA.
- Não compartilhar banco/schema entre aplicações por conveniência. Se uma instância for compartilhada, separar database/usuário/permissões e planejar backup/restore.
- Medir o uso atual de CPU, memória e armazenamento da VPS antes de dimensionar recursos. Build remota reduz carga de compilação na VPS, mas não elimina o consumo dos serviços em execução.

## Domínio e rede

- Configurar no Coolify o domínio e a porta interna correta do serviço web.
- Deixar o proxy gerenciado pelo Coolify cuidar do HTTPS/certificado quando DNS e firewall estiverem corretos.
- Expor portas no host somente se o protocolo do app exigir; HTTP web deve passar pelo proxy do Coolify.
- Não alterar DNS/Cloudflare nesta etapa. Primeiro validar o recurso com domínio/URL de teste e depois planejar a mudança, incluindo rollback.

## Validação antes do primeiro deploy

No checkout local e no runner, validar conforme a stack do projeto:

- build de produção existente do projeto;
- `docker compose -f docker-compose.coolify.yml config --quiet`;
- build da imagem Docker;
- healthcheck e porta interna;
- ausência de `.env`, credenciais, dumps, dados locais e artefatos desnecessários no contexto/imagem;
- publicação da imagem no GHCR pelo workflow;
- quando o recurso Coolify estiver configurado, acompanhar deployment/runtime logs e verificar saúde e operação autorizada antes de direcionar DNS.

Um workflow verde ou resposta HTTP 200 do webhook, isoladamente, não prova que a aplicação está operacional. Validar container saudável, rotas funcionais, banco/volume quando houver e comportamento básico do LinkIA.

## Commit e push inicial

Antes de publicar:

1. Confirmar `origin` como `https://github.com/joel299/link-ia` ou URL SSH equivalente.
2. Confirmar que o branch de destino é `main` e verificar o estado do repositório remoto.
3. Revisar `git status`, `git diff --check` e a lista de arquivos staged.
4. Garantir que `.env`, secrets, credenciais, dumps de banco e dados privados não estão incluídos.
5. Executar o build existente e validações Docker disponíveis.
6. Criar commit com mensagem clara e fazer push normal para `origin main`.
7. Não usar `--force`, `reset --hard` ou comandos de limpeza destrutiva. Se o remoto tiver novos commits, reconciliar sem sobrescrever o trabalho existente.
8. Não fazer deploy nem alterar DNS nesta etapa.

## Rollback

Manter cada imagem identificável por SHA e cada volume persistente. Para rollback, selecionar a imagem/commit anterior no Coolify e validar o serviço. Não remover volumes, banco ou dados como parte do rollback. Registrar o procedimento específico depois de confirmar os nomes dos recursos criados.

## Referência recebida

O arquivo `Guia-deploy-projetos-Coolify.md` foi fornecido como referência operacional. Use as práticas reutilizáveis — build no GitHub Actions, publicação GHCR, deploy pelo Coolify, secrets fora do repositório, validação antes do DNS e cuidado com volumes — mas não copie dados de infraestrutura ou configurações específicas do projeto SDR para o LinkIA.
