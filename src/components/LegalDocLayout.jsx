import { Link } from 'react-router-dom'

/**
 * Layout de leitura para documentos legais (Política de Privacidade, Termos).
 * Página pública, fundo claro neutro, container estreito e tipografia legível.
 */
export default function LegalDocLayout({ titulo, versao, atualizadoEm, children }) {
  return (
    <div className="legal-doc-page min-h-svh bg-neutral-50 text-neutral-800">
      <div className="mx-auto w-full max-w-[760px] px-5 py-8 sm:px-8 sm:py-12">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-neutral-800"
        >
          ← Voltar ao Severino
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">{titulo}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {versao ? <>Versão {versao}</> : null}
          {versao && atualizadoEm ? ' · ' : null}
          {atualizadoEm ? <>Atualizado em {atualizadoEm}</> : null}
        </p>
        <div className="legal-doc-body mt-8 space-y-6 text-[0.95rem] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}
