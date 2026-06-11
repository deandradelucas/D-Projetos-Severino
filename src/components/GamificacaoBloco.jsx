import { useEffect, useRef, useState } from 'react'
import { useModalA11y } from '../hooks/useModalA11y'
import ConquistaIcon from './ConquistaIcon'
import { apiFetch } from '../lib/apiFetch'
import { apiUrl } from '../lib/apiUrl'

// ──────────────────────────────────────────────────────────────────────────
// Modal de celebração — quando conquistas novas vêm com novo:true
// ──────────────────────────────────────────────────────────────────────────
function ModalCelebracao({ conquistas, onClose }) {
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef, autoFocus: true })

  return (
    <div
      className="conquista-celebracao__overlay"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="conquista-celebracao__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebracao-title"
        ref={modalRef}
      >
        <div className="conquista-celebracao__confetti" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className={`conquista-celebracao__dot conquista-celebracao__dot--${i % 6}`} />
          ))}
        </div>

        <h2 id="celebracao-title" className="conquista-celebracao__title">
          Conquista desbloqueada!
        </h2>

        <ul className="conquista-celebracao__list">
          {conquistas.map((c) => (
            <li key={c.key} className="conquista-celebracao__item">
              <span className="conquista-celebracao__item-icon">
                <ConquistaIcon name={c.icone} size={28} />
              </span>
              <div className="conquista-celebracao__item-text">
                <strong className="conquista-celebracao__item-nome">{c.nome}</strong>
                <span className="conquista-celebracao__item-desc">{c.descricao}</span>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="conquista-celebracao__btn"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Selo individual
// ──────────────────────────────────────────────────────────────────────────
function Selo({ conquista }) {
  return (
    <div
      className={`conquista-selo${conquista.desbloqueada ? ' conquista-selo--on' : ' conquista-selo--off'}`}
      title={conquista.descricao}
    >
      <span className="conquista-selo__icon">
        <ConquistaIcon name={conquista.icone} size={22} />
      </span>
      <span className="conquista-selo__nome">{conquista.nome}</span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Indicador de streak
// ──────────────────────────────────────────────────────────────────────────
function StreakIndicador({ atual }) {
  if (atual > 0) {
    return (
      <div className="conquista-streak conquista-streak--ativo" aria-label={`${atual} dias seguidos`}>
        <span className="conquista-streak__icon" aria-hidden="true">
          <ConquistaIcon name="flame" size={18} />
        </span>
        <span className="conquista-streak__valor">{atual}</span>
        <span className="conquista-streak__label">dias seguidos</span>
      </div>
    )
  }
  return (
    <div className="conquista-streak conquista-streak--inativo">
      <span className="conquista-streak__icon" aria-hidden="true">
        <ConquistaIcon name="flame" size={18} />
      </span>
      <span className="conquista-streak__label-incentivo">
        Registre hoje para começar uma sequência
      </span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Bloco principal exportado
// ──────────────────────────────────────────────────────────────────────────
/**
 * Bloco de gamificação (conquistas + streak) para a página Metas.
 * @param {{ pessoalParam: string }} props
 *   pessoalParam: '' | '?pessoal=1' — replicar o escopo das metas.
 */
export default function GamificacaoBloco({ pessoalParam = '' }) {
  const [dados, setDados] = useState(null)
  const [novas, setNovas] = useState([])

  useEffect(() => {
    let cancelled = false

    apiFetch(apiUrl(`/api/gamificacao${pessoalParam}`), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setDados(data)
        const novasList = (data.conquistas ?? []).filter((c) => c.novo === true)
        if (novasList.length > 0) setNovas(novasList)
      })
      .catch(() => {
        // gamificação não pode quebrar a página de metas — falha silenciosa
      })

    return () => { cancelled = true }
  }, [pessoalParam])

  if (!dados) return null

  const conquistas = dados.conquistas ?? []
  const streakAtual = dados.streak?.atual ?? 0

  return (
    <>
      <section className="conquista-bloco" aria-label="Conquistas e sequência">
        <div className="conquista-bloco__header">
          <StreakIndicador atual={streakAtual} />
        </div>

        <div className="conquista-grade" role="list" aria-label="Suas conquistas">
          {conquistas.map((c) => (
            <div key={c.key} role="listitem">
              <Selo conquista={c} />
            </div>
          ))}
        </div>
      </section>

      {novas.length > 0 && (
        <ModalCelebracao
          conquistas={novas}
          onClose={() => setNovas([])}
        />
      )}
    </>
  )
}
