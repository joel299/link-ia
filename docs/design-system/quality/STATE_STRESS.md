# State Stress
Status: test plan

## Objetivo
Demonstrar Default, hover, focus-visible, pressed, selected, disabled, loading, error e success quando aplicável.

## Passos
Manter mesmo componente e fundo; executar pointer, teclado e estado via fixture controlada. Testar ação durante loading e interrupção/repetição. Referências: REF-002 e SUP-008.

## PASS
Estados distinguíveis sem legenda e sem depender só de matiz/brilho; foco independente do highlight; disabled não parece acionável; pressed tem resposta visível; error tem estrutura/mensagem; loading não duplica ação. Movimento respeita reduced motion.

## Evidência
Captura de cada estado, método de entrada, mensagem semântica/aria e screenshot fallback. Falha de foco/erro = blocker; estado ambíguo = major.
