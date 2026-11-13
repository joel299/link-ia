# Anatomia do vidro
Status: PROPOSED

## Camadas
1. Outer glass shell: superfície translúcida externa; transmite profundidade, contorno e atmosfera.
2. Border edge: linha de silhueta da shell; separa do cenário.
3. Highlight band: reflexo direcional, preferencialmente alto/esquerda; não invade conteúdo.
4. Inner stroke: acabamento interno que sugere seção/espessura.
5. Inner stabilized plate ou scrim: região de densidade/contraste previsível atrás de todo o conteúdo.
6. Content layer: texto, ícones, inputs e dados.
7. Shadow cue: sombra exterior e/ou inset suave que sinaliza layer, sem substituir border.
8. Micro-noise: textura opcional quase imperceptível, com fallback estático.

## Responsabilidades e ordem
Shell comunica material. Plate comunica estabilidade de leitura. Conteúdo comunica função. Borda e sombra comunicam geometria. Mudanças de estado são overlays estruturais independentes. A placa deve cobrir labels, helper text, números pequenos, linhas de tabela e ícones; não só o heading.

## Contrato técnico futuro
Usar pseudoelemento decorativo isolado, com pointer-events none e aria-hidden; o conteúdo deve ter stacking order acima. Não abrir contexto de foco separado nem criar nesting interativo. O focus ring deve estar acima do material e não clipado por overflow. Camadas e z-index definidos no registry.

Exemplo futuro, não integrado:

    .surface { position: relative; isolation: isolate; }
    .surface::before { content: ""; position: absolute; inset: 0; pointer-events: none; }
    .surface__plate { position: relative; z-index: 0; background: var(--glass-plate); }
    .surface__content { position: relative; z-index: 1; }

## Referência e aceitação
REF-004 demonstra shell/plate/content; REF-005 separa cues de borda; REF-009 e REF-010 mostram a importância da placa e da ordem. Testar o canto recortado para verificar se continua parecendo material, sem comprometer foco.
