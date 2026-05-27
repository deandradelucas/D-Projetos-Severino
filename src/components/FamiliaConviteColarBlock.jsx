import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import {
  extrairTokenConviteFamilia,
  persistConviteTokenSession,
  readConviteTokenSession,
  clearConviteTokenSession,
} from '../lib/familiaConviteColar'

function papelConviteLabel(p) {
  const x = String(p || '').toUpperCase()
  if (x === 'ADMIN') return 'Administrador familiar'
  if (x === 'VIEWER') return 'Só leitura'
  return 'Membro'
}

/**
 * Campo para colar link ou código de convite da conta familiar (+ preview via API pública).
 * Em login/cadastro: persiste em session para aplicar ao entrar.
 * Com `usuarioIdParaAceitar`: permite aceitar já autenticado (ex.: Configurações).
 */
function readInitialConviteRaw() {
  if (typeof window === 'undefined') return ''
  try {
    const q = new URLSearchParams(window.location.search).get('convite')?.trim()
    if (q) return q
  } catch {
    /* ignore */
  }
  return readConviteTokenSession()
}

export default function FamiliaConviteColarBlock({
  idPrefix = 'familia-convite',
  usuarioIdParaAceitar = null,
  onAceitarSucesso,
  onAceitarErro,
  ocultarTituloBloco = false,
  /** `shell`: mesmo vocabulário visual dos Ajustes (borda/campo da página de config). */
  visualVariant = 'card',
}) {
  const [searchParams] = useSearchParams()
  const [raw, setRaw] = useState(readInitialConviteRaw)
  const [preview, setPreview] = useState(null)
  const [aceitarBusy, setAceitarBusy] = useState(false)

  /* Sincroniza ?convite= da SPA com o campo (ex.: link “Entrar” no cadastro). */
  useEffect(() => {
    const q = searchParams.get('convite')?.trim()
    if (!q) return
    persistConviteTokenSession(extrairTokenConviteFamilia(q))
    const id = window.requestAnimationFrame(() => {
      setRaw((prev) => (prev.trim() ? prev : q))
    })
    return () => window.cancelAnimationFrame(id)
  }, [searchParams])

  useEffect(() => {
    const token = extrairTokenConviteFamilia(raw)
    if (!token || token.length < 20) {
      const id = window.requestAnimationFrame(() => setPreview(null))
      return () => window.cancelAnimationFrame(id)
    }

    const loadId = window.requestAnimationFrame(() => setPreview({ loading: true }))
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch(apiUrl(`/api/familia/convite-info?token=${encodeURIComponent(token)}`))
          const data = await res.json().catch(() => ({}))
          if (cancelled) return
          if (!data.valido) {
            setPreview({ erro: data.motivo || 'Convite não válido.' })
            return
          }
          persistConviteTokenSession(token)
          setPreview({ ok: data })
        } catch {
          if (!cancelled) setPreview({ erro: 'Não foi possível validar o convite.' })
        }
      })()
    }, 480)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(loadId)
      window.clearTimeout(timer)
    }
  }, [raw])

  const handleAceitarAgora = async () => {
    const uid = String(usuarioIdParaAceitar || '').trim()
    const token = extrairTokenConviteFamilia(raw)
    if (!uid || !token) return
    setAceitarBusy(true)
    try {
      const res = await apiFetch(apiUrl('/api/familia/aceitar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onAceitarErro?.(data.message || 'Não foi possível aceitar o convite.')
        return
      }
      clearConviteTokenSession()
      setRaw('')
      setPreview(null)
      onAceitarSucesso?.(data)
    } catch {
      onAceitarErro?.('Erro de rede ao aceitar o convite.')
    } finally {
      setAceitarBusy(false)
    }
  }

  const areaId = `${idPrefix}-textarea`
  const hintId = `${idPrefix}-hint`
  const modoLogado = Boolean(usuarioIdParaAceitar)
  const shell = visualVariant === 'shell'

  const fieldShell = (
    <>
      <label className="config-familia-convite-shell__field" htmlFor={areaId}>
        <span>Código de convite</span>
        <textarea
          id={areaId}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Cole o código ou o link (https://…?convite=…)"
          rows={3}
          aria-describedby={hintId}
          className="config-familia-convite-shell__textarea"
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <p id={hintId} className="config-familia-convite-shell__hint">
        {modoLogado ? (
          <>
            Quando aparecer <strong>Convite válido</strong>, confirme em <strong>Vincular à esta conta</strong>.
          </>
        ) : (
          <>
            Cole o <strong>código</strong> ou o <strong>link</strong>. Depois faça login ou cadastro; o vínculo é aplicado ao entrar.
          </>
        )}
      </p>
    </>
  )

  const fieldCard = (
    <label className="block" htmlFor={areaId}>
      {ocultarTituloBloco ? (
        <span className="sr-only">Convite conta familiar</span>
      ) : (
        <span className="mb-1.5 block text-[11px] font-semibold text-neutral-700 sm:text-[12px]">
          Conta familiar — convite (opcional)
        </span>
      )}
      <span id={hintId} className="mb-2 block text-[10px] leading-snug text-neutral-600 sm:text-[11px]">
        {modoLogado ? (
          <>
            Cole o <strong>link</strong> ou só o <strong>código</strong> que o titular enviou. Quando aparecer “Convite válido”, confirme em{' '}
            <strong>Vincular à esta conta</strong>.
          </>
        ) : (
          <>
            Cole o <strong>link</strong> ou só o <strong>código</strong> que o titular enviou. Depois faça login ou crie a conta; o vínculo é feito ao entrar.
          </>
        )}
      </span>
      <textarea
        id={areaId}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="https://…/login?convite=… ou cole o código aqui"
        rows={2}
        aria-describedby={hintId}
        className="w-full resize-y rounded-[12px] border border-neutral-200/95 bg-white px-3 py-2.5 text-[12px] text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] min-h-[52px]"
        spellCheck={false}
        autoComplete="off"
      />
    </label>
  )

  return (
    <div className={shell ? 'config-familia-convite-shell' : 'rounded-[14px] border border-[var(--accent-border)] bg-[rgba(212,168,75,0.06)] p-3 sm:p-3.5'}>
      {shell ? fieldShell : fieldCard}

      {preview?.loading ? (
        <p className={shell ? 'config-familia-convite-shell__status' : 'mt-2 text-[10px] text-neutral-500 sm:text-[11px]'}>
          A validar convite…
        </p>
      ) : null}
      {preview?.ok ? (
        <div
          className={
            shell
              ? 'config-familia-convite-shell__preview-ok'
              : 'mt-2 rounded-[10px] border border-[var(--accent-border)] bg-white/80 px-2.5 py-2 text-[10px] leading-snug text-neutral-900 sm:text-[11px]'
          }
        >
          <strong className="font-semibold">Convite válido.</strong>{' '}
          {preview.ok.titular_preview?.nome ? (
            <>
              Convite de <strong>{preview.ok.titular_preview.nome}</strong>
              {preview.ok.titular_preview.email_mascarado
                ? ` (${preview.ok.titular_preview.email_mascarado})`
                : ''}
              .{' '}
            </>
          ) : null}
          Papel: <strong>{papelConviteLabel(preview.ok.papel_convite)}</strong>
          {preview.ok.expires_at ? (
            <>
              {' '}
              · válido até{' '}
              <strong>
                {new Date(preview.ok.expires_at).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </strong>
            </>
          ) : null}
        </div>
      ) : null}
      {preview?.erro ? (
        <p className={shell ? 'config-familia-convite-shell__preview-erro' : 'mt-2 text-[10px] text-red-700 sm:text-[11px]'}>{preview.erro}</p>
      ) : null}

      {modoLogado && preview?.ok ? (
        <div className={shell ? 'config-familia-convite-shell__actions' : 'mt-3'}>
          <button
            type="button"
            disabled={aceitarBusy}
            onClick={() => void handleAceitarAgora()}
            className={
              shell
                ? 'config-action-btn config-action-btn--primary config-familia-convite-shell__btn-full'
                : 'w-full rounded-[12px] bg-[var(--accent)] px-3 py-2.5 text-[12px] font-semibold text-[var(--accent-foreground)] shadow-[var(--shadow-accent)] transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] focus-visible:ring-offset-2'
            }
          >
            {aceitarBusy ? 'A vincular…' : 'Vincular à esta conta'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
