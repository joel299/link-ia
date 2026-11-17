"use client";

import Link from "next/link";
import { GlassSurface } from "@/components/ui/GlassSurface";

interface CampaignNamesListProps {
  names: string[];
  hasAdsPermission: boolean;
  hasConnectedAdAccount: boolean;
  loading?: boolean;
  error?: string | null;
  periodLabel: string;
}

export function CampaignNamesList({
  names,
  hasAdsPermission,
  hasConnectedAdAccount,
  loading = false,
  error = null,
  periodLabel,
}: CampaignNamesListProps) {
  return (
    <GlassSurface intensity="subtle" className="dash-campaigns-card" aria-busy={loading}>
      <div className="dash-campaigns-header">
        <div>
          <h3 className="dash-chart-title">Campanhas</h3>
          <p className="dash-chart-subtitle">
            Nomes das campanhas identificadas na conta conectada ({periodLabel})
          </p>
        </div>
        {hasAdsPermission ? (
          <Link href="/painel/trafego" className="btn btn-secondary dash-small-btn">
            Abrir tráfego pago
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div
          className="dash-scroll-area"
          role="status"
          aria-label="Carregando campanhas"
        >
          <div className="dash-scroll-inner dash-skeleton-rows" aria-hidden="true">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="dash-skeleton-campaign-row">
                <span
                  className="skeleton-bar"
                  style={{ width: idx % 2 === 0 ? "68%" : "52%", height: 14 }}
                />
              </div>
            ))}
          </div>
          <span className="sr-only">Carregando campanhas...</span>
        </div>
      ) : !hasAdsPermission ? (
        <div className="dash-scroll-empty" role="status">
          <p className="field-hint">
            Os módulos de tráfego pago não estão habilitados para a sua conta.
          </p>
        </div>
      ) : !hasConnectedAdAccount ? (
        <div className="dash-scroll-empty" role="status">
          <p className="field-hint">
            Nenhuma conta de anúncios conectada e selecionada para este período.
          </p>
        </div>
      ) : error ? (
        <div className="dash-scroll-empty" role="status">
          <p className="field-hint">{error}</p>
        </div>
      ) : names.length === 0 ? (
        <div className="dash-scroll-empty" role="status">
          <p className="field-hint">
            Nenhuma campanha encontrada para o período selecionado.
          </p>
        </div>
      ) : (
        <div
          className="dash-scroll-area"
          role="region"
          aria-label="Lista rolável de campanhas"
          tabIndex={0}
        >
          <div className="dash-scroll-inner">
            {names.map((name, index) => (
              <div key={`${name}-${index}`} className="dash-campaign-row">
                <div className="dash-campaign-name">{name}</div>
                {index < names.length - 1 ? (
                  <hr className="dash-campaign-sep" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassSurface>
  );
}
