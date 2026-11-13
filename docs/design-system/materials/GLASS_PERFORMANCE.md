# Performance do material
Status: PROPOSED

Backdrop-filter em grandes superfícies pode gerar custo de composição/repaint. A aplicação não tem benchmark de glass; valores abaixo são limites de engenharia propostos.

## Guardrails
- Limitar blur a overlays e superfícies de área moderada; evitar em scroll container de tela inteira.
- Evitar animar blur/radius de blur; preferir opacity/transform em interação.
- Não empilhar várias camadas filtradas sem necessidade.
- Reservar dimensões de imagem para evitar layout shift; lazy-load imagens fora do primeiro viewport.
- Desligar texture animada; textura estática é opcional.
- Inspecionar mobile, scroll, abertura/fechamento e fallback em hardware comum.
- Se frame drops aparecerem, reduzir área/filtro e usar fallback antes de adicionar lib/shader.

## Critérios de QA propostos
Sem atraso perceptível de interação; sem travamento no scroll; sem layout shift causado por efeito; fallback disponível; screenshot antes/depois e browser/device registrados. Sem métricas observadas, não declarar performance aprovada.
