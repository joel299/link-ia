### 2. Canais conectados

# Problema atual , mesmo os canais estando conectado mostra para conectar, é necessario mostrar o estado real do processo e ecesso de tooltip's em todo projeto

# COMO DEVEMFICAR - Para cada canl liberado na conta do usuario deve ter um card minimalista  com o nome do canal seguindo as cores oficiais do canal exemplo instagram , whatsapp, facebook tiktok , cada um deve tero icone oficial e o botao de ação  seguindo a paleta de cores  e tendo um hover ao passar o mouse

CODIGO

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

export function DrawerWithSides() {
  return (
    <Drawer swipeDirection="left">
      <DrawerTrigger render={<Button variant="secondary">Open Left Drawer</Button>} />
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Move Goal</DrawerTitle>
          <DrawerDescription>Set your daily activity goal.</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 p-4">
          <div className="size-full rounded-2xl bg-muted" />
        </div>
        <DrawerFooter>
          <DrawerClose render={<Button>Close</Button>} />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
