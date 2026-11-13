# LinkIA — System Design

**Versão:** 1.0  
**Data:** 12/11/2026  
**Status:** Proposta para validação do MVP  
**Produto:** LinkIA — criação e publicação de páginas de bio personalizadas

## 1. Objetivo

Definir a direção visual e as regras de interface do LinkIA. O documento adapta a estrutura de registry, tokens, materiais, arquitetura visual e critérios de qualidade dos documentos de referência, agora para uma aplicação de link na bio.

O LinkIA permite que profissionais e pequenos negócios configurem uma página pública com identidade própria e links de Instagram, WhatsApp e agendamento. A edição ocorre em um painel com prévia; a página publicada é acessível por uma URL curta, como `linkia.app/joel-quintana`.

## 2. Mandatos do sistema

- Usar preto, verde e dourado como identidade primária do produto.
- Oferecer tema escuro e tema claro com tokens semânticos equivalentes.
- Usar glassmorfismo como linguagem de superfície, controlado por hierarquia e contraste.
- Manter a página pública simples, responsiva, leve e focada em ações.
- Separar visualmente a experiência de administração da página pública do perfil.
- Priorizar legibilidade, acessibilidade, velocidade e edição sem conhecimento técnico.
- Reutilizar tokens e componentes; telas não devem inventar cores ou materiais próprios.
- Valores marcados como **PROPOSTO** são ponto inicial para prototipação e precisam ser calibrados visualmente e por contraste antes de virarem baseline de produção.

## 3. Identidade visual

### 3.1 Personalidade

- **Clara:** profissional, acolhedora, direta e fácil de usar.
- **Visual:** contemporânea, elegante e tecnológica, com transparências sutis e planos bem definidos.
- **Tom de interface:** linguagem simples, orientada a tarefas; evitar jargão técnico.

### 3.2 Papel das cores

- **Preto/carvão:** estrutura, profundidade, texto forte e tema escuro.
- **Verde:** ação principal, confirmação, links ativos e sinal de publicação.
- **Dourado:** acabamento, destaque de marca e detalhes de ênfase. Uso pontual; não deve competir com CTA ou estados de sucesso.
- **Neutros:** superfícies e texto nos dois temas. Eles apoiam a paleta primária sem se tornarem uma identidade concorrente.

## 4. Tokens de design — proposta inicial

Os valores abaixo são uma base de trabalho. Ajustar após protótipo em telas reais e verificação de contraste WCAG 2.2 AA.

```yaml
version: alpha
name: linkia-system-design
product: LinkIA
status: proposed
colors:
  brand:
    black: "#101312"
    green: "#1F8A5B"
    greenBright: "#33B978"
    gold: "#C7A45B"
    goldSoft: "#E2C987"
  light:
    background: "#F4F6F2"
    surface: "#FFFFFF"
    surfaceRaised: "#FFFFFF"
    text: "#18211C"
    textMuted: "#59665E"
    border: "#DCE4DD"
    primary: "#16784E"
    onPrimary: "#FFFFFF"
    accent: "#9A762F"
    onAccent: "#17140E"
  dark:
    background: "#101312"
    surface: "#171C19"
    surfaceRaised: "#1D2420"
    text: "#F0F4F0"
    textMuted: "#B0BBB3"
    border: "#354039"
    primary: "#33B978"
    onPrimary: "#0D1A12"
    accent: "#E2C987"
    onAccent: "#211B0D"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
  heading:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 650
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 450
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  page: "28px"
spacing:
  unit: "0.25rem"
layout:
  editorMaxWidth: "1440px"
  publicProfileMaxWidth: "480px"
  contentGutterMobile: "20px"
  contentGutterDesktop: "32px"
```

### 4.1 Regras de aplicação

- Implementar tokens como variáveis CSS semânticas (`--color-bg`, `--color-surface`, `--color-text`, `--color-primary`, `--color-accent`).
- Componentes consomem tokens semânticos, não hex diretamente.
- As cores de marca não substituem estados semânticos de erro, alerta e sucesso.
- Dourado é destaque secundário. Não usar dourado para texto pequeno sobre transparência sem validação de contraste.
- Verde é CTA primário e confirmação somente quando o significado for inequívoco.

## 5. Temas claro e escuro

### 5.1 Requisitos

- Os dois temas devem cobrir painel, editor, prévia, estados, menus, diálogos e página pública.
- Tema pode ser escolhido no painel e salvo na preferência do usuário. A página pública usa o tema escolhido no perfil, com opção de seguir sistema quando essa configuração for oferecida.
- Persistência de preferência deve sobreviver a recarregamento e navegação.
- Evitar flash de tema incorreto na primeira renderização; aplicar preferência antes de exibir a interface quando a arquitetura permitir.
- O tema claro não é apenas inversão do escuro: suas superfícies e bordas são recalibradas para manter profundidade e leitura.

### 5.2 Semântica dos temas

| Token | Claro | Escuro |
|---|---|---|
| Fundo geral | Verde-neutro muito claro | Carvão quase preto |
| Superfície base | Branco | Carvão elevado |
| Texto principal | Verde-carvão escuro | Branco esverdeado |
| Texto secundário | Cinza esverdeado | Cinza claro esverdeado |
| Ação primária | Verde profundo | Verde vivo controlado |
| Acento de marca | Dourado escurecido | Dourado claro |
| Borda | Cinza esverdeado claro | Cinza carvão claro |

## 6. Glassmorfismo LinkIA

### 6.1 Modelo de material

Composição visual em camadas:

1. **Fundo:** cor/tom de tema, com gradientes ambientais muito discretos quando úteis.
2. **Outer shell:** define volume, contorno e separação do plano.
3. **Borda e reflexo:** linha externa, highlight direcional e traço interno de baixa intensidade.
4. **Placa estabilizada:** superfície interna suficientemente opaca atrás de texto e ícones.
5. **Conteúdo:** controles, texto e ações com contraste independente do blur.
6. **Elevação:** sombra curta e coerente com o tema, sem glow difuso como substituto de hierarquia.

### 6.2 Intensidades

Os níveis são categorias; não significam um valor universal de transparência. Valores finais dependem do protótipo.

| Nível | Uso | Comportamento |
|---|---|---|
| `glass.subtle` | Header, barra contextual, pequenos controles | Transparência discreta e contorno definido |
| `glass.standard` | Seções do editor, preview e navegação lateral | Camadas visíveis, conteúdo sobre plate estabilizada |
| `glass.elevated` | Popover, menu, seletor e diálogo curto | Mais separação e sombra, sem comprometer foco |
| `glass.dense` | Formulários extensos, lista de links e configurações | Mais opaco; leitura e edição são prioritárias |
| `glass.fallback` | Navegadores sem `backdrop-filter` ou modo de redução | Fundo sólido equivalente; geometria e conteúdo preservados |

### 6.3 Restrições

- Blur é efeito de acabamento, nunca a única forma de delimitar uma superfície.
- Texto de formulário, nomes, números e ícones ficam sobre placa estabilizada.
- Evitar glass em todos os elementos ao mesmo tempo. Uma superfície por agrupamento semântico.
- Não usar reflexos, bordas luminosas ou glow em todas as ações.
- Em `prefers-reduced-transparency` quando suportado, oferecer fallback opaco; respeitar também preferência de movimento reduzido.
- Validar cada material nos dois temas, sobre fundos claros/escuros e com conteúdo real.

## 7. Arquitetura visual e hierarquia de telas

```text
LinkIA
├── Painel autenticado
│   ├── Visão geral / perfis
│   ├── Editor de perfil
│   │   ├── Identidade: nome, bio, avatar e slug
│   │   ├── Links: Instagram, WhatsApp e agendamento
│   │   ├── Aparência: tema, cores, fonte e estilo
│   │   └── Prévia ao vivo da página pública
│   └── Configurações: conta e preferência de tema
└── Página pública /{slug}
    ├── Avatar e nome profissional
    ├── Bio curta
    ├── Ações de contato e agendamento
    └── Créditos/identificação LinkIA, se aprovados para o MVP
```

### 7.1 Painel/editor

- Layout de desktop: navegação compacta, área de edição e prévia visível lado a lado quando couber.
- Layout móvel: edição por seções; prévia acessível por alternância clara sem perder dados.
- Um CTA primário por contexto: “Publicar” ou “Salvar alterações”, nunca ambos com igual peso sem necessidade.
- Status do perfil claramente identificável como rascunho ou publicado.
- Formulários organizados por tarefa, não por campos técnicos.
- Seletor de cor pode aceitar seleção visual e valor hexadecimal, mas apresentar estado e contraste de texto.

### 7.2 Página pública

- Composição vertical, centralizada e mobile-first, com largura de leitura controlada.
- Nome e avatar são o foco inicial; bio logo abaixo; ações como botões largos e claramente nomeados.
- Mostrar apenas links configurados e habilitados.
- Sem menus do painel, analytics, scripts de edição ou conteúdo não publicado.
- Não carregar SDK do Instagram, Calendly ou Cal.com no MVP; links externos abrem com comportamento acessível e seguro.
- A página deve permanecer utilizável com JavaScript mínimo ou indisponível, sempre que a arquitetura adotada permitir.

## 8. Componentes e contratos visuais

### 8.1 Componentes base

- `AppShell`: estrutura autenticada, navegação, área de conteúdo e tema.
- `GlassSurface`: material reutilizável com variante de intensidade e fallback.
- `ThemeToggle`: alternância clara/escura com rótulo acessível e estado anunciado.
- `ProfileEditor`: seções de identidade, links e aparência.
- `ProfilePreview`: representação da página publicada, sincronizada com rascunho local.
- `ProfileActionLink`: ação pública para Instagram, WhatsApp e agendamento.
- `PublishStatus`: estado de rascunho/publicado e resultado da ação.
- `ColorField`: seletor acessível com valor e amostra.
- `AvatarUploader`: área para imagem, validações e fallback.

### 8.2 Regras compartilhadas

- Controles têm foco visível, estados disabled/loading/error e rótulos persistentes.
- Botões de ação possuem texto; não depender exclusivamente de ícones.
- Links externos indicam claramente seu destino quando isso ajudar a pessoa a decidir.
- Não transformar todos os grupos em mini-cards; usar separação tipográfica e espaçamento.
- Evitar excesso de pills. Botões públicos podem ter cantos arredondados consistentes, sem formato de cápsula obrigatório.

## 9. Tipografia e conteúdo

- Manrope é a família inicial proposta para títulos e interface: personalidade contemporânea, boa leitura em tamanhos pequenos.
- Se Manrope não estiver disponível ou prejudicar desempenho, usar stack de sistema compatível.
- No MVP, oferecer poucas combinações curadas de fonte; não permitir qualquer família remota escolhida pelo usuário.
- Bio e nome têm limites definidos no PRD; preservar quebra de linha natural.
- Não usar caixa alta contínua em textos longos nem pesos leves para conteúdo pequeno.
- Microcopy descreve o que o usuário deve informar e como o link será usado.

## 10. Movimento, estados e feedback

- Transições curtas para abertura de menus, mudança de tema e confirmação de publicação.
- Alteração de tema não deve deslocar layout nem piscar conteúdo.
- `prefers-reduced-motion: reduce` remove animações não essenciais.
- Estado de salvamento deve diferenciar “Salvando”, “Salvo” e falha com nova tentativa.
- Mudanças de cor na prévia são imediatas; persistência no servidor ocorre ao salvar/publicar.
- Não animar blur de grandes áreas durante scroll.

## 11. Acessibilidade e qualidade visual

Alvo mínimo: WCAG 2.2 AA. Validar antes de produção:

- Contraste de texto e controles nos temas claro e escuro, inclusive sobre glass.
- Navegação por teclado e ordem de foco previsível.
- Alvos de toque adequados em celular, sem depender de hover.
- Zoom/reflow sem cortar editor ou ações.
- Rótulos acessíveis, mensagens de erro associadas aos campos e anúncios de status.
- Fallback visual sem blur com as mesmas informações, ordem e funcionalidades.
- Tema e prévia avaliados em telas estreitas e largas, estados vazios, erro e carregamento.

Não declarar conformidade ou teste visual aprovado sem evidência de execução.

## 12. Arquitetura visual e dependências técnicas

O System Design é independente do framework, mas se conecta ao MVP proposto pelo PRD:

```text
Painel LinkIA → editor + tokens + preview → API de perfis → persistência
Página pública /{slug} → perfil publicado → renderização enxuta → navegador

Integrações externas abertas por link: Instagram | WhatsApp | Cal.com/Calendly
```

- Tema e personalização são dados estruturados do perfil, validados por schema.
- O painel pode usar componentes compartilhados, mas a página pública deve evitar o bundle de administração.
- A prévia usa os mesmos tokens e componentes visuais da página pública.
- CSS deve fornecer fallback quando `backdrop-filter` não existir.
- Não incorporar dados ou credenciais de terceiros na configuração pública.
- Persistência de tema do perfil e preferência da conta são conceitos distintos; o primeiro define apresentação pública e o segundo aparência do painel.

## 13. Desempenho

- Priorizar HTML e CSS leves no perfil público; manter dependências e JavaScript ao mínimo necessário.
- Não baixar mídia externa do Instagram para montar a página.
- Imagens enviadas pelo usuário devem ter limites e variantes otimizadas; carregar avatar com dimensões explícitas.
- Carregar fontes com estratégia de desempenho e fallback; evitar múltiplas famílias e pesos sem uso.
- Aplicar glass com poucas camadas e blur limitado para reduzir custo de composição, especialmente em mobile.
- Medir Core Web Vitals e tamanho do payload no protótipo; registrar baseline antes de ajustes.

## 14. Governance

- Este documento define direção visual do LinkIA e não representa implementação concluída.
- Tokens, componentes e páginas reais devem ser inventariados durante a construção.
- Qualquer alteração de paleta, escala, tema ou intensidade de vidro deve atualizar este documento e o changelog do projeto.
- Requisitos funcionais e arquitetura de dados continuam no PRD/SDD; este arquivo define linguagem visual e comportamento de interface.
- Registrar valores já validados como `APPROVED`; valores sem validação permanecem `PROPOSED`.

## 15. Checklist para implementação

- [ ] Aplicar tokens semânticos em claro e escuro.
- [ ] Criar alternância e persistência do tema do painel.
- [ ] Permitir escolher aparência pública do perfil.
- [ ] Implementar `GlassSurface` com níveis e fallback.
- [ ] Garantir que editor e página pública compartilhem o mesmo sistema visual.
- [ ] Validar contraste, foco, teclado, zoom e estados.
- [ ] Conferir layout em celular e desktop.
- [ ] Medir desempenho da URL pública e revisar blur/fontes/imagens.
- [ ] Registrar screenshots e resultados de QA antes de promover tokens para aprovados.

## 16. Referências de escopo

- `SDD-PRD-link-bio-mvp.md` — visão do MVP, requisitos e arquitetura sugerida.
- `DESIGN_SYSTEM(3).md` — estrutura de registry, tokens, níveis de glass e governança.
- `DESIGN(1).md` — composição de materiais e princípios de superfícies.
- `ARCHITECTURE.md` — separação entre arquitetura de interface e dependências observadas.
