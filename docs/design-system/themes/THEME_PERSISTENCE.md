# Persistência de temas
Status: PROPOSED; endpoint/banco pendentes.

## Modelo de registro
schemaVersion, id, name, tokens, scope, ownerId/officeId autorizado, revision, createdAt, updatedAt. Nunca armazenar CSS arbitrário nem segredos.

## Autoridade
Escolher se preferência é pessoal ou por escritório após validar papéis e modelo de sessão. Não inferir que admin de aparência tem permissão para mudar dados jurídicos. API deve aplicar autorização no servidor.

## Operações futuras
Listar temas permitidos, ler tema efetivo, criar/atualizar rascunho, aplicar ou restaurar original, apagar tema custom. Persistência durável no backend quando houver contrato e schema aprovados. localStorage apenas como cache sem autoridade, se política permitir.

## Consistência e segurança
Validar schema/version e tamanhos; controlar concorrência por revision; auditar mudança de tema; fazer migração versionada; se leitura falhar usar original; nunca confiar no valor enviado pelo browser. Não foram criados contratos, tabelas ou migrations nesta tarefa.
