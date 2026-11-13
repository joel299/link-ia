# Estados do material
Status: PROPOSED

| Estado | Delta estrutural esperado | Evidência |
|---|---|---|
| Default | shell, plate e hierarquia base | captura com fundo contextual |
| Hover | elevação/edge sutil, não apenas troca de cor | mouse + sem mouse |
| Focus-visible | anel nítido externo à shell, alto contraste, sem clipping | Tab/Shift+Tab e screenshot |
| Pressed | shadow comprime e highlight muda com deslocamento contido | captura durante pointer/tecla |
| Selected | indicador e estrutura persistentes, não só brilho | item ativo legível |
| Disabled | perde brilho e affordance de clique; conteúdo ainda legível | atributo disabled + screenshot |
| Loading | progresso visível e ação não duplica; texto/área estáveis | demora controlada |
| Error | borda, ícone, mensagem associada ao campo e spacing | leitor de tela + captura |
| Success | confirmação sem depender só de verde | texto/ícone e captura |

REF-002 mostra focus, pressed, disabled, error e loading. Outros estados são extensões necessárias ao produto e devem ficar coerentes. Estética não pode esconder estado real. Focus ring deve estar sobre highlight e ter nome para screen reader quando necessário.
