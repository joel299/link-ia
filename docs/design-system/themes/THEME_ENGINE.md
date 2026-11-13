# Theme Engine — arquitetura futura
Status: PROPOSED; dependências decisórias pendentes.

## Responsabilidades
Engine validará tema candidato contra schema; mesclará somente tokens semânticos autorizados; usará original.json como default; aplicará token map como CSS variables em uma camada segura; rejeitará valores inválidos; retornará tema efetivo e versão.

## Fluxo
Carregar sessão → obter tema autorizado → validar schema/versão → validar pares de contraste e faixa permitida → resolver tokens semânticos → aplicar tema → fallback original caso falhe. Nunca aceitar CSS arbitrário, URL, função ou stylesheet vindo do usuário.

## Regras
Originais são imutáveis; customizações versionadas; tema não altera status funcional; cores semânticas devem cobrir modo escuro; emitir resultado de contraste antes de salvar. A engine é futura, nenhum provider React ou CSS variable theme switch está implementado.
