# Editor de temas — requisitos futuros
Status: PROPOSED; não implementar nesta fase.

## Capacidades
- Escolher tema predefinido e ver amostra em tempo real.
- Campo HEX/RGB/OKLCH com parsing, normalização e mensagem de erro útil.
- Editar tokens de acento/superfície dentro da paleta permitida.
- Restaurar tema original com confirmação e preview.
- Salvar rascunho, duplicar tema e aplicar tema permitido.
- Exibir pares de contraste e bloquear combinação que falhe AA.
- Preview com botão, input, modal, tabela densa e fundo de hotspot.
- Carregar último tema válido; se inválido/ausente, cair no original.

## Fluxo
Seleção em rascunho → validação de formato → simulação de componentes/estados → contraste → salvar → carregar. Erros permanecem perto do campo; não depender apenas da cor. Sem persistência no browser nesta V1.
