# API LinkIA

Esta API permite consultar e administrar informações do seu próprio LinkIA. O acesso de agentes usa uma chave pessoal criada pelo administrador. A chave representa uma pessoa e respeita as permissões liberadas para ela no painel.

## O que você consegue fazer

- consultar perfis, links, catálogo, conexões e métricas de anúncios que pertencem à sua conta;
- consultar disponibilidade e dados públicos de uma página;
- solicitar alterações que sua chave tenha permissão para fazer;
- usar o mesmo acesso na API HTTP e no servidor MCP do LinkIA.

## Segurança em palavras simples

Nunca compartilhe sua chave. Ela permite que um agente aja como você dentro dos limites definidos pelo administrador. Não coloque a chave em páginas, documentos públicos, repositórios ou mensagens. Se ela vazar, peça ao administrador para revogá-la e criar outra.

Os dados e as conexões continuam vinculados ao usuário LinkIA. Uma chave não permite escolher o ID de outra pessoa para acessar os dados dela. Recursos como Meta Ads, TikTok Ads, Instagram, WhatsApp e Google Agenda também precisam estar liberados no painel e conectados à conta correta. Permissões de escrita são opt-in: o administrador precisa liberá-las separadamente, e cada chamada ainda confere os direitos do usuário e a propriedade do perfil.

## Ações que exigem atenção

Criar ou ativar anúncios pode gerar cobrança. Criar reservas pode registrar dados pessoais e criar eventos na agenda. Publicar uma página muda o que fica visível ao público. Essas ações só funcionam quando o administrador libera o escopo correto. Ativar campanha exige `confirmed: true` e deve ocorrer somente após pedido explícito do usuário. A API não transforma uma recomendação do agente em autorização financeira automática.

## Endereços

- API: `https://linkia.iainfinito.com.br/v1/api`
- Documentação: `https://linkia.iainfinito.com.br/v1/api/docs`
- MCP Streamable HTTP: `https://linkia.iainfinito.com.br/mcp`

Os endereços acima descrevem o destino pretendido. Só considere uma rota publicada depois que o deploy do Coolify for confirmado.

## Catálogo das rotas

Consulte [endpoints.md](./endpoints.md) para ver, em linguagem direta, o que cada grupo faz e quais operações ficam disponíveis para o MCP. O catálogo legível por sistema, com escopo e campos obrigatórios de cada operação, está em [endpoints.json](./endpoints.json). A especificação OpenAPI completa está em [openapi.yaml](./openapi.yaml).
