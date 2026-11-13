# PRD — Catálogo de serviços e produtos no LinkIA

**Produto:** LinkIA  
**Tipo:** Feature de catálogo público, carrossel responsivo e otimização de performance  
**Status:** Especificação para implementação do MVP  
**Contexto visual:** A página pública atual do perfil mostra foto/nome, botões de agendamento, WhatsApp e Instagram. O catálogo deve entrar abaixo desses links, sem substituir identidade, paleta ou tema escolhidos pelo profissional.

## 1. Resumo

Permitir que cada profissional cadastre serviços e produtos no painel do LinkIA e publique os itens no próprio perfil. Cada item terá imagem, nome, descrição, preço, disponibilidade e tipo de ação. O catálogo será exibido em um carrossel horizontal responsivo, com no máximo três itens visíveis por vez, navegação por setas no desktop e gesto de arrastar/deslizar em dispositivos móveis, sem barra de rolagem visível.

Ao selecionar um item, o visitante seguirá o fluxo correspondente:

- **Serviço com agendamento:** abrir o agendamento interno do LinkIA, com o serviço já selecionado.
- **Serviço/produto sem agendamento:** abrir o WhatsApp do profissional com mensagem pré-preenchida com o nome do item.
- **Indisponível:** informar indisponibilidade e impedir início de uma nova reserva/solicitação para aquele item.

A feature também exige investigar e corrigir a lentidão percebida no painel e na página pública, medindo o comportamento antes e depois das alterações.

## 2. Problema

O perfil público não tem um espaço estruturado para apresentar serviços ou produtos. O profissional precisa gerenciar esse catálogo dentro do painel e quer que as alterações salvas apareçam no link público sem configuração manual adicional. A página também parece pesada/travada; adicionar imagens e carrossel sem otimização pode piorar o problema.

## 3. Objetivos

1. Cadastrar, editar, ativar/desativar e remover serviços/produtos pelo painel.
2. Exibir itens ativos do perfil em um carrossel adaptável a desktop, tablet e celular.
3. Mostrar no máximo três itens simultaneamente; permitir navegar pelos demais sem barra de rolagem visível.
4. Encaminhar cada item ao fluxo correto de agendamento ou WhatsApp.
5. Preservar nome, foto, tema e paleta do perfil.
6. Reduzir ou não agravar o tempo de carregamento, uso de rede e travamentos percebidos.

## 4. Usuários

- **Profissional:** configura catálogo, imagens, valores, disponibilidade e tipo de ação.
- **Visitante/cliente:** consulta itens, escolhe um serviço/produto e agenda ou conversa com o profissional.

## 5. Escopo do MVP

### Incluído

- CRUD de catálogo no painel.
- Upload de imagem com validação e persistência conforme infraestrutura existente.
- Campos de descrição, preço, disponibilidade, status de publicação e tipo de atendimento.
- Carrossel público responsivo com setas, toque/arraste e controles acessíveis.
- Integração dos itens agendáveis com a rota interna existente de agendamento.
- Link wa.me com mensagem codificada para itens de compra/consulta sem agendamento.
- Otimização e medição de performance do painel e perfil público.

### Fora do escopo

- Checkout, pagamento online, carrinho, emissão fiscal e controle financeiro.
- Reserva ou baixa automática de estoque físico, salvo mudança de escopo aprovada.
- Integração com gateways de pagamento ou marketplace.
- Mensagens de WhatsApp enviadas automaticamente sem ação do cliente.

## 6. Modelo de item

Adaptar ao padrão de banco/modelos do projeto. Cada item deve conter:

- identificador;
- profile_id/owner_id;
- título/nome (obrigatório);
- descrição (obrigatória, com limite razoável);
- valor em centavos ou tipo decimal seguro, não float binário;
- moeda (BRL no MVP, se o produto não suportar outras moedas);
- caminho/URL da imagem;
- tipo: `appointment` (agendável) ou `whatsapp` (contato/compra via WhatsApp);
- disponibilidade: disponível/indisponível;
- publicado/ativo;
- posição/ordem no carrossel;
- duração do serviço, quando diferente da duração padrão do perfil;
- timestamps de criação/alteração.

O schema deve ser compatível com migrações e convenções existentes. Não armazenar imagem em base64 no registro de catálogo. Reutilizar storage/upload existente.

## 7. Requisitos funcionais

### RF-01 — Gerenciar catálogo

O painel deve permitir criar, editar, excluir e reordenar itens. Salvar um item deve persistir seus dados e fazer o item aparecer no perfil público, quando ativo/publicado. Mudanças devem refletir no perfil sem precisar editar links manualmente.

Campos mínimos no formulário:

- Nome do serviço/produto.
- Descrição.
- Preço (aceitar formato brasileiro no campo e salvar em representação numérica segura).
- Foto, com prévia, trocar e remover.
- Tipo de fluxo: “Agendamento” ou “Solicitar pelo WhatsApp”.
- Disponibilidade: “Disponível” / “Indisponível”.
- Publicação: ativo/inativo.
- Duração para serviço agendável se o modelo atual permitir duração própria por serviço.

Validar campos, limites de texto, formato, tamanho e tipo real do arquivo enviado. Exibir erros junto ao campo; evitar que upload falho pareça salvo.

### RF-02 — Carrossel público

- Renderizar abaixo das ações principais do perfil, conforme referência anexada.
- Não renderizar contêiner vazio ou espaços reservados quando não houver itens ativos.
- Exibir até três itens por viewport: um item em celular estreito, até dois em tablet e até três em desktop, ajustando largura sem overflow horizontal da página.
- Com mais itens que a capacidade visível, habilitar navegação por setas anterior/próximo no desktop e swipe/drag horizontal no celular.
- Não mostrar barra de rolagem horizontal; o gesto deve operar no trilho do carrossel, não deslocar a página inteira.
- Setas devem refletir início/fim e não avançar além do catálogo. Não mostrar controles inúteis quando não há itens suficientes.
- O foco de teclado e leitores de tela deve ser suportado; usar botões com rótulos acessíveis. Movimento deve respeitar `prefers-reduced-motion`.
- Cada item mostra imagem, título, descrição resumida, preço e estado de disponibilidade.
- Manter dimensões estáveis para imagens para evitar layout shift; usar `object-fit` adequado sem esticar imagem.
- Aplicar cores, tipografia, tema e identidade do perfil com contraste acessível.

### RF-03 — Ação por tipo

**Tipo Agendamento (`appointment`):**

- Clicar no CTA direciona para a página interna LinkIA de agendamento.
- Passar um identificador público seguro do item/serviço, por exemplo query `?service=<public-id>` ou rota existente equivalente.
- A página de agendamento deve mostrar o serviço selecionado, preço e duração configurada.
- O backend deve confirmar que o item pertence ao perfil, está publicado, disponível e permite agendamento.
- A seleção prévia do serviço não pode ser ignorada nem trocada silenciosamente.

**Tipo WhatsApp (`whatsapp`):**

- Clicar no CTA abre o WhatsApp do profissional configurado no perfil.
- Gerar `https://wa.me/{numero}?text={mensagem_codificada}` usando somente dígitos no telefone e URL encoding correto.
- Mensagem inicial deve mencionar o nome do item e solicitar continuidade do atendimento. Incluir preço somente como informação textual configurada, sem simular compra concluída.
- A página deve informar que o cliente enviará a mensagem pelo WhatsApp; não alegar envio automático.

**Indisponível:**

- Exibir etiqueta “Indisponível”/“Esgotado” e desabilitar o CTA.
- Não permitir abrir reserva ou iniciar pedido via WhatsApp para um item marcado indisponível, salvo se o produto existente tiver uma configuração explícita para aceitar lista de espera.

### RF-04 — Coerência do agendamento

Se o visitante chegou ao agendamento por um serviço específico, vincular a reserva a esse item e usar seus dados (nome, duração e preço) na confirmação/evento, conforme o fluxo já implementado. Se o serviço deixou de estar disponível entre a renderização e a confirmação, interromper o fluxo e informar a mudança.

### RF-05 — Isolamento e segurança

- Filtrar catálogo por perfil público requisitado e itens publicados.
- Validar ownership no backend em criação, edição e remoção.
- Não confiar em profile_id/owner_id enviados pelo cliente para autorização.
- Sanitizar texto e validar arquivos para evitar XSS e upload de conteúdo não permitido.
- Não expor informações privadas no endpoint público.

## 8. Performance e qualidade

Antes de otimizar, medir separadamente painel e página pública em desktop e mobile, registrar baseline e identificar gargalos no código, requests e imagens. Corrigir causas comprovadas sem reescrever a aplicação inteira.

Medidas candidatas conforme a arquitetura atual:

- Não carregar catálogo/requests duplicados; evitar re-renderizações ou consultas N+1.
- Carregar imagens em formatos e dimensões adequados, limitar tamanho de upload, usar lazy loading para itens fora do primeiro viewport e reservar dimensões no layout.
- Carregar somente os dados públicos necessários no perfil.
- Evitar dependências pesadas para um carrossel simples.
- Não bloquear a renderização do perfil por falha de catálogo/agenda.
- Garantir estados de loading com skeleton leve ou layout estável, sem spinner bloqueando a página inteira.
- Cachear dados públicos com invalidação coerente quando o profissional salva o perfil ou catálogo.

Metas de experiência para medir em Lighthouse/DevTools, sempre registrando condições e limitações do ambiente local:

- LCP <= 2,5 s;
- INP <= 200 ms;
- CLS <= 0,1.

Essas metas seguem os limites “bons” publicados pelo web.dev para Core Web Vitals; em teste local, registrar a métrica e configuração usada, sem declarar conformidade de campo com base em uma única execução.

## 9. Critérios de aceite

1. Profissional cria item com foto, descrição, preço, tipo e disponibilidade e o item permanece após recarregar o painel.
2. Item publicado aparece no perfil correto; item inativo ou de outro perfil não aparece.
3. Imagem é carregada sem deformação, com alt text adequado e sem deslocar abruptamente o layout.
4. Carrossel mostra no máximo três itens simultâneos e permite acessar todos os demais por setas e gesto móvel.
5. Barra de rolagem horizontal não aparece; a página não ganha overflow horizontal.
6. Item agendável abre agendamento LinkIA com o serviço correto pré-selecionado.
7. Item de WhatsApp abre conversa com número do perfil e mensagem específica do item.
8. Item indisponível é claramente identificado e não permite iniciar fluxo incompatível.
9. Perfil permanece utilizável e rápido mesmo se imagem ou catálogo falharem.
10. Performance foi medida antes e depois em mobile/desktop e os gargalos encontrados foram documentados.
11. Nenhuma reserva, compra ou mensagem é falsamente confirmada.

## 10. Cenários de validação

- Perfil sem itens: seção do catálogo não aparece e não há espaço vazio.
- Um, dois, três e mais de três itens: controles exibidos somente quando necessários.
- Desktop: setas navegam em incrementos corretos.
- Celular: swipe funciona, cartões cabem na tela e ações permanecem tocáveis.
- Item de agendamento disponível: serviço selecionado é passado à reserva.
- Item de WhatsApp disponível: número/texto corretos e codificados.
- Item indisponível ou inativo: aparência e CTA corretos.
- Upload inválido ou muito grande: erro claro e nenhum arquivo inválido persistido.
- Edição, remoção e reordenação refletem no perfil.
- Dois perfis: dados não vazam entre catálogos.
- Lighthouse/DevTools antes e depois com condições registradas.

## 11. Documentação e dependências

- Atualizar `estado-atual`, `bugs-e-dificuldades` e decisões conforme `AGENTS.md`.
- Registrar schema/migração, rotas e limites de upload implementados.
- Dependências: armazenamento de imagens já existente, número WhatsApp configurado por perfil e fluxo de agendamento já funcional.
- Referência de performance: [Web Vitals — web.dev](https://web.dev/articles/vitals).
