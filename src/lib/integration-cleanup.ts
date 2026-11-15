import type Database from "better-sqlite3";
import { getDb } from "./db";
import { recordIntegrationAudit } from "./integration-audit";

export interface IntegrationCleanupReport {
  expiredOAuthStatesDeleted: number;
  expiredWhatsAppAttemptsMarked: number;
  oldWhatsAppAttemptsDeleted: number;
  staleConnectingWhatsAppUpdated: number;
  stalePendingSocialUpdated: number;
}

/**
 * Rotina idempotente de limpeza e consistência para estados temporários
 * de OAuth e tentativas incompletas de conexão.
 *
 * Regras de segurança:
 * - Nunca remove ou revoga conexões válidas (`status = 'connected'`).
 * - Nunca remove `zernio_profile_id` ou `composio_connected_account_id` de conexões válidas.
 * - Pode ser executada múltiplas vezes sem efeitos colaterais destrutivos.
 */
export function cleanupStaleIntegrationStates(
  database?: Database.Database,
  nowDate: Date = new Date()
): IntegrationCleanupReport {
  const db = database ?? getDb();
  const nowIso = nowDate.toISOString();
  const cutoff24hIso = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const cutoff2hIso = new Date(nowDate.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const cutoff7dIso = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const tx = db.transaction((): IntegrationCleanupReport => {
    // 1. Remover apenas estados OAuth já usados ou expirados há mais de 24h.
    const oauthRes = db
      .prepare(
        `DELETE FROM social_oauth_states
         WHERE (used_at IS NOT NULL AND used_at < ?)
            OR expires_at < ?`
      )
      .run(cutoff24hIso, cutoff24hIso);

    // 2. Marcar tentativas de WhatsApp iniciadas e vencidas como expiradas.
    const waMarkRes = db
      .prepare(
        `UPDATE whatsapp_connection_attempts
         SET status = 'expired'
         WHERE status = 'initiated' AND expires_at < ?`
      )
      .run(nowIso);

    // 3. Remover tentativas antigas (> 7 dias) já finalizadas/expiradas.
    const waDeleteRes = db
      .prepare(
        `DELETE FROM whatsapp_connection_attempts
         WHERE status IN ('expired', 'cancelled', 'failed')
           AND created_at < ?`
      )
      .run(cutoff7dIso);

    // 4. Conexões WhatsApp presas em 'connecting' há > 2h sem tentativa ativa:
    //    marca como 'expired' mantendo zernio_profile_id e histórico intactos.
    const waStaleRes = db
      .prepare(
        `UPDATE whatsapp_connections
         SET status = 'expired',
             last_error = COALESCE(last_error, 'Autorização não concluída no prazo. Tente conectar novamente.'),
             updated_at = ?
         WHERE status = 'connecting'
           AND updated_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM whatsapp_connection_attempts a
             WHERE a.profile_id = whatsapp_connections.profile_id
               AND a.status = 'initiated'
               AND a.expires_at >= ?
           )`
      )
      .run(nowIso, cutoff2hIso, nowIso);

    // 5. Conexões sociais presas em 'pending' há > 2h sem state OAuth ativo.
    const socialStaleRes = db
      .prepare(
        `UPDATE social_connections
         SET status = 'incomplete',
             last_error = COALESCE(last_error, 'Autorização não concluída. Conecte novamente para continuar.'),
             updated_at = ?
         WHERE status = 'pending'
           AND updated_at < ?
           AND NOT EXISTS (
             SELECT 1 FROM social_oauth_states s
             WHERE s.profile_id = social_connections.profile_id
               AND s.provider = social_connections.provider
               AND s.used_at IS NULL
               AND s.expires_at >= ?
           )`
      )
      .run(nowIso, cutoff2hIso, nowIso);

    return {
      expiredOAuthStatesDeleted: oauthRes.changes,
      expiredWhatsAppAttemptsMarked: waMarkRes.changes,
      oldWhatsAppAttemptsDeleted: waDeleteRes.changes,
      staleConnectingWhatsAppUpdated: waStaleRes.changes,
      stalePendingSocialUpdated: socialStaleRes.changes,
    };
  });

  const report = tx();

  const totalChanged =
    report.expiredOAuthStatesDeleted +
    report.expiredWhatsAppAttemptsMarked +
    report.oldWhatsAppAttemptsDeleted +
    report.staleConnectingWhatsAppUpdated +
    report.stalePendingSocialUpdated;

  if (totalChanged > 0) {
    recordIntegrationAudit({
      channel: "system:cleanup",
      action: "cleanup_stale_states",
      outcome: "success",
      details: {
        expiredOAuthStatesDeleted: report.expiredOAuthStatesDeleted,
        expiredWhatsAppAttemptsMarked: report.expiredWhatsAppAttemptsMarked,
        oldWhatsAppAttemptsDeleted: report.oldWhatsAppAttemptsDeleted,
        staleConnectingWhatsAppUpdated: report.staleConnectingWhatsAppUpdated,
        stalePendingSocialUpdated: report.stalePendingSocialUpdated,
      },
    });
  }

  return report;
}

