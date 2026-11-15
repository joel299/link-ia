import crypto from "node:crypto";

export type LegalDocumentType =
  | "terms_of_use"
  | "privacy_policy"
  | "optional_product_updates";

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocumentDefinition {
  type: "terms_of_use" | "privacy_policy";
  slug: "/termos-de-uso" | "/politica-de-privacidade";
  title: string;
  version: string;
  versionLabel: string;
  lastUpdated: string;
  intendedEffectiveDate: string;
  officialDomain: string;
  isDraft: boolean;
  pendingFields: string[];
  draftNotice: string;
  sections: LegalSection[];
}

export const LEGAL_OFFICIAL_DOMAIN = "https://linka.infinito.com.br";

export const TERMS_OF_USE_DOCUMENT: LegalDocumentDefinition = {
  type: "terms_of_use",
  slug: "/termos-de-uso",
  title: "Termos de Uso — LinkIA",
  version: "0.1-minuta",
  versionLabel: "0.1 — minuta para revisão",
  lastUpdated: "15 de novembro de 2026",
  intendedEffectiveDate: "Pendente de definição na publicação",
  officialDomain: LEGAL_OFFICIAL_DOMAIN,
  isDraft: true,
  pendingFields: [
    "Razão social da fornecedora responsável pelo LinkIA",
    "CNPJ",
    "Endereço para notificações",
    "E-mail ou canal oficial de suporte e encerramento",
    "Data de vigência pretendida e revisão jurídica final",
  ],
  draftNotice:
    "Minuta em ambiente de desenvolvimento: os campos empresariais entre colchetes no rascunho ainda estão pendentes de preenchimento pelo responsável e de revisão jurídica antes da publicação como versão vigente. Este texto não constitui parecer jurídico nem certificação de conformidade.",
  sections: [
    {
      id: "fornecimento",
      heading: "1. Quem fornece o LinkIA e o que estes termos cobrem",
      paragraphs: [
        "Estes Termos de Uso regulam o acesso à plataforma LinkIA. A plataforma permite que clientes autorizados criem e administrem páginas públicas de perfil, links, serviços e produtos, agendamentos e conexões com serviços externos, conforme os recursos habilitados para cada conta.",
        "O acesso é criado ou autorizado pela administração do LinkIA. Não há cadastro público nem acesso público de demonstração, salvo se a fornecedora habilitar expressamente esse recurso no futuro e publicar as condições correspondentes.",
      ],
    },
    {
      id: "aceite-versoes",
      heading: "2. Aceite e versões",
      paragraphs: [
        "Ao marcar a opção de aceite e continuar, o usuário confirma que leu e aceita estes Termos. O aceite é registrado com a versão apresentada e o hash do conteúdo. A Política de Privacidade explica como dados pessoais são tratados e deve ser lida em conjunto com estes Termos.",
        "Atualizações podem ser necessárias para refletir mudanças no serviço, na legislação ou em requisitos de segurança. Quando uma alteração exigir novo aceite, o LinkIA apresentará a versão atualizada antes de permitir o uso dos recursos afetados. O histórico de versões e de aceites é preservado sem apagar registros anteriores.",
      ],
    },
    {
      id: "conta-acesso",
      heading: "3. Conta e acesso",
      paragraphs: [
        "A conta é pessoal e destinada ao usuário autorizado pela administração do LinkIA. O usuário deve manter seus dados corretos, proteger suas credenciais e informar a fornecedora sobre suspeita de acesso não autorizado.",
        "O usuário não deve compartilhar credenciais, tentar acessar dados de outro cliente, contornar controles de segurança ou usar a plataforma para atividade ilegal. A fornecedora pode suspender ou restringir uma conta quando houver risco de segurança, uso indevido, obrigação legal ou violação destes Termos.",
        "A administração do LinkIA pode habilitar ou desabilitar recursos por conta, de acordo com a contratação e configuração aplicáveis. A disponibilidade de um recurso no painel não significa que a conta externa correspondente já foi conectada ou autorizada.",
      ],
    },
    {
      id: "pagina-publica",
      heading: "4. Página pública e conteúdo do cliente",
      paragraphs: [
        "O cliente é responsável pelo conteúdo que publica ou fornece para sua página, incluindo nome, imagem, descrição, links, serviços, preços, disponibilidade, publicações importadas e informações de contato. O cliente deve possuir os direitos e autorizações necessários para utilizar esse conteúdo e deve mantê-lo correto e atualizado.",
        "O cliente deve informar as pessoas sobre o uso de seus dados quando atuar como responsável por contatos, pedidos, agendamentos ou outras interações coletadas por meio de sua página, evitando incluir dados pessoais sensíveis ou informações de terceiros sem fundamento e autorização adequados.",
        "O LinkIA pode ocultar ou remover conteúdo que viole a lei, direitos de terceiros, regras de uma plataforma conectada ou estes Termos, de forma proporcional à situação.",
      ],
    },
    {
      id: "servicos-externos",
      heading: "5. Links e serviços externos",
      paragraphs: [
        "O LinkIA pode oferecer links ou conexões com serviços externos, como calendário, redes sociais, mensageria e ferramentas de anúncios, conforme as integrações habilitadas no ambiente. O uso desses serviços também está sujeito às condições e políticas dos respectivos fornecedores.",
        "O cliente autoriza a conexão de uma conta externa ao iniciar e concluir o fluxo de autorização correspondente, podendo revogar a autorização pelo LinkIA ou pelo serviço externo quando essa opção estiver disponível.",
        "O LinkIA não controla a disponibilidade, decisões de análise, alterações de API, limites ou políticas de serviços externos.",
      ],
    },
    {
      id: "agendamentos-mensagens",
      heading: "6. Agendamentos, mensagens e transações",
      paragraphs: [
        "Quando habilitados, os recursos de agendamento consultam disponibilidade e solicitam a criação de eventos em serviços externos conectados. O usuário do LinkIA é responsável por configurar corretamente seus horários, fuso, duração, intervalo e regras de atendimento.",
        "Um horário só é apresentado como confirmado depois que a integração responsável confirmar a operação. O LinkIA não garante a entrega de mensagens por WhatsApp, e-mail ou outro serviço externo, nem processa pagamentos de produtos ou serviços publicados pelo cliente.",
      ],
    },
    {
      id: "uso-permitido",
      heading: "7. Uso permitido e restrições",
      paragraphs: ["É proibido usar o LinkIA para:"],
      bullets: [
        "violar leis, direitos de terceiros ou regras de plataformas conectadas;",
        "enviar spam, fraude, malware, conteúdo enganoso ou comunicações sem autorização;",
        "coletar dados de modo ilícito ou criar páginas que imitem terceiros;",
        "tentar acessar contas, dados, tokens ou recursos sem autorização;",
        "interferir na segurança, disponibilidade ou funcionamento da plataforma;",
        "usar automações para contornar limites de serviços externos;",
        "publicar conteúdo que o usuário não tenha direito de usar.",
      ],
    },
    {
      id: "disponibilidade",
      heading: "8. Disponibilidade e alterações",
      paragraphs: [
        "A fornecedora busca manter o LinkIA disponível e seguro, mas não garante funcionamento ininterrupto. Manutenção, falhas de rede, incidentes ou dependências externas podem causar indisponibilidade temporária.",
      ],
    },
    {
      id: "propriedade",
      heading: "9. Propriedade intelectual",
      paragraphs: [
        "A plataforma, seu código, marca, interface e materiais próprios pertencem à fornecedora ou a seus licenciantes. O cliente mantém os direitos sobre o conteúdo que enviar e concede ao LinkIA autorização limitada para armazená-lo, processá-lo e exibi-lo apenas para operar as funcionalidades solicitadas.",
      ],
    },
    {
      id: "privacidade",
      heading: "10. Privacidade e dados pessoais",
      paragraphs: [
        "O tratamento de dados pessoais é descrito na Política de Privacidade (/politica-de-privacidade). Os papéis de controlador e operador podem variar conforme o dado e a atividade. O cliente é responsável por avaliar suas obrigações em relação aos dados de seus próprios clientes e visitantes.",
      ],
    },
    {
      id: "suspensao",
      heading: "11. Suspensão e encerramento",
      paragraphs: [
        "O cliente pode solicitar o encerramento da conta pelo canal oficial de suporte (pendente de definição). A fornecedora pode suspender ou encerrar o acesso diante de violação destes Termos, risco de segurança, solicitação do administrador responsável ou obrigação legal.",
      ],
    },
    {
      id: "responsabilidade",
      heading: "12. Responsabilidade",
      paragraphs: [
        "Cada parte responde por seus atos e obrigações conforme a legislação aplicável. O cliente é responsável por seu conteúdo, suas ofertas, seus horários, suas autorizações e o relacionamento com seus próprios clientes. Nada nestes Termos exclui responsabilidades que não possam ser afastadas por lei.",
      ],
    },
    {
      id: "alteracoes",
      heading: "13. Alterações destes Termos",
      paragraphs: [
        "A versão vigente ficará disponível em /termos-de-uso, com data de atualização. Quando uma atualização exigir novo aceite, o LinkIA solicitará a confirmação antes de liberar o acesso aos recursos afetados.",
      ],
    },
    {
      id: "lei-contato",
      heading: "14. Lei aplicável e contato",
      paragraphs: [
        "Estes Termos são regidos pelas leis da República Federativa do Brasil. Canal oficial de dúvidas e suporte: pendente de preenchimento antes da publicação definitiva.",
      ],
    },
  ],
};

export const PRIVACY_POLICY_DOCUMENT: LegalDocumentDefinition = {
  type: "privacy_policy",
  slug: "/politica-de-privacidade",
  title: "Política de Privacidade — LinkIA",
  version: "0.1-minuta",
  versionLabel: "0.1 — minuta para revisão",
  lastUpdated: "15 de novembro de 2026",
  intendedEffectiveDate: "Pendente de definição na publicação",
  officialDomain: LEGAL_OFFICIAL_DOMAIN,
  isDraft: true,
  pendingFields: [
    "Razão social, CNPJ e endereço da pessoa jurídica responsável",
    "E-mail ou canal oficial de privacidade e atendimento a titulares",
    "Nome ou canal do Encarregado (DPO), se aplicável",
    "Lista confirmada de provedores/subprocessadores, finalidade e eventual transferência internacional",
    "Prazos e critérios aprovados de retenção e eliminação por categoria de dado",
    "Confirmação de cookies analíticos ou de terceiros e revisão jurídica final",
  ],
  draftNotice:
    "Minuta em ambiente de desenvolvimento: os campos empresariais, prazos de retenção e lista de subprocessadores ainda estão pendentes de confirmação operacional e revisão jurídica antes da publicação definitiva. Esta política não certifica conformidade com a LGPD.",
  sections: [
    {
      id: "escopo",
      heading: "1. Objetivo e escopo",
      paragraphs: [
        "Esta Política explica como o LinkIA trata dados pessoais relacionados à administração de contas, páginas públicas, links, catálogo de serviços e produtos, agendamentos e integrações externas disponíveis no produto.",
        "Ela se aplica aos usuários autorizados a acessar o painel LinkIA e, conforme a funcionalidade, a visitantes das páginas públicas. Um cliente LinkIA pode tratar dados de seus próprios clientes e visitantes e deve fornecer informações de privacidade apropriadas para sua atividade.",
      ],
    },
    {
      id: "papeis",
      heading: "2. Quem decide sobre o tratamento (controlador e operador)",
      paragraphs: [
        "A identificação completa da pessoa jurídica responsável (razão social, CNPJ, endereço e canal de privacidade) está pendente de definição antes da publicação definitiva.",
        "O papel do LinkIA depende da finalidade e da operação concreta: para administração de contas, autenticação e segurança da plataforma, a fornecedora do LinkIA atua definindo finalidades e meios; para dados inseridos ou recebidos pelo cliente em sua página pública, o cliente pode atuar como controlador enquanto o LinkIA opera os dados conforme a funcionalidade contratada.",
      ],
    },
    {
      id: "dados-tratados",
      heading: "3. Dados que podem ser tratados",
      paragraphs: ["A depender dos recursos usados, podem ser tratados:"],
      bullets: [
        "Dados de conta: nome, e-mail, identificador interno, perfil de acesso e hash de senha;",
        "Dados do perfil público: nome de exibição, biografia, avatar, cores, links e conteúdo publicado pelo cliente;",
        "Dados de serviços e produtos: título, descrição, preço, disponibilidade e imagens cadastradas;",
        "Dados de agendamento: nome e contato do solicitante, horário, serviço, fuso e estado do agendamento;",
        "Dados de conexão externa: identificadores de conta e registros retornados por serviços autorizados pelo cliente;",
        "Evidências de aceite: usuário, identificador de perfil quando aplicável, tipo de documento, versão, hash do conteúdo apresentado, ação e data/hora UTC (sem coleta padrão de IP ou user-agent sem justificativa e retenção definida).",
      ],
    },
    {
      id: "finalidades-bases",
      heading: "4. Finalidades e bases legais",
      paragraphs: [
        "Os dados podem ser utilizados para administrar contas autorizadas, autenticar usuários, exibir páginas públicas configuradas, processar agendamentos, conectar integrações autorizadas, proteger o serviço, cumprir obrigações legais e atender solicitações de titulares.",
        "As bases legais variam conforme a finalidade (como execução de contrato, cumprimento de obrigação legal, exercício regular de direitos, legítimo interesse avaliado ou consentimento específico quando aplicável). O aceite dos Termos de Uso não representa consentimento genérico para todas as finalidades.",
        "Quando uma finalidade depender de consentimento opcional, a escolha será específica, desmarcada por padrão e revogável sem afetar tratamentos com outra base legal.",
      ],
    },
    {
      id: "visitantes",
      heading: "5. Dados de visitantes e clientes do usuário LinkIA",
      paragraphs: [
        "O cliente que publica uma página LinkIA decide quais informações solicita em sua página e deve evitar dados excessivos. Ao clicar em links externos como WhatsApp ou Instagram, o visitante também fica sujeito às políticas do serviço de destino.",
      ],
    },
    {
      id: "compartilhamento",
      heading: "6. Compartilhamento e integrações externas",
      paragraphs: [
        "Os dados podem ser compartilhados com provedores necessários para hospedagem e operação do LinkIA, com serviços externos explicitamente autorizados pelo cliente (como calendário, mensageria, redes sociais e anúncios, observando que a integração com TikTok é etapa futura não operacional nesta entrega) e com autoridades diante de obrigação legal ou ordem válida.",
        "A lista detalhada de provedores efetivamente utilizados, finalidade e eventual transferência internacional está pendente de confirmação operacional antes da publicação definitiva.",
      ],
    },
    {
      id: "retencao",
      heading: "7. Retenção e eliminação",
      paragraphs: [
        "Os dados são mantidos pelo período necessário às finalidades descritas e obrigações aplicáveis. Os prazos concretos por categoria (contas, páginas públicas, agendamentos, logs, tokens, evidências de aceite e backups) estão pendentes de aprovação operacional.",
      ],
    },
    {
      id: "seguranca",
      heading: "8. Segurança",
      paragraphs: [
        "No estado atual do código, o LinkIA aplica controle de acesso autenticado com cookies HttpOnly assinados (HMAC-SHA256), hash de senhas com scrypt, isolamento por proprietário (owner_id) nas rotas privadas, validação de entrada no servidor e proteção contra exibição de segredos ou tokens em respostas e logs.",
        "Nenhum serviço conectado garante segurança absoluta. Controles adicionais de operação e resposta a incidentes devem ser confirmados na implantação.",
      ],
    },
    {
      id: "direitos",
      heading: "9. Direitos dos titulares",
      paragraphs: [
        "Nos termos da legislação aplicável, o titular pode solicitar confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade quando aplicável, informação sobre compartilhamento e revogação de consentimento. O canal oficial de atendimento a titulares está pendente de definição.",
      ],
    },
    {
      id: "cookies",
      heading: "10. Cookies e armazenamento local",
      paragraphs: [
        "No estado atual da aplicação, o LinkIA utiliza cookie de sessão necessário para autenticação (`linkia_session`) e armazenamento local para preferência de tema claro/escuro (`linkia-theme`). Não há cookies publicitários nem ferramentas de analytics configuradas no código atual; qualquer inclusão futura exigirá atualização desta Política.",
      ],
    },
    {
      id: "menores",
      heading: "11. Crianças e adolescentes",
      paragraphs: [
        "O LinkIA é destinado a usuários profissionais e empresas e não é projetado para coleta deliberada de dados de crianças.",
      ],
    },
    {
      id: "atualizacoes",
      heading: "12. Atualizações desta Política e contato",
      paragraphs: [
        "A versão vigente ficará disponível em /politica-de-privacidade, com sua data de atualização. Dados do responsável, CNPJ, canal de privacidade e encarregado (se aplicável) permanecem pendentes de definição antes da publicação definitiva.",
      ],
    },
  ],
};

export const OPTIONAL_PRODUCT_UPDATES_VERSION = "0.1-minuta";
export const OPTIONAL_PRODUCT_UPDATES_TEXT =
  "Autorizo receber comunicações opcionais sobre atualizações e novidades do LinkIA (opcional).";

export function getLegalDocumentContentHash(type: LegalDocumentType): string {
  const payload =
    type === "terms_of_use"
      ? JSON.stringify({
          type: TERMS_OF_USE_DOCUMENT.type,
          version: TERMS_OF_USE_DOCUMENT.version,
          sections: TERMS_OF_USE_DOCUMENT.sections,
        })
      : type === "privacy_policy"
        ? JSON.stringify({
            type: PRIVACY_POLICY_DOCUMENT.type,
            version: PRIVACY_POLICY_DOCUMENT.version,
            sections: PRIVACY_POLICY_DOCUMENT.sections,
          })
        : JSON.stringify({
            type: "optional_product_updates",
            version: OPTIONAL_PRODUCT_UPDATES_VERSION,
            text: OPTIONAL_PRODUCT_UPDATES_TEXT,
          });

  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}
