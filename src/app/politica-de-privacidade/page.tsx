import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { PRIVACY_POLICY_DOCUMENT } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Política de Privacidade da plataforma LinkIA sobre tratamento de dados pessoais.",
};

export default function PoliticaDePrivacidadePage() {
  return <LegalDocumentView document={PRIVACY_POLICY_DOCUMENT} />;
}
