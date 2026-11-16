# Acesso e chave pessoal

## Como funciona

O administrador cria uma chave para um usuário do LinkIA. A chave é pessoal e só pode ser vista na criação. Ela vence na data definida e pode ser revogada pelo administrador.

Envie a chave no cabeçalho de cada chamada:

```http
Authorization: Bearer SUA_CHAVE_LINKIA
```

Não envie credenciais em parâmetros de URL ou no corpo da solicitação.

## O que a chave pode acessar

O acesso combina três verificações:

1. **Usuário:** a chave identifica a conta LinkIA à qual pertence.
2. **Permissão da chave:** o administrador escolhe quais operações a chave pode executar. Acesso de escrita é opt-in e deve ser liberado separadamente dos acessos de consulta.
3. **Recurso liberado:** a conta precisa ter o canal correspondente autorizado e conectado.

Uma chave não concede papel de administrador. As rotas de administração, login, cadastro, callbacks de provedores e webhooks não são ferramentas do MCP. Para ativar uma campanha, o usuário precisa pedir explicitamente essa ação; a confirmação da API não substitui esse pedido.

## Proteja sua chave

- Guarde-a em um cofre de segredos do agente ou do servidor.
- Não a coloque no código-fonte, em logs, no navegador ou em prompts públicos.
- Use uma chave por integração, com o menor conjunto de permissões necessário.
- Revogue chaves antigas quando um agente deixar de ser usado.
- Ao suspeitar de vazamento, revogue a chave imediatamente.

## Respostas de acesso

- `401`: a chave não foi enviada ou não é mais válida.
- `403`: a chave é válida, mas não tem permissão para essa operação ou canal.
- `429`: limite de chamadas atingido; aguarde antes de repetir.

## MCP

O servidor MCP usa o mesmo usuário e as mesmas permissões da API. Cada chamada é verificada e limitada a 120 solicitações por minuto por chave. A conexão usa Streamable HTTP; clientes MCP devem manter o cabeçalho Bearer configurado no servidor, não em instruções visíveis ao usuário.
