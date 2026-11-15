export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (!process.env.ZERNIO_WEBHOOK_SECRET?.trim()) {
    console.warn(
      "[LinkIA] Aviso: ZERNIO_WEBHOOK_SECRET não está configurado. A validação de assinatura do webhook da Zernio (/api/webhooks/zernio/whatsapp) rejeitará eventos (HTTP 503) até que o segredo seja definido."
    );
  }
}

