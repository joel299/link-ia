# Publicar a documentação no Scalar

Este projeto está preparado para publicar uma referência da API e guias para pessoas que vão integrar o LinkIA. A especificação cobre as 48 rotas existentes (68 operações HTTP); 19 operações de menor risco estão disponíveis no MCP, conforme os escopos de cada token.

## O que precisa estar definido na conta Scalar

O namespace aparece no Scalar CLI. Ele ainda não foi confirmado nesta sessão, então o valor `__SCALAR_TEAM_NAMESPACE__` em `scalar.config.json` é um marcador e precisa ser substituído antes da publicação. O slug da API escolhido para esta configuração é `linkia-api`; confira se ainda não existe na equipe. A verificação é somente leitura.

O CLI atual requer Node.js 24 ou mais recente. Depois que a sessão Scalar estiver autenticada, confira a equipe e os itens existentes antes de criar ou atualizar qualquer coisa:

```powershell
npx -y @scalar/cli@latest auth whoami
npx -y @scalar/cli@latest team list
npx -y @scalar/cli@latest team get
npx -y @scalar/cli@latest registry list --namespace NAMESPACE_DA_EQUIPE
npx -y @scalar/cli@latest project list
npx -y @scalar/cli@latest sdk list --namespace NAMESPACE_DA_EQUIPE
```

Se o slug já estiver ocupado, não use `--force` nem publique sobre a entrada existente. Escolha um slug livre e ajuste este arquivo e `scalar.config.json` para ele.

## Publicar a especificação e criar o SDK

Depois da verificação de duplicidade, publique `openapi.yaml` no Registry e crie um SDK TypeScript a partir da mesma entrada:

```powershell
npx -y @scalar/cli@latest registry publish scalar-docs/openapi.yaml --namespace NAMESPACE_DA_EQUIPE --slug linkia-api --version 1.0.0
npx -y @scalar/cli@latest sdk create --namespace NAMESPACE_DA_EQUIPE --api linkia-api --language typescript
```

O comando `sdk create` é o passo solicitado para criar o SDK. Não execute `sdk build`. A documentação atual do Scalar marca o gerenciamento/criação de SDK pelo CLI como recurso Enterprise; confirme a disponibilidade da operação na conta antes de executar.

O Registry deve publicar com visibilidade pública para que a documentação pública consiga carregar a referência. A API em produção continua exigindo token JWT nas operações privadas.

## Publicar o projeto Docs

Após substituir o namespace no arquivo de configuração e confirmar que a referência do Registry aponta para `linkia-api`, valide e publique os arquivos locais:

```powershell
npx -y @scalar/cli@latest project check-config --config scalar-docs/scalar.config.json
npx -y @scalar/cli@latest project publish --slug linkia-api-docs --config scalar-docs/scalar.config.json
```

O projeto usa `scalar-docs/linkia-theme.css` a partir dos tokens LinkIA e declara o subpath `/v1/api/docs`. Depois de publicar, defina `SCALAR_DOCS_URL` no Coolify com a URL HTTPS gerada pelo Scalar, incluindo o subpath, para que `https://linkia.iainfinito.com.br/v1/api/docs` encaminhe para a documentação publicada.

## Situação de publicação nesta tarefa

Os arquivos estão preparados e a configuração não usa OpenAPI local como referência de navegação; a rota `/api` aponta para namespace e slug do Registry. A publicação não é afirmada até que o CLI esteja autenticado, o namespace real seja confirmado, a duplicidade seja conferida e o retorno do comando forneça a URL de produção.
