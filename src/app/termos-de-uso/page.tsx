import type { Metadata } from "next";
import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { TERMS_OF_USE_DOCUMENT } from "@/lib/legal-documents";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Termos de Uso da plataforma LinkIA (versão em revisão para acesso autorizado).",
};

export default function TermosDeUsoPage() {
  return <LegalDocumentView document={TERMS_OF_USE_DOCUMENT} />;
}

