# Link Bio — PRD e SDD do MVP

**Versão:** 1.0  
**Data:** 12/11/2026  
**Status:** Proposta para protótipo demonstrável

## 1. Resumo do produto

Aplicação web que permite a um profissional ou pequeno negócio criar uma página pública de bio com identidade visual própria e links para Instagram, WhatsApp e agendamento. O dono configura tudo por um painel simples; o sistema publica uma URL curta e legível, por exemplo `seudominio.com/joel-quintana`.

O MVP deve validar três coisas: rapidez para montar um perfil, facilidade para personalizar a aparência e funcionamento confiável da página pública em celular. A página deve ser leve, sem depender de uma integração com Instagram para funcionar.

## 2. PRD — Requisitos do produto

### 2.1 Público inicial

- Profissionais autônomos e pequenos negócios.
- Barbeiros, clínicas de estética, clínicas e prestadores de serviço.
- Usuário sem conhecimento técnico, que deseja configurar e compartilhar um único link.

### 2.2 Problema

Links de bio genéricos exigem configuração fragmentada e não representam a identidade do profissional. Agendamento, contato e redes sociais ficam dispersos, e montar uma página própria costuma exigir trabalho técnico.

### 2.3 Proposta de valor

“Crie uma página de bio com a sua marca e seus links em poucos minutos, sem precisar programar.”

### 2.4 Fluxo principal

1. Usuário cria conta ou entra no painel de demonstração.
2. Informa nome público e slug desejado.
3. Adiciona Instagram (nome de usuário ou URL), WhatsApp (número com DDI) e URL de agendamento.
4. Escolhe tema, cores, fonte, imagem de perfil e estilo dos botões.
5. Visualiza uma prévia que acompanha as alterações.
6. Salva e publica; recebe uma URL como `/joel-quintana`.
7. Abre a URL em celular e copia/compartilha o link.

### 2.5 Requisitos funcionais — MVP

**P0 — necessários para a apresentação**

- Painel de edição com nome, descrição curta, imagem/avatar e slug.
- Links configuráveis para Instagram, WhatsApp e agendamento, com ativação/desativação individual.
- Gerar automaticamente o link do Instagram a partir do usuário informado; aceitar também URL completa.
- Gerar `https://wa.me/` a partir de número normalizado (somente dígitos, com código do país) e mensagem inicial opcional codificada na URL.
- Agendamento por URL externa. Permitir Cal.com, Calendly ou outro link HTTPS; abrir em nova aba.
- Personalização visual: paleta de cores (fundo, texto, destaque), seleção de fonte a partir de opções pré-definidas e estilo de página/botões.
- Prévia ao vivo e página pública responsiva.
- Slug único, editável e validado; tratar caracteres acentuados e espaços (normalização para URL), colisões e slug reservado.
- Salvar rascunho e publicar. Mudanças salvas devem aparecer na página pública sem recriar o link.
- Exibir estado vazio e erros de validação claros. Links inválidos não podem ser publicados.
- SEO básico: título, descrição, Open Graph e favicon genérico do produto.

**P1 — desejáveis se houver tempo**

- Upload de imagem de perfil e imagem de capa, com redimensionamento/compressão.
- Botão de copiar URL e compartilhamento nativo quando disponível.
- Um ou dois temas prontos (“claro”, “escuro”, “elegante”) como ponto inicial.
- Botões de links adicionais além dos três principais.

### 2.6 Fora do escopo do MVP

- Agendamento dentro do próprio produto, disponibilidade, pagamentos, lembretes ou gestão de clientes.
- Sincronização bidirecional ou OAuth com Calendly/Cal.com.
- Feed, stories ou scraping de imagens do Instagram.
- Múltiplos usuários por empresa, permissões avançadas, analytics completos, domínio personalizado e cobrança.
- Construtor visual livre com posicionamento arbitrário de componentes.

### 2.7 Instagram e imagens

Para o MVP, o Instagram é um link externo, não uma fonte de conteúdo. Não usar scraping nem depender de endpoints privados para puxar fotos: esses métodos podem quebrar e criar problemas de permissão e estabilidade.

Apresentação inicial: permitir upload de avatar/capa pelo próprio usuário; opcionalmente, exibir um botão que leva ao Instagram. Uma integração oficial para mídia pode ser avaliada depois, condicionada à autenticação, permissões e disponibilidade da API Meta para o tipo de conta. A página continua completa mesmo sem essa integração.

### 2.8 Critérios de aceite

- Um perfil pode ser criado, salvo, publicado, reaberto e editado sem perder os dados.
- Slugs iguais não são aceitos; o usuário recebe uma sugestão ou pode escolher outro.
- Nome, cores, fonte e links aparecem corretamente na prévia e na URL pública.
- Um número válido produz link `wa.me` funcional; número inválido impede publicação e explica o formato esperado.
- Link de agendamento HTTPS abre o destino informado em nova aba.
- A página pública se adapta a celular e desktop, não exige login e não carrega o painel/editor.
- Links desligados ou vazios não são exibidos na página pública.
- Conteúdo do perfil é escapado/validado para evitar injeção de HTML/script.

### 2.9 Métricas de validação

- Tempo para criar e publicar o primeiro perfil: meta de até 3 minutos em teste moderado.
- Taxa de conclusão sem ajuda: pelo menos 4 de 5 usuários de teste.
- Página pública funcional em dispositivos móveis e desktop.
- Nenhum erro crítico no fluxo de publicar e abrir o link.

## 3. SDD — Especificação de design e arquitetura

### 3.1 Princípios

- Página pública prioritariamente estática e rápida; painel separado do caminho público.
- Renderização no servidor ou geração otimizada para que o conteúdo e metadados estejam disponíveis sem depender de JavaScript pesado.
- Modelo de dados pequeno e versionável; não acoplar o MVP a uma plataforma de agendamento.
- Configuração declarativa de tema, com valores validados e tokens CSS.
- Integrações externas tratadas como URLs, evitando chaves de API no navegador.

### 3.2 Arquitetura lógica

```text
Navegador do usuário
  ├── Painel / editor → API de perfis → Banco de dados
  └── Página pública /{slug} → leitura do perfil publicado → HTML otimizado

Serviços externos: Instagram (destino de link), WhatsApp (wa.me), Cal.com/Calendly (URL de agendamento)
```

**Componentes**

1. **Painel:** formulário, seletor de tema, prévia, validação e ações salvar/publicar.
2. **API:** autenticação, CRUD do perfil, checagem de slug, validação e publicação.
3. **Página pública:** busca por slug, renderização apenas dos campos publicados, metadados sociais e links externos.
4. **Persistência:** perfis e estado de publicação. Uploads, se implementados, em armazenamento de objetos com URL pública otimizada.

### 3.3 Stack sugerida para protótipo

A decisão final depende do ambiente já escolhido pelo projeto. Para um MVP rápido, sugerimos:

- **Frontend e rotas públicas:** Next.js com TypeScript, usando renderização no servidor/estática conforme a estratégia de publicação.
- **Dados e autenticação:** Supabase (Postgres + Auth + Storage), se estiver disponível no ambiente do projeto; alternativa equivalente é API própria com PostgreSQL.
- **Estilo:** CSS Modules ou Tailwind com tokens CSS; evitar dependência de biblioteca visual pesada.
- **Imagens:** armazenamento com transformação/compressão; limitar dimensão e peso no upload.
- **Deploy:** plataforma compatível com Next.js ou infraestrutura existente do projeto.

Esta é uma recomendação, não uma dependência do requisito. Se a aplicação já estiver em Go/TypeScript, manter o backend existente e implementar somente os contratos descritos abaixo.

### 3.4 Modelo de dados inicial

**`profiles`**

| Campo | Tipo sugerido | Regra |
|---|---|---|
| `id` | UUID | Chave primária |
| `owner_id` | UUID | Dono do perfil; referência à autenticação |
| `slug` | texto | Único, minúsculo, URL-safe |
| `display_name` | texto | Obrigatório; limite sugerido 80 caracteres |
| `bio` | texto | Opcional; limite sugerido 160 caracteres |
| `avatar_url` | texto/URL | Opcional |
| `instagram_url` | texto/URL | Opcional; HTTPS ou domínio Instagram validado |
| `whatsapp_number` | texto | DDI + dígitos; não armazenar formatação como identidade |
| `whatsapp_message` | texto | Opcional |
| `booking_url` | texto/URL | Opcional; HTTPS obrigatório |
| `theme` | JSONB | Tokens e variantes permitidas por schema |
| `status` | enum | `draft` ou `published` |
| `created_at`, `updated_at` | timestamp | Gerenciados pelo banco |

Os links podem ser extraídos para uma tabela própria quando o produto suportar links arbitrários, analytics ou ordenação. Para o MVP, os três campos explícitos reduzem complexidade.

### 3.5 Contratos de API sugeridos

- `POST /api/profiles` — cria rascunho e reserva slug.
- `GET /api/profiles/:id` — carrega perfil do dono autenticado.
- `PATCH /api/profiles/:id` — atualiza campos do perfil.
- `POST /api/profiles/:id/publish` — valida e publica.
- `GET /api/public/profiles/:slug` — retorna somente campos públicos publicados.
- `GET /api/profiles/slug-availability?slug=...` — verifica disponibilidade.

A API pública não deve retornar `owner_id`, e-mail, estado interno ou campos privados. Escrita e leitura privada exigem autenticação e autorização do proprietário.

### 3.6 Regras de validação e segurança

- Normalizar slug: minúsculas, sem acentos, espaços convertidos em hífen; permitir apenas `[a-z0-9-]`; impor limites de tamanho e lista de reservados (`admin`, `api`, `login`, etc.).
- Garantir unicidade no banco com índice `UNIQUE`; a checagem no painel é apenas conveniência, não substitui a constraint.
- Normalizar WhatsApp para dígitos e validar comprimento plausível; não inferir DDI silenciosamente. Informar que o número deve incluir código do país (ex.: `55`).
- Aceitar apenas URLs HTTPS em links externos. Validar destino, remover espaços e rejeitar esquemas como `javascript:`.
- Não renderizar bio como HTML. Escapar texto e limitar comprimentos.
- Aplicar autorização por proprietário em toda leitura/escrita privada. Se usar Supabase, habilitar RLS nas tabelas e Storage.
- Limitar tamanho, tipo MIME e dimensões das imagens; renomear arquivo no servidor; não confiar no nome enviado pelo cliente.
- Rate limit em autenticação, criação de perfis e endpoint público se houver abuso.

### 3.7 Performance e experiência

- Não carregar SDKs de Instagram, Calendly ou Cal.com na página pública. O MVP só navega para esses serviços.
- HTML inicial com nome, bio e links disponível sem esperar hidratação do editor.
- CSS e JS mínimos no caminho público; carregar fontes com estratégia de otimização e fallback local do sistema.
- Imagens em formato moderno, dimensões responsivas e lazy loading para conteúdo abaixo da dobra.
- Cache por slug com invalidação ao publicar/editar; evitar cache de rascunho.
- Alvo de produto: página utilizável rapidamente em conexão móvel comum; medir Core Web Vitals após protótipo, sem prometer uma pontuação antes da implementação.

### 3.8 Tratamento de falhas

- Slug indisponível: manter os dados do formulário e solicitar outro.
- Serviço de banco indisponível: preservar rascunho local temporário quando seguro e oferecer nova tentativa.
- Link inválido: destacar campo e não publicar.
- Perfil não encontrado/não publicado: mostrar página 404 leve, sem expor detalhes privados.
- Imagem falha: exibir avatar padrão sem quebrar o layout.

## 4. Plano de execução do MVP

1. **Base navegável:** painel, página pública e dados mockados para validar a apresentação.
2. **Persistência:** autenticação simples, CRUD de perfil, slug único e publicação.
3. **Personalização:** tokens de cor, fontes e variantes de layout com prévia ao vivo.
4. **Links:** Instagram, WhatsApp e URL de agendamento com validações.
5. **Acabamento:** upload de avatar, metadados sociais, responsividade e observabilidade básica.

Para a apresentação, a etapa 1 pode demonstrar a experiência enquanto a persistência é conectada. O teste do MVP precisa incluir o ciclo completo de salvar, publicar e abrir a URL em outro dispositivo.

## 5. Decisões em aberto para a fase de implementação

- Domínio e convenção final da URL pública.
- Se o primeiro demo terá login real ou modo de apresentação com perfil de demonstração.
- Stack e hospedagem existentes do projeto.
- Se upload de avatar entra no primeiro corte ou se começa com imagem padrão.
- Provedor de autenticação e limites de uso do plano escolhido.

## 6. Vocabulário

- **Slug:** trecho único da URL pública, como `joel-quintana`.
- **Rascunho:** perfil salvo que ainda não está visível publicamente.
- **Publicado:** perfil acessível sem login pela URL.
- **Prévia:** representação da página atualizada enquanto o usuário edita.
