# Primeira chamada

Este guia mostra como enviar uma solicitação à API. O administrador fornece a chave e libera os recursos que você pode usar.

## 1. Prepare a chave

Copie a chave gerada no painel administrativo do LinkIA e guarde-a em um local privado. A chave é mostrada uma única vez. Se não a guardou, revogue-a e gere outra.

## 2. Consulte seus perfis

```bash
curl --request GET \
  --url https://linkia.iainfinito.com.br/v1/api/profiles \
  --header 'Authorization: Bearer SUA_CHAVE_LINKIA' \
  --header 'Accept: application/json'
```

Uma chamada autorizada retorna somente os perfis da conta associada à chave. Se receber `401`, confira se a chave foi copiada inteira, expirou ou foi revogada. Se receber `403`, peça ao administrador que confira os acessos liberados.

## 3. Consulte campanhas

Troque `ID_DO_PERFIL` por um perfil que apareça na sua lista e escolha `meta_ads` ou `tiktok_ads` conforme a integração liberada.

```bash
curl --request GET \
  --url 'https://linkia.iainfinito.com.br/v1/api/profiles/ID_DO_PERFIL/ads/meta_ads?datePreset=last_30d' \
  --header 'Authorization: Bearer SUA_CHAVE_LINKIA' \
  --header 'Accept: application/json'
```

Use `since` e `until` somente quando precisar escolher um intervalo específico. A sincronização com o provedor deve ser solicitada de forma consciente: `sync=1` pode atualizar dados externos.

## 4. Exemplo de alteração segura

Para criar um rascunho de campanha, envie os campos exigidos pela operação de anúncios. A API valida os dados e devolve uma operação pendente. Consulte [endpoints.md](./endpoints.md) e a seção de campanhas na referência interativa para os campos obrigatórios atuais; eles são validados no serviço do provedor.

```bash
curl --request POST \
  --url https://linkia.iainfinito.com.br/v1/api/profiles/ID_DO_PERFIL/ads/meta_ads/campaigns \
  --header 'Authorization: Bearer SUA_CHAVE_LINKIA' \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Campanha de teste",
    "objective": "OUTCOME_TRAFFIC",
    "budgetAmount": 20,
    "budgetCurrency": "BRL",
    "budgetType": "daily",
    "startDate": "2026-12-01",
    "targetSummary": "Pessoas interessadas no serviço na região atendida",
    "creativeHeadline": "Conheça nosso serviço",
    "destinationUrl": "https://example.com/oferta",
    "idempotencyKey": "teste-campanha-001"
  }'
```

O exemplo contém os campos obrigatórios confirmados no código. O provedor ainda pode recusar um objetivo ou configuração que não aceite. Criar o rascunho não ativa o anúncio. A chave também precisa ter o escopo `ads:draft` liberado pelo administrador.

Para ativar, use a operação de confirmação somente quando o usuário tiver pedido essa ação de forma explícita. O corpo exige `confirmed: true`, e a chave precisa ter `ads:confirm`:

```json
{
  "action": "activate",
  "confirmed": true
}
```

## Erros comuns

| Código | O que significa | O que fazer |
| --- | --- | --- |
| `400` | Algum dado está ausente ou fora do formato esperado | Confira os campos da operação na referência |
| `401` | Chave ausente, inválida, expirada ou revogada | Solicite uma nova chave ao administrador |
| `403` | Sua conta não tem acesso a esse recurso ou operação | Peça ao administrador para liberar o recurso |
| `404` | O perfil ou item não foi encontrado na sua conta | Confira o identificador retornado pela listagem |
| `409` | A ação depende de uma etapa anterior ou existe conflito | Siga a instrução retornada pela API |
| `429` | Muitas chamadas em pouco tempo | Aguarde e tente novamente mais tarde |

## Para agentes MCP

Use o servidor em `https://linkia.iainfinito.com.br/mcp` pelo transporte **Streamable HTTP**. Informe a mesma chave no cabeçalho `Authorization: Bearer ...`. O MCP oferece ferramentas com nomes e descrições simples; ele não libera automaticamente ações bloqueadas para sua conta.
