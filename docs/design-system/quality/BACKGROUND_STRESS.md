# Background Stress
Status: test plan; no test pass claimed

## Objetivo
Comprovar que o mesmo componente mantém contraste e hierarquia quando o fundo muda.

## Pré-condições e procedimento
Escolher Panel, Input e um overlay; não alterar seus tokens por tile. Colocar em: (1) fundo uniforme, (2) textura sutil, (3) hotspot luminoso sob texto, (4) forma geométrica contrastante, (5) imagem/padrão complexo, (6) fundo escuro com acentos. Registrar tier e viewport. Usar REF-001 e SUP-007.

## Esperado e aprovação
Shell permanece reconhecível; borda não some; conteúdo mantém tipografia, espaçamento e contraste; nenhum ajuste por background; foco/estado permanece identificável. Falha se texto depende de área calma ou superfície vira névoa.

## Evidência e severidade
Uma captura por tile com mesmo componente e layout. Falha de leitura ou foco = blocker; desaparecimento de edge sem função = major. Fix: reforçar plate/edge antes de aumentar blur/opacity.
