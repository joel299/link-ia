# Radius e contornos
Status: EXISTING + PROPOSED

## Escala confirmada
src/styles.css: radius = 0.75rem; radius-sm = calc(base - 4px); radius-md = calc(base - 2px); radius-lg = base; radius-xl = calc(base + 4px); radius-2xl = calc(base + 8px). .panel usa radius-xl. Sidebar usa rounded-lg/rounded-xl.

## Aplicação futura
Controle usa radius da primitive existente; painel semântico usa token panel; modal/drawer respeita anatomia Radix. Radius comunica agrupamento, não é licença para transformar tudo em pill. Borda externa clara e inner stroke são tokens materiais separados, a calibrar.

## Aceite
O contorno deve permanecer legível sobre superfícies claras e escuras sem criar doble borda excessiva. Radius não pode diminuir hit target.
