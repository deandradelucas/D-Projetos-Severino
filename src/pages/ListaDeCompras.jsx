import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { redirectSe401, redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import ConfirmDialog from '../components/ConfirmDialog'
import { useSheetDragClose } from '../hooks/useSheetDragClose'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CATEGORIAS_LOOKUP = {
  'arroz': 'Grãos e Cereais',
  'feijão': 'Grãos e Cereais',
  'feijao': 'Grãos e Cereais',
  'macarrão': 'Grãos e Cereais',
  'macarrao': 'Grãos e Cereais',
  'farinha': 'Grãos e Cereais',
  'aveia': 'Grãos e Cereais',
  'granola': 'Grãos e Cereais',
  'leite': 'Laticínios',
  'queijo': 'Laticínios',
  'iogurte': 'Laticínios',
  'manteiga': 'Laticínios',
  'requeijão': 'Laticínios',
  'requeijao': 'Laticínios',
  'creme de leite': 'Laticínios',
  'nata': 'Laticínios',
  'frango': 'Carnes',
  'carne': 'Carnes',
  'peixe': 'Carnes',
  'linguiça': 'Carnes',
  'linguica': 'Carnes',
  'salsicha': 'Carnes',
  'atum': 'Carnes',
  'sardinha': 'Carnes',
  'presunto': 'Carnes',
  'bacon': 'Carnes',
  'alface': 'Hortifruti',
  'tomate': 'Hortifruti',
  'banana': 'Hortifruti',
  'maçã': 'Hortifruti',
  'maca': 'Hortifruti',
  'laranja': 'Hortifruti',
  'cebola': 'Hortifruti',
  'alho': 'Hortifruti',
  'batata': 'Hortifruti',
  'cenoura': 'Hortifruti',
  'limão': 'Hortifruti',
  'limao': 'Hortifruti',
  'pepino': 'Hortifruti',
  'abobrinha': 'Hortifruti',
  'brócolis': 'Hortifruti',
  'brocolis': 'Hortifruti',
  'espinafre': 'Hortifruti',
  'detergente': 'Limpeza',
  'sabão': 'Limpeza',
  'sabao': 'Limpeza',
  'desinfetante': 'Limpeza',
  'água sanitária': 'Limpeza',
  'agua sanitaria': 'Limpeza',
  'esponja': 'Limpeza',
  'vassoura': 'Limpeza',
  'rodo': 'Limpeza',
  'amaciante': 'Limpeza',
  'shampoo': 'Higiene',
  'sabonete': 'Higiene',
  'papel higiênico': 'Higiene',
  'papel higienico': 'Higiene',
  'fio dental': 'Higiene',
  'escova': 'Higiene',
  'creme dental': 'Higiene',
  'desodorante': 'Higiene',
  'absorvente': 'Higiene',
  'café': 'Bebidas',
  'cafe': 'Bebidas',
  'suco': 'Bebidas',
  'refrigerante': 'Bebidas',
  'água': 'Bebidas',
  'agua': 'Bebidas',
  'cerveja': 'Bebidas',
  'vinho': 'Bebidas',
  'chá': 'Bebidas',
  'cha': 'Bebidas',
  'pão': 'Padaria',
  'pao': 'Padaria',
  'bolo': 'Padaria',
  'biscoito': 'Biscoitos',
  'bolacha': 'Biscoitos',
  'cookie': 'Biscoitos',
  'salgadinho': 'Biscoitos',
  'chips': 'Biscoitos',
  'chocolate': 'Doces',
  'açúcar': 'Doces',
  'acucar': 'Doces',
  'mel': 'Doces',
  'geléia': 'Doces',
  'geleia': 'Doces',
  'sorvete': 'Doces',
  'óleo': 'Temperos',
  'oleo': 'Temperos',
  'azeite': 'Temperos',
  'vinagre': 'Temperos',
  'sal': 'Temperos',
  'pimenta': 'Temperos',
  'colorau': 'Temperos',
  'maionese': 'Temperos',
  'ketchup': 'Temperos',
  'mostarda': 'Temperos',
  'molho': 'Temperos',
}

/** Rótulo exibido na lista — gastos são lançados em Alimentação → Supermercado. */
const LISTA_GASTO_ROTULO = 'Supermercado'

const CATEGORIA_EMOJI = {
  'Grãos e Cereais': '🌾',
  'Laticínios': '🥛',
  'Carnes': '🥩',
  'Hortifruti': '🥦',
  'Limpeza': '🧹',
  'Higiene': '🧴',
  'Bebidas': '🥤',
  'Padaria': '🍞',
  'Biscoitos': '🍪',
  'Doces': '🍬',
  'Temperos': '🧂',
  'Outros': '🛒',
}

function detectarCategoria(nome) {
  const lower = nome.toLowerCase()
  for (const [key, cat] of Object.entries(CATEGORIAS_LOOKUP)) {
    if (lower.includes(key)) return cat
  }
  return 'Outros'
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function dataHojeIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Ícones SVG inline
// ---------------------------------------------------------------------------

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

// Logo oficial do WhatsApp (Simple Icons / brand mark, viewBox 32×32).
function IconWhatsApp() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="currentColor">
      <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.83 2.7.83.916 0 2.495-.74 2.838-1.612.13-.33.244-.74.244-1.118 0-.288-.027-.387-.273-.488-.115-.043-2.36-1.135-2.487-1.207-.058-.043-.115-.043-.187-.043z"/>
      <path d="M16.227 3.005C9.05 3.005 3.252 8.804 3.252 15.98c0 2.21.572 4.39 1.665 6.29l-1.943 5.88a.696.696 0 0 0 .9.9l5.88-1.943a12.93 12.93 0 0 0 6.29 1.665c7.176 0 12.975-5.799 12.975-12.975S23.402 3.005 16.227 3.005zm0 23.83c-2.062 0-4.082-.567-5.835-1.643a.696.696 0 0 0-.582-.072l-3.42 1.13 1.13-3.42a.696.696 0 0 0-.072-.582 10.842 10.842 0 0 1-1.643-5.835c0-6.012 4.892-10.905 10.905-10.905 6.012 0 10.905 4.893 10.905 10.905s-4.893 10.422-10.905 10.422z"/>
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="page-lista-compras__checked-chevron">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function IconMoreVertical() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="19" r="1" fill="currentColor" />
    </svg>
  )
}

function IconSupermercado() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
      <path d="M2 4h2l2.4 12.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 7H6" />
    </svg>
  )
}

function IconChecklist() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 7 2 2 3-3" />
      <path d="m3 16 2 2 3-3" />
      <path d="M12 8h9" />
      <path d="M12 17h9" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Hook: detecta altura do teclado virtual via visualViewport API
// ---------------------------------------------------------------------------

function useKeyboardOffset() {
  const [keyboardH, setKeyboardH] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardH(kh > 80 ? kh : 0)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return keyboardH
}

// ---------------------------------------------------------------------------
// Componente shimmer
// ---------------------------------------------------------------------------

function ShimmerLista() {
  return (
    <div className="page-lista-compras__shimmer" aria-busy="true" aria-label="Carregando itens">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="page-lista-compras__shimmer-item" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal Nova Lista
// ---------------------------------------------------------------------------

function ModalNovaLista({ onClose, onCriada, pessoalParam = '' }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('compras')
  const [orcamentoCentavos, setOrcamentoCentavos] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef(null)
  const sheetRef = useRef(null)
  useSheetDragClose(sheetRef, { open: true, onClose })
  const keyboardH = useKeyboardOffset()
  /** Quando o teclado mobile abre, sobe o sheet via CSS var (--lista-kb lido no partial 32). */
  const overlayStyle = { '--lista-kb': keyboardH > 0 ? `${keyboardH + 8}px` : '0px' }

  // Auto-focus só no desktop — no mobile evita abrir o teclado por cima do seletor de tipo
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches) {
      inputRef.current?.focus()
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) return

    setSalvando(true)
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras${pessoalParam}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          nome: nomeTrimmed,
          tipo,
          orcamento: tipo === 'compras' && orcamentoCentavos > 0 ? orcamentoCentavos / 100 : null,
        }),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao criar lista.', 'error')
        return
      }
      const lista = await res.json()
      showToast('Lista criada!', 'success')
      onCriada(lista)
    } catch {
      showToast('Erro ao criar lista.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="page-lista-compras__modal-overlay" style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={sheetRef} className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-nova-lista-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-nova-lista-titulo" className="page-lista-compras__modal-title">Nova lista</h2>
          <button type="button" className="page-lista-compras__modal-close" onClick={onClose} aria-label="Fechar">
            <IconX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="page-lista-compras__modal-field">
            <span className="page-lista-compras__modal-label">Tipo de lista</span>
            <div className="page-lista-compras__tipo-toggle" role="group" aria-label="Tipo de lista">
              <button
                type="button"
                className={`page-lista-compras__tipo-btn${tipo === 'compras' ? ' page-lista-compras__tipo-btn--active' : ''}`}
                onClick={() => setTipo('compras')}
                aria-pressed={tipo === 'compras'}
              >
                🛒 Compras
              </button>
              <button
                type="button"
                className={`page-lista-compras__tipo-btn${tipo === 'tarefas' ? ' page-lista-compras__tipo-btn--active' : ''}`}
                onClick={() => setTipo('tarefas')}
                aria-pressed={tipo === 'tarefas'}
              >
                ✓ Tarefas
              </button>
            </div>
            <p className="page-lista-compras__tipo-hint">
              {tipo === 'compras'
                ? 'Itens com preço, total e opção de registrar como gasto.'
                : 'Checklist simples para anotar tarefas — sem preço.'}
            </p>
          </div>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="nome-lista">Nome da lista</label>
            <input
              id="nome-lista"
              ref={inputRef}
              className="page-lista-compras__modal-input"
              type="text"
              placeholder={tipo === 'tarefas' ? 'Ex: Tarefas da casa' : 'Ex: Mercado da semana'}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={100}
              required
            />
          </div>
          {tipo === 'compras' && (
            <div className="page-lista-compras__modal-field">
              <label className="page-lista-compras__modal-label" htmlFor="orcamento-lista">
                Orçamento <span className="page-lista-compras__modal-label--optional">(opcional)</span>
              </label>
              <input
                id="orcamento-lista"
                className="page-lista-compras__modal-input"
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00 — teto de gasto"
                value={orcamentoCentavos > 0 ? formatarMoeda(orcamentoCentavos / 100) : ''}
                onChange={(e) => {
                  const onlyDigits = e.target.value.replace(/\D/g, '')
                  setOrcamentoCentavos(onlyDigits === '' ? 0 : parseInt(onlyDigits.slice(0, 11), 10))
                }}
                maxLength={20}
              />
              <span className="page-lista-compras__modal-subhint">
                Avisamos quando o total estimado passar do teto.
              </span>
            </div>
          )}
          <div className="page-lista-compras__modal-actions">
            <button type="button" className="page-lista-compras__modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-lista-compras__modal-confirm" disabled={salvando || !nome.trim()}>
              {salvando ? 'Criando…' : 'Criar lista'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal Registrar Gasto
// ---------------------------------------------------------------------------

/**
 * Procura subcategoria "Mercado" / "Supermercado" dentro da categoria selecionada.
 * Match em ordem: equivalência exata → contém "supermercado" → contém "mercado".
 * Diacríticos ignorados; útil pois a base default usa acentos.
 */
function encontrarSubcategoriaMercado(cat) {
  const subs = Array.isArray(cat?.subcategorias) ? cat.subcategorias : []
  if (!subs.length) return null
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  return (
    subs.find((s) => norm(s.nome) === 'supermercado') ||
    subs.find((s) => norm(s.nome) === 'mercado') ||
    subs.find((s) => norm(s.nome).includes('supermercado')) ||
    subs.find((s) => norm(s.nome).includes('mercado')) ||
    null
  )
}

function ModalRegistrarGasto({ lista, total, onClose, onRegistrado }) {
  const [categorias, setCategorias] = useState([])
  const [categoriaId, setCategoriaId] = useState('')
  const [subcategoriaId, setSubcategoriaId] = useState('')
  const [subcategoriaNome, setSubcategoriaNome] = useState('')
  const [descricao, setDescricao] = useState(`${lista?.nome || 'Lista de compras'} — ${dataHojeIso()}`)
  const [valorCentavos, setValorCentavos] = useState(Math.round((Number(total) || 0) * 100))
  const [salvando, setSalvando] = useState(false)
  const [carregandoCategorias, setCarregandoCategorias] = useState(true)

  const valorReal = valorCentavos / 100
  // Diferença entre o que foi pago e o estimado (#8 planejado vs real)
  const diff = valorReal - (Number(total) || 0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(apiUrl('/api/categorias'))
        if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const lista2 = Array.isArray(data) ? data : []
        setCategorias(lista2)
        // Pré-seleciona pela categoria_financeira da lista (case-insensitive).
        const alvo = String(lista?.categoria_financeira || 'Alimentação').toLowerCase()
        const match =
          lista2.find((c) => String(c.nome || '').toLowerCase() === alvo) ||
          lista2.find((c) => String(c.nome || '').toLowerCase().includes(alvo)) ||
          lista2[0]
        if (match) setCategoriaId(match.id)
      } catch (err) {
        console.error('[ListaDeCompras] fetchCategorias:', err)
      } finally {
        if (!cancelled) setCarregandoCategorias(false)
      }
    })()
    return () => { cancelled = true }
  }, [lista?.categoria_financeira])

  // Auto-match de subcategoria "Mercado/Supermercado" sempre que a categoria muda.
  useEffect(() => {
    if (!categoriaId || categorias.length === 0) {
      setSubcategoriaId('')
      setSubcategoriaNome('')
      return
    }
    const cat = categorias.find((c) => c.id === categoriaId)
    const sub = encontrarSubcategoriaMercado(cat)
    setSubcategoriaId(sub?.id || '')
    setSubcategoriaNome(sub?.nome || '')
  }, [categoriaId, categorias])

  async function handleSubmit(e) {
    e.preventDefault()
    if (valorReal <= 0) {
      showToast('Informe o valor pago.', 'error')
      return
    }
    if (!categoriaId) {
      showToast('Selecione uma categoria.', 'error')
      return
    }

    setSalvando(true)
    try {
      const body = {
        tipo: 'DESPESA',
        valor: valorReal,
        data_transacao: dataHojeIso(),
        descricao: descricao.trim() || lista?.nome || 'Lista de compras',
        categoria_id: categoriaId,
        status: 'EFETIVADA',
      }
      if (subcategoriaId) body.subcategoria_id = subcategoriaId
      const res = await apiFetch(apiUrl('/api/transacoes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(body),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao registrar gasto.', 'error')
        return
      }
      // Planejado vs real: feedback de aprendizado de orçamento (#8)
      const estimado = Number(total) || 0
      if (estimado > 0 && Math.abs(diff) >= 0.01) {
        const pct = Math.round((Math.abs(diff) / estimado) * 100)
        showToast(
          diff > 0
            ? `Gasto registrado! Você pagou ${formatarMoeda(diff)} (${pct}%) a mais que o planejado.`
            : `Gasto registrado! Você economizou ${formatarMoeda(Math.abs(diff))} (${pct}%) vs o planejado.`,
          diff > 0 ? 'info' : 'success'
        )
      } else {
        showToast('Gasto registrado em Transações!', 'success')
      }
      onRegistrado()
    } catch {
      showToast('Erro ao registrar gasto.', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="page-lista-compras__modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-gasto-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-gasto-titulo" className="page-lista-compras__modal-title">Registrar como gasto</h2>
          <button type="button" className="page-lista-compras__modal-close" onClick={onClose} aria-label="Fechar">
            <IconX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="page-lista-compras__modal-field">
            <span className="page-lista-compras__modal-label">Total estimado</span>
            <div className="page-lista-compras__modal-total-display">{formatarMoeda(total)}</div>
          </div>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="gasto-valor">Valor pago</label>
            <input
              id="gasto-valor"
              className="page-lista-compras__modal-input"
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={valorCentavos > 0 ? formatarMoeda(valorCentavos / 100) : ''}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, '')
                setValorCentavos(onlyDigits === '' ? 0 : parseInt(onlyDigits.slice(0, 11), 10))
              }}
              maxLength={20}
            />
            {Number(total) > 0 && Math.abs(diff) >= 0.01 && (
              <span className={`page-lista-compras__modal-subhint${diff > 0 ? ' page-lista-compras__modal-subhint--warn' : ''}`}>
                {diff > 0
                  ? `${formatarMoeda(diff)} acima do estimado`
                  : `${formatarMoeda(Math.abs(diff))} abaixo do estimado`}
              </span>
            )}
          </div>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="gasto-cat">Categoria financeira</label>
            <select
              id="gasto-cat"
              className="page-lista-compras__modal-select"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              disabled={carregandoCategorias}
            >
              {carregandoCategorias && <option value="">Carregando…</option>}
              {!carregandoCategorias && categorias.length === 0 && (
                <option value="">Nenhuma categoria cadastrada</option>
              )}
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {subcategoriaNome ? (
              <span className="page-lista-compras__modal-subhint">
                Subcategoria: <strong>{subcategoriaNome}</strong>
              </span>
            ) : !carregandoCategorias && categoriaId ? (
              <span className="page-lista-compras__modal-subhint page-lista-compras__modal-subhint--warn">
                Sem subcategoria “Mercado” nesta categoria — será salvo só com a categoria.
              </span>
            ) : null}
          </div>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="gasto-desc">Descrição</label>
            <input
              id="gasto-desc"
              className="page-lista-compras__modal-input"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="page-lista-compras__modal-actions">
            <button type="button" className="page-lista-compras__modal-cancel" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="page-lista-compras__modal-confirm"
              disabled={salvando || valorReal <= 0 || carregandoCategorias || !categoriaId}
            >
              {salvando ? 'Registrando…' : 'Criar transação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal Novo Item
// ---------------------------------------------------------------------------

function ModalNovoItem({ historico, historicoPrecos = {}, onClose, onSalvar, adicionando, itemEditando = null, permitePreco = true }) {
  const editando = !!itemEditando
  const [nome, setNome] = useState(itemEditando?.nome ?? '')
  const [quantidade, setQuantidade] = useState(
    itemEditando?.quantidade != null ? Number(itemEditando.quantidade) : 1
  )
  const [unidade, setUnidade] = useState(itemEditando?.unidade ?? 'un')
  const [unidades, setUnidades] = useState(
    itemEditando?.unidades != null ? Math.max(1, Number(itemEditando.unidades)) : 1
  )
  const [precoCentavos, setPrecoCentavos] = useState(
    itemEditando?.preco_estimado != null && Number(itemEditando.preco_estimado) > 0
      ? Math.round(Number(itemEditando.preco_estimado) * 100)
      : 0
  )
  const [precoTocado, setPrecoTocado] = useState(false)
  const [prazo, setPrazo] = useState(() => {
    // ISO → valor de datetime-local (YYYY-MM-DDTHH:mm) no fuso local
    if (!itemEditando?.prazo) return ''
    const d = new Date(itemEditando.prazo)
    if (Number.isNaN(d.getTime())) return ''
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  })
  const [sugestoes, setSugestoes] = useState([])
  const [showAuto, setShowAuto] = useState(false)
  const inputRef = useRef(null)
  const keyboardH = useKeyboardOffset()
  const overlayStyle = { '--lista-kb': keyboardH > 0 ? `${keyboardH + 8}px` : '0px' }

  // Auto-focus só no desktop — no mobile evita abrir o teclado por cima do campo
  // (o foco automático fazia o sheet/nome "sumir" atrás do teclado ao abrir).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches) {
      inputRef.current?.focus()
    }
  }, [])

  function handleNomeChange(value) {
    setNome(value)
    if (value.length >= 2) {
      const f = historico.filter((h) => h.toLowerCase().includes(value.toLowerCase())).slice(0, 6)
      setSugestoes(f)
      setShowAuto(f.length > 0)
    } else {
      setSugestoes([])
      setShowAuto(false)
    }
  }

  const nomeTrim = nome.trim()

  // Preço sugerido pelo histórico (#6) — último preço pago para esse nome.
  const sugestaoPreco = permitePreco ? historicoPrecos[nomeTrim.toLowerCase()] : null
  const centavosSugerido = sugestaoPreco && Number(sugestaoPreco.preco) > 0
    ? Math.round(Number(sugestaoPreco.preco) * 100)
    : 0
  // Enquanto o usuário não digitar/editar o preço, usa o sugerido pelo histórico (sem effect).
  const precoCentavosEff = (precoTocado || editando)
    ? precoCentavos
    : (centavosSugerido > 0 ? centavosSugerido : precoCentavos)

  function handleSubmit(e) {
    e.preventDefault()
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) return
    const precoVal = precoCentavosEff > 0 ? precoCentavosEff / 100 : null
    const qtdParsed = parseFloat(quantidade)
    const quantidadeVal = Number.isFinite(qtdParsed) && qtdParsed > 0 ? qtdParsed : 1
    const unidadesParsed = parseInt(unidades, 10)
    const unidadesVal = Number.isFinite(unidadesParsed) && unidadesParsed >= 1 ? unidadesParsed : 1
    const payload = {
      nome: nomeTrimmed,
      quantidade: quantidadeVal,
      unidade,
      unidades: unidadesVal,
      preco_estimado: precoVal,
      prazo: prazo ? new Date(prazo).toISOString() : null,
    }
    if (editando) {
      onSalvar({ id: itemEditando.id, ...payload })
    } else {
      onSalvar(payload)
    }
  }

  const precoNum = precoCentavosEff > 0 ? precoCentavosEff / 100 : null
  const precoFormatado = precoCentavosEff > 0 ? formatarMoeda(precoCentavosEff / 100) : ''
  const unidadesNum = Math.max(1, Number(unidades) || 1)
  const subtotal = precoNum != null ? precoNum * unidadesNum : null

  return (
    <div className="page-lista-compras__modal-overlay" style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-novo-item-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-novo-item-titulo" className="page-lista-compras__modal-title">
            {editando ? 'Editar item' : 'Novo item'}
          </h2>
          <button type="button" className="page-lista-compras__modal-close" onClick={onClose} aria-label="Fechar">
            <IconX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="item-nome">Item</label>
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                id="item-nome"
                className="page-lista-compras__modal-input"
                type="text"
                value={nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                onFocus={() => sugestoes.length > 0 && setShowAuto(true)}
                onBlur={() => setTimeout(() => setShowAuto(false), 150)}
                placeholder="Ex: Arroz, Detergente…"
                maxLength={200}
                autoComplete="off"
              />
              {showAuto && sugestoes.length > 0 && (
                <div className="page-lista-compras__autocomplete" role="listbox" aria-label="Sugestões">
                  {sugestoes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="option"
                      className="page-lista-compras__autocomplete-item"
                      onMouseDown={() => { setNome(s); setShowAuto(false) }}
                    >
                      <span className="page-lista-compras__autocomplete-icon">
                        {CATEGORIA_EMOJI[detectarCategoria(s)] || '🛒'}
                      </span>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!permitePreco && (
            <div className="page-lista-compras__modal-field">
              <label className="page-lista-compras__modal-label" htmlFor="item-prazo">
                Prazo <span className="page-lista-compras__modal-label--optional">(opcional)</span>
              </label>
              <input
                id="item-prazo"
                className="page-lista-compras__modal-input page-lista-compras__modal-input--datetime"
                type="datetime-local"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
              <span className="page-lista-compras__modal-subhint">
                Com prazo, vira um lembrete na sua Agenda (e aviso no WhatsApp).
              </span>
            </div>
          )}

          {permitePreco && (
          <div className="page-lista-compras__modal-row">
            <div className="page-lista-compras__modal-field">
              <label className="page-lista-compras__modal-label" htmlFor="item-qty">Quantidade</label>
              <input
                id="item-qty"
                className="page-lista-compras__modal-input page-lista-compras__modal-input--qty"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="any"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                onBlur={(e) => { const n = parseFloat(e.target.value); if (!Number.isFinite(n) || n <= 0) setQuantidade(1) }}
              />
            </div>

            <div className="page-lista-compras__modal-field">
              <label className="page-lista-compras__modal-label" htmlFor="item-unidade">Medida</label>
              <select
                id="item-unidade"
                className="page-lista-compras__modal-input page-lista-compras__modal-select page-lista-compras__modal-select--unidade"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                aria-label="Medida"
              >
                {['un', 'kg', 'g', 'L', 'mL', 'cx', 'pct', 'dz'].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          )}

          {permitePreco && (
          <div className="page-lista-compras__modal-row">
            <div className="page-lista-compras__modal-field">
              <label className="page-lista-compras__modal-label" htmlFor="item-unidades">Unidade</label>
              <input
                id="item-unidades"
                className="page-lista-compras__modal-input page-lista-compras__modal-input--qty"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={unidades}
                onChange={(e) => setUnidades(e.target.value)}
                onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isFinite(n) || n < 1) setUnidades(1) }}
              />
            </div>

            {permitePreco && (
              <div className="page-lista-compras__modal-field">
                <label className="page-lista-compras__modal-label" htmlFor="item-preco">
                  Preço <span className="page-lista-compras__modal-label--optional">(opcional)</span>
                </label>
                <input
                  id="item-preco"
                  className="page-lista-compras__modal-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={precoFormatado}
                  onChange={(e) => {
                    setPrecoTocado(true)
                    const onlyDigits = e.target.value.replace(/\D/g, '')
                    if (onlyDigits === '') {
                      setPrecoCentavos(0)
                    } else {
                      const limited = onlyDigits.slice(0, 11)
                      setPrecoCentavos(parseInt(limited, 10))
                    }
                  }}
                  maxLength={20}
                />
                {centavosSugerido > 0 && (
                  centavosSugerido === precoCentavosEff ? (
                    <span className="page-lista-compras__preco-hint">💡 Sugerido pelo seu histórico</span>
                  ) : (
                    <button
                      type="button"
                      className="page-lista-compras__preco-hint page-lista-compras__preco-hint--btn"
                      onClick={() => { setPrecoTocado(true); setPrecoCentavos(centavosSugerido) }}
                    >
                      💡 Último: {formatarMoeda(centavosSugerido / 100)} — aplicar
                    </button>
                  )
                )}
              </div>
            )}
          </div>
          )}

          {nomeTrim ? (
            <div className="page-lista-compras__modal-resumo" aria-live="polite">
              <div className="page-lista-compras__modal-resumo-info">
                <span className="page-lista-compras__modal-resumo-nome">{nomeTrim}</span>
                {permitePreco && (
                  <span className="page-lista-compras__modal-resumo-meta">
                    {quantidade || 1} {unidade}
                    {precoNum != null && (
                      <> · {unidadesNum} × {formatarMoeda(precoNum)}</>
                    )}
                  </span>
                )}
              </div>
              {subtotal != null && (
                <span className="page-lista-compras__modal-resumo-total">{formatarMoeda(subtotal)}</span>
              )}
            </div>
          ) : (
            <p className="page-lista-compras__modal-resumo-placeholder">
              Digite o nome do item para ver o resumo
            </p>
          )}

          <div className="page-lista-compras__modal-actions">
            <button type="button" className="page-lista-compras__modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-lista-compras__modal-confirm" disabled={adicionando || !nome.trim()}>
              {adicionando
                ? (editando ? 'Salvando…' : 'Adicionando…')
                : (editando ? 'Salvar alterações' : 'Adicionar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal: renomear lista
// ---------------------------------------------------------------------------
function ModalRenomearLista({ nomeAtual, onClose, onSalvar, salvando }) {
  const [nome, setNome] = useState(nomeAtual || '')
  const inputRef = useRef(null)
  const keyboardH = useKeyboardOffset()
  const overlayStyle = { '--lista-kb': keyboardH > 0 ? `${keyboardH + 8}px` : '0px' }

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  const podeSalvar = nome.trim().length >= 1 && nome.trim() !== nomeAtual

  function handleSubmit(e) {
    e.preventDefault()
    if (!podeSalvar || salvando) return
    onSalvar(nome.trim())
  }

  return (
    <div className="page-lista-compras__modal-overlay" style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-renomear-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-renomear-titulo" className="page-lista-compras__modal-title">Renomear lista</h2>
          <button type="button" className="page-lista-compras__modal-close" onClick={onClose} aria-label="Fechar"><IconX /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="renomear-lista">Novo nome</label>
            <input
              id="renomear-lista"
              ref={inputRef}
              className="page-lista-compras__modal-input"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={100}
              required
            />
          </div>
          <div className="page-lista-compras__modal-actions">
            <button type="button" className="page-lista-compras__modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-lista-compras__modal-confirm" disabled={!podeSalvar || salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal: orçamento da lista
// ---------------------------------------------------------------------------
function ModalOrcamentoLista({ orcamentoAtual, onClose, onSalvar, salvando }) {
  const [centavos, setCentavos] = useState(orcamentoAtual != null ? Math.round(Number(orcamentoAtual) * 100) : 0)
  const inputRef = useRef(null)
  const keyboardH = useKeyboardOffset()
  const overlayStyle = { '--lista-kb': keyboardH > 0 ? `${keyboardH + 8}px` : '0px' }

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  function salvar(valorReais) {
    if (salvando) return
    onSalvar(valorReais)
  }

  return (
    <div className="page-lista-compras__modal-overlay" style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-orcamento-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-orcamento-titulo" className="page-lista-compras__modal-title">Orçamento da lista</h2>
          <button type="button" className="page-lista-compras__modal-close" onClick={onClose} aria-label="Fechar"><IconX /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); salvar(centavos > 0 ? centavos / 100 : null) }}>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="orcamento-edit">Teto de gasto</label>
            <input
              id="orcamento-edit"
              ref={inputRef}
              className="page-lista-compras__modal-input"
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={centavos > 0 ? formatarMoeda(centavos / 100) : ''}
              onChange={(e) => {
                const onlyDigits = e.target.value.replace(/\D/g, '')
                setCentavos(onlyDigits === '' ? 0 : parseInt(onlyDigits.slice(0, 11), 10))
              }}
              maxLength={20}
            />
            <span className="page-lista-compras__modal-subhint">Avisamos quando o total estimado passar do teto.</span>
          </div>
          <div className="page-lista-compras__modal-actions">
            {orcamentoAtual != null && (
              <button type="button" className="page-lista-compras__modal-cancel" onClick={() => salvar(null)} disabled={salvando}>Remover teto</button>
            )}
            <button type="submit" className="page-lista-compras__modal-confirm" disabled={salvando || centavos <= 0}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal: recorrência da lista
// ---------------------------------------------------------------------------
function ModalRecorrenciaLista({ recorrenciaAtual, onClose, onSalvar, salvando }) {
  const [sel, setSel] = useState(recorrenciaAtual || 'nenhuma')
  const keyboardH = useKeyboardOffset()
  const overlayStyle = { '--lista-kb': keyboardH > 0 ? `${keyboardH + 8}px` : '0px' }
  const OPCOES = [
    { v: 'nenhuma', l: 'Não repetir' },
    { v: 'semanal', l: '🔁 Toda semana' },
    { v: 'mensal', l: '🔁 Todo mês' },
  ]

  return (
    <div className="page-lista-compras__modal-overlay" style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-recorrencia-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-recorrencia-titulo" className="page-lista-compras__modal-title">Repetir lista</h2>
          <button type="button" className="page-lista-compras__modal-close" onClick={onClose} aria-label="Fechar"><IconX /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!salvando) onSalvar(sel) }}>
          <div className="page-lista-compras__modal-field">
            <div className="page-lista-compras__recorrencia-opcoes" role="group" aria-label="Frequência">
              {OPCOES.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  className={`page-lista-compras__recorrencia-opt${sel === o.v ? ' page-lista-compras__recorrencia-opt--active' : ''}`}
                  onClick={() => setSel(o.v)}
                  aria-pressed={sel === o.v}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <span className="page-lista-compras__modal-subhint">
              Quando repetir, criamos uma cópia novinha (itens desmarcados) automaticamente.
            </span>
          </div>
          <div className="page-lista-compras__modal-actions">
            <button type="button" className="page-lista-compras__modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-lista-compras__modal-confirm" disabled={salvando || sel === (recorrenciaAtual || 'nenhuma')}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function ListaDeCompras() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [listas, setListas] = useState([])
  const [listaAtiva, setListaAtiva] = useState(null)
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingItens, setLoadingItens] = useState(false)
  const [historico, setHistorico] = useState([])
  const [historicoPrecos, setHistoricoPrecos] = useState({})
  const [modalNovaLista, setModalNovaLista] = useState(false)
  const [modalNovoItem, setModalNovoItem] = useState(false)
  const [itemEmEdicao, setItemEmEdicao] = useState(null)
  const [modalGasto, setModalGasto] = useState(false)
  const [modalRenomear, setModalRenomear] = useState(false)
  const [modalOrcamento, setModalOrcamento] = useState(false)
  const [modalRecorrencia, setModalRecorrencia] = useState(false)
  const [salvandoMeta, setSalvandoMeta] = useState(false)
  const [modoComprando, setModoComprando] = useState(false)
  const [checkedAberto, setCheckedAberto] = useState(true)
  const [menuListaAberto, setMenuListaAberto] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  // { title, message, confirmLabel, tone, onConfirm } — null = fechado
  const [confirmacao, setConfirmacao] = useState(null)
  // Conta familiar
  const [isMembroConta, setIsMembroConta] = useState(false)
  const [escopoLista, setEscopoLista] = useState('familia') // 'familia' | 'pessoal'
  const [titularPrimeiroNome, setTitularPrimeiroNome] = useState(null)

  const menuListaRef = useRef(null)

  const pessoalParam = isMembroConta && escopoLista === 'pessoal' ? '?pessoal=1' : ''

  // -------------------------------------------------------------------------
  // Carregar listas
  // -------------------------------------------------------------------------

  const carregarListas = useCallback(async (pp = '') => {
    setLoading(true)
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras${pp}`), {
        cache: 'no-store',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) return
      const data = await res.json()
      setListas(data)
      if (data.length > 0) {
        const primeiraId = data[0].id
        setListaAtiva(primeiraId)
        setItens(data[0].itens || [])
      } else {
        setListaAtiva(null)
        setItens([])
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarItens = useCallback(async (listaId, pp = '') => {
    if (!listaId) return
    setLoadingItens(true)
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaId}/itens${pp}`), {
        cache: 'no-store',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) return
      const data = await res.json()
      setItens(data)
    } catch {
      // silencioso
    } finally {
      setLoadingItens(false)
    }
  }, [])

  const carregarHistorico = useCallback(async (pp = '') => {
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/historico-nomes${pp}`), {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      setHistorico(data)
    } catch {
      // silencioso
    }
  }, [])

  const carregarHistoricoPrecos = useCallback(async (pp = '') => {
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/historico-precos${pp}`), {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      setHistoricoPrecos(data && typeof data === 'object' ? data : {})
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res = await apiFetch(apiUrl('/api/familia/meu-escopo'), {
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          setIsMembroConta(!!data.isMembroConta)
          if (data.titularPrimeiroNome) setTitularPrimeiroNome(data.titularPrimeiroNome)
        }
      } catch {
        // silencioso — feature opcional
      }
      carregarListas('')
      carregarHistorico('')
      carregarHistoricoPrecos('')
    }
    init()
  }, [carregarListas, carregarHistorico, carregarHistoricoPrecos])

  // Recarregar ao mudar escopo (pessoal ↔ família)
  useEffect(() => {
    if (!isMembroConta) return
    carregarListas(pessoalParam)
    carregarHistorico(pessoalParam)
    carregarHistoricoPrecos(pessoalParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopoLista])

  // Mantém a array `listas` em sincronia com os itens da lista ativa.
  // Sem isso, o contador (badge) das abas e o cache usado ao trocar de lista
  // ficavam defasados após adicionar/remover/marcar itens (item só aparecia
  // após recarregar a página). Retorna a mesma ref quando nada muda → sem loop.
  useEffect(() => {
    if (!listaAtiva) return
    setListas((prev) => {
      let mudou = false
      const next = prev.map((l) => {
        if (l.id !== listaAtiva || l.itens === itens) return l
        mudou = true
        return { ...l, itens }
      })
      return mudou ? next : prev
    })
  }, [itens, listaAtiva])

  // Fechar menu de lista ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuListaRef.current && !menuListaRef.current.contains(e.target)) {
        setMenuListaAberto(false)
      }
    }
    if (menuListaAberto) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuListaAberto])

  // -------------------------------------------------------------------------
  // Troca de lista ativa
  // -------------------------------------------------------------------------

  function selecionarLista(id) {
    if (id === listaAtiva) return
    setListaAtiva(id)
    const lista = listas.find((l) => l.id === id)
    if (lista?.itens) {
      setItens(lista.itens)
    } else {
      carregarItens(id, pessoalParam)
    }
    setMenuListaAberto(false)
  }

  // -------------------------------------------------------------------------
  // Adicionar item
  // -------------------------------------------------------------------------

  const adicionarItem = useCallback(async ({ nome, quantidade, unidade, unidades, preco_estimado, prazo }) => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed || !listaAtiva) return

    setAdicionando(true)
    const categoria = detectarCategoria(nomeTrimmed)

    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens${pessoalParam}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          nome: nomeTrimmed,
          categoria_item: categoria,
          quantidade,
          unidade,
          unidades: Math.max(1, Number(unidades) || 1),
          preco_estimado: preco_estimado || null,
          prazo: prazo || null,
        }),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao adicionar item.', 'error')
        return
      }
      const item = await res.json().catch(() => null)
      if (item && item.id) {
        // Caminho feliz: anexa o item retornado (sem flash de loading)
        setItens((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]))
        if (item.nome && !historico.includes(item.nome)) {
          setHistorico((prev) => [item.nome, ...prev].slice(0, 50))
        }
      } else {
        // Resposta inesperada: recarrega do servidor pra garantir que o item apareça
        carregarItens(listaAtiva, pessoalParam)
      }
      setModalNovoItem(false)
      setItemEmEdicao(null)
    } catch {
      showToast('Erro ao adicionar item.', 'error')
    } finally {
      setAdicionando(false)
    }
  }, [listaAtiva, historico, pessoalParam, carregarItens])

  // -------------------------------------------------------------------------
  // Iniciar edição (abre o modal pré-preenchido)
  // -------------------------------------------------------------------------

  const iniciarEdicaoItem = useCallback((item) => {
    setItemEmEdicao(item)
    setModalNovoItem(true)
  }, [])

  // -------------------------------------------------------------------------
  // Editar item (PATCH)
  // -------------------------------------------------------------------------

  const editarItem = useCallback(async ({ id, nome, quantidade, unidade, unidades, preco_estimado, prazo }) => {
    if (!listaAtiva || !id) return
    const nomeTrimmed = String(nome || '').trim()
    if (!nomeTrimmed) return

    setAdicionando(true)
    const categoria = detectarCategoria(nomeTrimmed)

    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens/${id}${pessoalParam}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          nome: nomeTrimmed,
          categoria_item: categoria,
          quantidade,
          unidade,
          unidades: Math.max(1, Number(unidades) || 1),
          preco_estimado: preco_estimado || null,
          prazo: prazo || null,
        }),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao salvar alterações.', 'error')
        return
      }
      const atualizado = await res.json()
      setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...atualizado } : i)))
      setItemEmEdicao(null)
      setModalNovoItem(false)
    } catch {
      showToast('Erro ao salvar alterações.', 'error')
    } finally {
      setAdicionando(false)
    }
  }, [listaAtiva, pessoalParam])

  // -------------------------------------------------------------------------
  // Toggle checked (optimistic update)
  // -------------------------------------------------------------------------

  const toggleItem = useCallback(async (item) => {
    // Optimistic update
    const novoChecked = !item.checked
    setItens((prev) => prev.map((i) =>
      i.id === item.id ? { ...i, checked: novoChecked, checked_em: novoChecked ? new Date().toISOString() : null } : i
    ))

    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens/${item.id}/toggle${pessoalParam}`), {
        method: 'POST',
        cache: 'no-store',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        // Reverter em caso de erro
        setItens((prev) => prev.map((i) =>
          i.id === item.id ? { ...i, checked: item.checked, checked_em: item.checked_em } : i
        ))
        showToast('Erro ao atualizar item.', 'error')
      } else {
        // Mescla a resposta (traz checked_por / checked_por_nome — #12)
        const atualizado = await res.json().catch(() => null)
        if (atualizado) setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...atualizado } : i)))
      }
    } catch {
      setItens((prev) => prev.map((i) =>
        i.id === item.id ? { ...i, checked: item.checked, checked_em: item.checked_em } : i
      ))
    }
  }, [listaAtiva, pessoalParam])

  // -------------------------------------------------------------------------
  // Remover item
  // -------------------------------------------------------------------------

  const removerItem = useCallback(async (itemId) => {
    // Optimistic update
    setItens((prev) => prev.filter((i) => i.id !== itemId))

    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens/${itemId}${pessoalParam}`), {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        // Recarregar se falhou
        carregarItens(listaAtiva, pessoalParam)
        showToast('Erro ao remover item.', 'error')
      }
    } catch {
      carregarItens(listaAtiva, pessoalParam)
    }
  }, [listaAtiva, carregarItens, pessoalParam])

  // -------------------------------------------------------------------------
  // Arquivar lista
  // -------------------------------------------------------------------------

  const arquivarLista = useCallback(async () => {
    if (!listaAtiva) return
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}${pessoalParam}`), {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao arquivar.', 'error')
        return
      }
      showToast('Lista arquivada.', 'success')
      setListas((prev) => {
        const novasListas = prev.filter((l) => l.id !== listaAtiva)
        if (novasListas.length > 0) {
          setListaAtiva(novasListas[0].id)
          setItens(novasListas[0].itens || [])
        } else {
          setListaAtiva(null)
          setItens([])
        }
        return novasListas
      })
    } catch {
      showToast('Erro ao arquivar lista.', 'error')
    }
  }, [listaAtiva, pessoalParam])

  // -------------------------------------------------------------------------
  // Excluir lista permanentemente
  // -------------------------------------------------------------------------

  const excluirLista = useCallback(async () => {
    if (!listaAtiva) return
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}/excluir${pessoalParam}`), {
        method: 'DELETE',
        cache: 'no-store',
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao excluir.', 'error')
        return
      }
      showToast('Lista excluída.', 'success')
      setListas((prev) => {
        const novasListas = prev.filter((l) => l.id !== listaAtiva)
        if (novasListas.length > 0) {
          setListaAtiva(novasListas[0].id)
          setItens(novasListas[0].itens || [])
        } else {
          setListaAtiva(null)
          setItens([])
        }
        return novasListas
      })
    } catch {
      showToast('Erro ao excluir lista.', 'error')
    }
  }, [listaAtiva, pessoalParam])

  // -------------------------------------------------------------------------
  // Callback: lista criada
  // -------------------------------------------------------------------------

  const handleListaCriada = useCallback((lista) => {
    setListas((prev) => [lista, ...prev])
    setListaAtiva(lista.id)
    setItens(lista.itens || [])
    setModalNovaLista(false)
  }, [])

  // -------------------------------------------------------------------------
  // Agrupamento de itens
  // -------------------------------------------------------------------------

  const listaAtivaDados = useMemo(() => listas.find((l) => l.id === listaAtiva), [listas, listaAtiva])

  // Limpar itens comprados (remove todos os marcados)
  const limparComprados = useCallback(async () => {
    const comprados = itens.filter((i) => i.checked)
    if (comprados.length === 0) return
    for (const it of comprados) {
      await removerItem(it.id)
    }
    showToast('Itens removidos.', 'success')
  }, [itens, removerItem])

  // Triggers de confirmação (substituem os window.confirm)
  const confirmarArquivar = useCallback(() => {
    setMenuListaAberto(false)
    if (!listaAtiva) return
    setConfirmacao({
      title: 'Arquivar lista?',
      message: 'Ela não aparecerá mais na tela. Você ainda pode restaurá-la depois.',
      confirmLabel: 'Arquivar',
      tone: 'danger',
      onConfirm: arquivarLista,
    })
  }, [listaAtiva, arquivarLista])

  const confirmarExcluir = useCallback(() => {
    setMenuListaAberto(false)
    if (!listaAtiva) return
    setConfirmacao({
      title: 'Excluir lista permanentemente?',
      message: 'Todos os itens serão removidos. Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      tone: 'danger',
      onConfirm: excluirLista,
    })
  }, [listaAtiva, excluirLista])

  const confirmarLimpar = useCallback(() => {
    setMenuListaAberto(false)
    const comprados = itens.filter((i) => i.checked)
    if (comprados.length === 0) return
    const ehTarefas = listaAtivaDados?.tipo === 'tarefas'
    const subst = ehTarefas
      ? `${comprados.length} ${comprados.length === 1 ? 'tarefa concluída' : 'tarefas concluídas'}`
      : `${comprados.length} ${comprados.length === 1 ? 'item comprado' : 'itens comprados'}`
    setConfirmacao({
      title: ehTarefas ? 'Limpar concluídas?' : 'Limpar comprados?',
      message: `Remover ${subst} desta lista?`,
      confirmLabel: 'Remover',
      tone: 'danger',
      onConfirm: limparComprados,
    })
  }, [itens, listaAtivaDados, limparComprados])

  // Ajuste rápido de unidades (+/−) sem abrir o modal
  const ajustarUnidades = useCallback(async (item, delta) => {
    if (!listaAtiva) return
    const atual = Math.max(1, Number(item.unidades) || 1)
    const novo = Math.max(1, atual + delta)
    if (novo === atual) return
    setItens((prev) => prev.map((i) => (i.id === item.id ? { ...i, unidades: novo } : i)))
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens/${item.id}${pessoalParam}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ unidades: novo }),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) carregarItens(listaAtiva, pessoalParam)
    } catch {
      carregarItens(listaAtiva, pessoalParam)
    }
  }, [listaAtiva, pessoalParam, carregarItens])

  // Renomear lista
  // Abrem os modais (substituem os window.prompt)
  const renomearLista = useCallback(() => { setMenuListaAberto(false); if (listaAtivaDados) setModalRenomear(true) }, [listaAtivaDados])
  const definirOrcamento = useCallback(() => { setMenuListaAberto(false); if (listaAtivaDados) setModalOrcamento(true) }, [listaAtivaDados])
  const definirRecorrencia = useCallback(() => { setMenuListaAberto(false); if (listaAtivaDados) setModalRecorrencia(true) }, [listaAtivaDados])

  // Renomear lista — salva via API
  const salvarRenome = useCallback(async (nome) => {
    if (!nome || nome === listaAtivaDados?.nome) { setModalRenomear(false); return }
    setSalvandoMeta(true)
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}${pessoalParam}`), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ nome }),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) { showToast('Erro ao renomear.', 'error'); return }
      const atualizada = await res.json().catch(() => ({}))
      setListas((prev) => prev.map((l) => (l.id === listaAtiva ? { ...l, nome: atualizada?.nome || nome } : l)))
      setModalRenomear(false)
      showToast('Lista renomeada!', 'success')
    } catch {
      showToast('Erro ao renomear.', 'error')
    } finally {
      setSalvandoMeta(false)
    }
  }, [listaAtiva, listaAtivaDados, pessoalParam])

  // Orçamento (teto) — salva via API (valor em reais ou null para remover)
  const salvarOrcamento = useCallback(async (valor) => {
    setSalvandoMeta(true)
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}${pessoalParam}`), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ orcamento: valor }),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) { showToast('Erro ao definir orçamento.', 'error'); return }
      const atualizada = await res.json().catch(() => ({}))
      setListas((prev) => prev.map((l) => (l.id === listaAtiva ? { ...l, orcamento: atualizada?.orcamento ?? valor } : l)))
      setModalOrcamento(false)
      showToast(valor == null ? 'Orçamento removido.' : 'Orçamento definido!', 'success')
    } catch {
      showToast('Erro ao definir orçamento.', 'error')
    } finally {
      setSalvandoMeta(false)
    }
  }, [listaAtiva, pessoalParam])

  // Recorrência — salva via API (nenhuma/semanal/mensal)
  const salvarRecorrencia = useCallback(async (r) => {
    if (r === (listaAtivaDados?.recorrencia || 'nenhuma')) { setModalRecorrencia(false); return }
    setSalvandoMeta(true)
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaAtiva}${pessoalParam}`), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ recorrencia: r }),
      })
      if (redirectSe401(res) || redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) { showToast('Erro ao definir recorrência.', 'error'); return }
      const atualizada = await res.json().catch(() => ({}))
      setListas((prev) => prev.map((l) => (l.id === listaAtiva
        ? { ...l, recorrencia: atualizada?.recorrencia ?? r, proxima_geracao: atualizada?.proxima_geracao ?? l.proxima_geracao }
        : l)))
      setModalRecorrencia(false)
      showToast(r === 'nenhuma' ? 'Recorrência removida.' : `Lista repete ${r === 'semanal' ? 'toda semana' : 'todo mês'}.`, 'success')
    } catch {
      showToast('Erro ao definir recorrência.', 'error')
    } finally {
      setSalvandoMeta(false)
    }
  }, [listaAtiva, listaAtivaDados, pessoalParam])

  // Duplicar lista (nome + itens, desmarcados)
  const duplicarLista = useCallback(async () => {
    setMenuListaAberto(false)
    if (!listaAtivaDados) return
    try {
      const resLista = await apiFetch(apiUrl(`/api/lista-compras${pessoalParam}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          nome: `${listaAtivaDados.nome} (cópia)`.slice(0, 100),
          tipo: listaAtivaDados.tipo || 'compras',
          categoria_financeira: listaAtivaDados.categoria_financeira,
        }),
      })
      if (redirectSe401(resLista) || redirectAssinaturaExpiradaSe403(resLista)) return
      if (!resLista.ok) { showToast('Erro ao duplicar.', 'error'); return }
      const nova = await resLista.json()
      for (const it of itens) {
        await apiFetch(apiUrl(`/api/lista-compras/${nova.id}/itens${pessoalParam}`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({
            nome: it.nome,
            quantidade: it.quantidade,
            unidade: it.unidade,
            unidades: it.unidades,
            preco_estimado: it.preco_estimado || null,
          }),
        })
      }
      setListas((prev) => [nova, ...prev])
      setListaAtiva(nova.id)
      carregarItens(nova.id, pessoalParam)
      showToast('Lista duplicada!', 'success')
    } catch {
      showToast('Erro ao duplicar lista.', 'error')
    }
  }, [listaAtivaDados, itens, pessoalParam, carregarItens])

  const itensAgrupados = useMemo(() => {
    const unchecked = itens.filter((i) => !i.checked)
    const checked = itens.filter((i) => i.checked)
    const grupos = {}
    unchecked.forEach((item) => {
      const cat = item.categoria_item || 'Outros'
      if (!grupos[cat]) grupos[cat] = []
      grupos[cat].push(item)
    })
    // Ordenar categorias alfabeticamente, "Outros" ao final
    const ordenadas = Object.keys(grupos).sort((a, b) => {
      if (a === 'Outros') return 1
      if (b === 'Outros') return -1
      return a.localeCompare(b, 'pt-BR')
    })
    return { grupos, ordenadas, checked }
  }, [itens])

  // -------------------------------------------------------------------------
  // Total estimado (apenas itens unchecked com preço)
  // -------------------------------------------------------------------------

  const totalEstimado = useMemo(() =>
    itens.reduce((sum, i) => {
      if (i.checked) return sum
      const preco = i.preco_estimado != null ? Number(i.preco_estimado) : 0
      const unid = Math.max(1, Number(i.unidades) || 1)
      return sum + preco * unid
    }, 0),
    [itens]
  )

  const enviarWhatsApp = useCallback(() => {
    if (!listaAtivaDados) return
    const linhas = []
    const tituloLista = (listaAtivaDados.nome || 'Lista de Compras').trim()
    linhas.push(`🛒 *${tituloLista}*`)
    linhas.push(`_${LISTA_GASTO_ROTULO}_`)
    linhas.push('')

    const cats = itensAgrupados.ordenadas
    cats.forEach((cat, idx) => {
      const emoji = CATEGORIA_EMOJI[cat] || '🛒'
      linhas.push(`${emoji} *${cat}*`)
      itensAgrupados.grupos[cat].forEach((item) => {
        const qtd = Number(item.quantidade)
        const u = item.unidade || 'un'
        const unid = Math.max(1, Number(item.unidades) || 1)
        const partes = [`${qtd} ${u}`]
        if (unid > 1) partes.push(`${unid}un`)
        const preco = item.preco_estimado != null ? Number(item.preco_estimado) : null
        const subtotal = preco != null && preco > 0 ? preco * unid : null
        const sufixo = subtotal != null ? ` — ${formatarMoeda(subtotal)}` : ''
        linhas.push(`• ${item.nome} (${partes.join(' · ')})${sufixo}`)
      })
      if (idx < cats.length - 1) linhas.push('')
    })

    if (totalEstimado > 0) {
      linhas.push('')
      linhas.push(`💰 *Total estimado:* ${formatarMoeda(totalEstimado)}`)
    }

    const url = `https://wa.me/?text=${encodeURIComponent(linhas.join('\n'))}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [listaAtivaDados, itensAgrupados, totalEstimado])

  const temPreco = useMemo(() =>
    itens.some((i) => !i.checked && i.preco_estimado != null && Number(i.preco_estimado) > 0),
    [itens]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const semListas = !loading && listas.length === 0
  const listaVazia = !loadingItens && listaAtiva && itens.length === 0

  // Orçamento (#7) — teto da lista vs total estimado
  const orcamento = listaAtivaDados?.orcamento != null ? Number(listaAtivaDados.orcamento) : null
  const orcamentoPct = orcamento && orcamento > 0
    ? Math.min(100, Math.round((totalEstimado / orcamento) * 100))
    : 0
  const orcamentoExcedido = orcamento != null && totalEstimado > orcamento
  const orcamentoRestante = orcamento != null ? orcamento - totalEstimado : 0

  return (
    <div className="dashboard-container dashboard-page page-lista-compras ref-dashboard app-horizon-shell">
      <div className="app-horizon-inner">
        <Sidebar menuAberto={menuAberto} setMenuAberto={setMenuAberto} />

        <main className="main-content relative z-10 ref-dashboard-main">
          <div className="ref-dashboard-inner dashboard-hub">
            <RefDashboardScroll>
              <div className="page-lista-compras-wrap">

                {/* Header */}
                <div className="page-lista-compras__header">
                  <div className="page-lista-compras__header-left">
                    <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                    <span className="page-lista-compras__header-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                    </span>
                    <h1 className="page-lista-compras__title sr-only">Listas</h1>
                  </div>
                  <button
                    type="button"
                    className="page-lista-compras__nova-btn"
                    onClick={() => setModalNovaLista(true)}
                    aria-label="Nova lista de compras"
                  >
                    <IconPlus />
                    Nova lista
                  </button>
                </div>

                {/* Toggle conta familiar — só para membros */}
                {isMembroConta && (
                  <div className="page-lista-compras__escopo-toggle">
                    <button
                      type="button"
                      className={`page-lista-compras__escopo-btn${escopoLista === 'familia' ? ' page-lista-compras__escopo-btn--active' : ''}`}
                      onClick={() => setEscopoLista('familia')}
                      aria-pressed={escopoLista === 'familia'}
                    >
                      👨‍👩‍👧 {titularPrimeiroNome || 'Família'}
                    </button>
                    <button
                      type="button"
                      className={`page-lista-compras__escopo-btn${escopoLista === 'pessoal' ? ' page-lista-compras__escopo-btn--active' : ''}`}
                      onClick={() => setEscopoLista('pessoal')}
                      aria-pressed={escopoLista === 'pessoal'}
                    >
                      👤 Pessoal
                    </button>
                  </div>
                )}

                {/* Estado: sem listas */}
                {semListas && (
                  <div className="page-lista-compras__onboarding">
                    <span className="page-lista-compras__onboarding-icon">🛒</span>
                    <h2 className="page-lista-compras__onboarding-title">Crie sua primeira lista</h2>
                    <p className="page-lista-compras__onboarding-desc">
                      Organize suas compras, marque os itens no mercado e registre o gasto direto em Transações quando terminar.
                    </p>
                    <button
                      type="button"
                      className="page-lista-compras__onboarding-btn"
                      onClick={() => setModalNovaLista(true)}
                    >
                      Criar lista de compras
                    </button>
                  </div>
                )}

                {/* Loading inicial */}
                {loading && <ShimmerLista />}

                {/* Abas de listas */}
                {!loading && listas.length > 0 && (
                  <div className="page-lista-compras__tabs" role="tablist" aria-label="Suas listas de compras">
                    {listas.map((lista) => {
                      const contUnchecked = (lista.itens || []).filter((i) => !i.checked).length
                      const isAtiva = lista.id === listaAtiva
                      return (
                        <button
                          key={lista.id}
                          type="button"
                          role="tab"
                          aria-selected={isAtiva}
                          className={`page-lista-compras__tab${isAtiva ? ' page-lista-compras__tab--active' : ''}`}
                          onClick={() => selecionarLista(lista.id)}
                        >
                          {lista.nome}
                          {contUnchecked > 0 && (
                            <span className="page-lista-compras__tab-count" aria-label={`${contUnchecked} itens`}>
                              {contUnchecked}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Cabeçalho da lista ativa com opções */}
                {listaAtivaDados && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                      {listaAtivaDados?.tipo === 'tarefas' ? (
                        <span className="page-lista-compras__lista-gasto-tag page-lista-compras__lista-gasto-tag--tarefas">
                          <IconChecklist />
                          Tarefas
                        </span>
                      ) : (
                        <span className="page-lista-compras__lista-gasto-tag">
                          <IconSupermercado />
                          {LISTA_GASTO_ROTULO}
                        </span>
                      )}
                      {listaAtivaDados?.recorrencia && listaAtivaDados.recorrencia !== 'nenhuma' && (
                        <span className="page-lista-compras__recorrencia-badge">
                          🔁 {listaAtivaDados.recorrencia === 'semanal' ? 'Semanal' : 'Mensal'}
                        </span>
                      )}
                    </div>
                    <div className="page-lista-compras__list-menu" ref={menuListaRef}>
                      <button
                        type="button"
                        className="page-lista-compras__list-menu-btn"
                        onClick={() => setMenuListaAberto((v) => !v)}
                        aria-label="Opções da lista"
                        aria-expanded={menuListaAberto}
                      >
                        <IconMoreVertical />
                      </button>
                      {menuListaAberto && (
                        <div className="page-lista-compras__list-dropdown" role="menu">
                          {listaAtivaDados?.tipo !== 'tarefas' && itens.length > 0 && (
                            <button
                              type="button"
                              role="menuitem"
                              className="page-lista-compras__list-dropdown-item page-lista-compras__list-dropdown-item--accent"
                              onClick={() => { setMenuListaAberto(false); setModoComprando(true) }}
                            >
                              🛒 Modo comprando
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={renomearLista}
                          >
                            ✏️ Renomear
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={duplicarLista}
                          >
                            📋 Duplicar lista
                          </button>
                          {listaAtivaDados?.tipo !== 'tarefas' && (
                            <button
                              type="button"
                              role="menuitem"
                              className="page-lista-compras__list-dropdown-item"
                              onClick={definirOrcamento}
                            >
                              💰 {listaAtivaDados?.orcamento != null ? 'Alterar' : 'Definir'} orçamento
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={definirRecorrencia}
                          >
                            🔁 {listaAtivaDados?.recorrencia && listaAtivaDados.recorrencia !== 'nenhuma' ? 'Alterar repetição' : 'Repetir lista'}
                          </button>
                          {itens.some((i) => i.checked) && (
                            <button
                              type="button"
                              role="menuitem"
                              className="page-lista-compras__list-dropdown-item"
                              onClick={confirmarLimpar}
                            >
                              🧹 {listaAtivaDados?.tipo === 'tarefas' ? 'Limpar concluídas' : 'Limpar comprados'}
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={confirmarArquivar}
                          >
                            🗄️ Arquivar lista
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item page-lista-compras__list-dropdown-item--danger"
                            onClick={confirmarExcluir}
                          >
                            🗑️ Excluir lista
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Loading de itens */}
                {loadingItens && <ShimmerLista />}

                {/* Lista vazia */}
                {listaVazia && !loadingItens && (
                  <div className="page-lista-compras__empty">
                    <span className="page-lista-compras__empty-icon">📝</span>
                    <h2 className="page-lista-compras__empty-title">Lista vazia</h2>
                    <p className="page-lista-compras__empty-desc">
                      Toque em <strong>Novo item</strong> para adicionar o primeiro.
                    </p>
                  </div>
                )}

                {/* Grupos de itens (unchecked) */}
                {!loadingItens && itensAgrupados.ordenadas.map((cat) => (
                  <div key={cat} className="page-lista-compras__category-group">
                    {listaAtivaDados?.tipo !== 'tarefas' && (
                      <div className="page-lista-compras__category-header">
                        <span className="page-lista-compras__category-icon" aria-hidden="true">
                          {CATEGORIA_EMOJI[cat] || '🛒'}
                        </span>
                        {cat}
                      </div>
                    )}
                    {itensAgrupados.grupos[cat].map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={toggleItem}
                        onRemover={removerItem}
                        onEditar={iniciarEdicaoItem}
                        mostrarMedida={listaAtivaDados?.tipo !== 'tarefas'}
                        onAjustarUnidades={ajustarUnidades}
                        mostrarAutor={isMembroConta}
                      />
                    ))}
                  </div>
                ))}

                {/* Seção de itens marcados */}
                {!loadingItens && itensAgrupados.checked.length > 0 && (
                  <div className="page-lista-compras__checked-section">
                    <button
                      type="button"
                      className="page-lista-compras__checked-toggle"
                      onClick={() => setCheckedAberto((v) => !v)}
                      aria-expanded={checkedAberto}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className={`page-lista-compras__checked-chevron${checkedAberto ? ' page-lista-compras__checked-chevron--open' : ''}`}
                        style={{ width: 14, height: 14, stroke: 'currentColor', strokeWidth: 2.5, fill: 'none' }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      {itensAgrupados.checked.length} {itensAgrupados.checked.length === 1 ? 'item no carrinho' : 'itens no carrinho'}
                    </button>
                    {checkedAberto && itensAgrupados.checked.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={toggleItem}
                        onRemover={removerItem}
                        onEditar={iniciarEdicaoItem}
                        mostrarMedida={listaAtivaDados?.tipo !== 'tarefas'}
                        onAjustarUnidades={ajustarUnidades}
                        mostrarAutor={isMembroConta}
                      />
                    ))}
                  </div>
                )}

              </div>
            </RefDashboardScroll>
          </div>

          {/* Footer unificado: Total + Novo item + Registrar como gasto */}
          {listaAtiva && (
            <div className={`page-lista-compras__footer${temPreco ? '' : ' page-lista-compras__footer--solo'}`}>
              {orcamento != null && (
                <div className={`page-lista-compras__orcamento${orcamentoExcedido ? ' page-lista-compras__orcamento--excedido' : ''}`}>
                  <div className="page-lista-compras__orcamento-top">
                    <span className="page-lista-compras__orcamento-label">
                      {orcamentoExcedido ? '⚠️ Acima do orçamento' : 'Orçamento'}
                    </span>
                    <span className="page-lista-compras__orcamento-valor">
                      {formatarMoeda(totalEstimado)} / {formatarMoeda(orcamento)}
                    </span>
                  </div>
                  <div className="page-lista-compras__orcamento-bar" aria-hidden="true">
                    <span
                      className="page-lista-compras__orcamento-fill"
                      style={{ width: `${orcamentoExcedido ? 100 : orcamentoPct}%` }}
                    />
                  </div>
                  <span className="page-lista-compras__orcamento-restante">
                    {orcamentoExcedido
                      ? `Passou ${formatarMoeda(Math.abs(orcamentoRestante))}`
                      : `Resta ${formatarMoeda(orcamentoRestante)}`}
                  </span>
                </div>
              )}
              <div className="page-lista-compras__footer-main">
                <div className="page-lista-compras__footer-total-row">
                  {temPreco && (
                    <p className="page-lista-compras__total">
                      <span className="page-lista-compras__total-label">Total:</span>
                      <span className="page-lista-compras__total-value">{formatarMoeda(totalEstimado)}</span>
                    </p>
                  )}
                  <div className="page-lista-compras__footer-novo">
                    <button
                      type="button"
                      className="page-lista-compras__novo-item-fab"
                      onClick={() => setModalNovoItem(true)}
                      aria-label="Adicionar novo item à lista"
                    >
                      <span className="page-lista-compras__novo-item-fab__icon" aria-hidden="true">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>
                      </span>
                      <span className="page-lista-compras__novo-item-fab__label">Novo item</span>
                    </button>
                  </div>
                </div>
              </div>
              {temPreco && (
                <div className="page-lista-compras__footer-actions">
                  <button
                    type="button"
                    className="page-lista-compras__wa-btn"
                    onClick={enviarWhatsApp}
                    aria-label="Enviar lista pelo WhatsApp"
                    title="Enviar lista pelo WhatsApp"
                  >
                    <IconWhatsApp />
                    <span className="page-lista-compras__wa-btn__label">WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="page-lista-compras__cta-btn"
                    onClick={() => setModalGasto(true)}
                  >
                    Registrar como gasto
                  </button>
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Modal nova lista */}
      {modalNovaLista && (
        <ModalNovaLista
          onClose={() => setModalNovaLista(false)}
          onCriada={handleListaCriada}
          pessoalParam={pessoalParam}
        />
      )}

      {/* Modal novo / editar item */}
      {modalNovoItem && (
        <ModalNovoItem
          historico={historico}
          historicoPrecos={historicoPrecos}
          onClose={() => { setModalNovoItem(false); setItemEmEdicao(null) }}
          onSalvar={itemEmEdicao ? editarItem : adicionarItem}
          adicionando={adicionando}
          itemEditando={itemEmEdicao}
          permitePreco={listaAtivaDados?.tipo !== 'tarefas'}
        />
      )}

      {/* Modal registrar gasto */}
      {modalGasto && (
        <ModalRegistrarGasto
          lista={listaAtivaDados}
          total={totalEstimado}
          onClose={() => setModalGasto(false)}
          onRegistrado={() => setModalGasto(false)}
        />
      )}

      {modalRenomear && listaAtivaDados && (
        <ModalRenomearLista
          nomeAtual={listaAtivaDados.nome}
          salvando={salvandoMeta}
          onClose={() => setModalRenomear(false)}
          onSalvar={salvarRenome}
        />
      )}
      {modalOrcamento && listaAtivaDados && (
        <ModalOrcamentoLista
          orcamentoAtual={listaAtivaDados.orcamento}
          salvando={salvandoMeta}
          onClose={() => setModalOrcamento(false)}
          onSalvar={salvarOrcamento}
        />
      )}
      {modalRecorrencia && listaAtivaDados && (
        <ModalRecorrenciaLista
          recorrenciaAtual={listaAtivaDados.recorrencia}
          salvando={salvandoMeta}
          onClose={() => setModalRecorrencia(false)}
          onSalvar={salvarRecorrencia}
        />
      )}

      {/* Modo comprando (#9) — tela limpa fullscreen */}
      {modoComprando && (
        <ModoComprando
          lista={listaAtivaDados}
          itens={itens}
          onToggle={toggleItem}
          onClose={() => setModoComprando(false)}
        />
      )}

      {/* Confirmações (arquivar / excluir / limpar) */}
      <ConfirmDialog
        open={confirmacao != null}
        title={confirmacao?.title}
        message={confirmacao?.message}
        confirmLabel={confirmacao?.confirmLabel}
        tone={confirmacao?.tone}
        onConfirm={() => { confirmacao?.onConfirm?.(); setConfirmacao(null) }}
        onClose={() => setConfirmacao(null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ItemRow — extraído para evitar re-renders desnecessários
// ---------------------------------------------------------------------------

function ItemRow({ item, onToggle, onRemover, onEditar, mostrarMedida = true, onAjustarUnidades, mostrarAutor = false }) {
  const prazoFmt = item.prazo
    ? new Date(item.prazo).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <div className={`page-lista-compras__item${item.checked ? ' page-lista-compras__item--checked' : ''}`}>
      <button
        type="button"
        className={`page-lista-compras__item-check${item.checked ? ' page-lista-compras__item-check--checked' : ''}`}
        onClick={() => onToggle(item)}
        aria-label={item.checked ? `Desmarcar ${item.nome}` : `Marcar ${item.nome} como comprado`}
        aria-pressed={item.checked}
      >
        {item.checked && <IconCheck />}
      </button>

      <div className="page-lista-compras__item-body">
        <span className="page-lista-compras__item-name">{item.nome}</span>
        {prazoFmt && (
          <span className="page-lista-compras__item-prazo" title="Lembrete na agenda">📅 {prazoFmt}</span>
        )}
        {mostrarAutor && item.checked && item.checked_por_nome && (
          <span className="page-lista-compras__item-autor" title={`Marcado por ${item.checked_por_nome}`}>
            ✓ {item.checked_por_nome}
          </span>
        )}
        {mostrarMedida && (
        <span className="page-lista-compras__item-qty">{Number(item.quantidade)} {item.unidade}</span>
        )}
        {mostrarMedida && onAjustarUnidades && (
        <span className="page-lista-compras__item-stepper">
          <button
            type="button"
            className="page-lista-compras__item-step"
            onClick={() => onAjustarUnidades(item, -1)}
            disabled={(Number(item.unidades) || 1) <= 1}
            aria-label="Diminuir unidades"
          >−</button>
          <span className="page-lista-compras__item-units">{Math.max(1, Number(item.unidades) || 1)}un</span>
          <button
            type="button"
            className="page-lista-compras__item-step"
            onClick={() => onAjustarUnidades(item, 1)}
            aria-label="Aumentar unidades"
          >+</button>
        </span>
        )}
        {mostrarMedida && !onAjustarUnidades && (
        <span className="page-lista-compras__item-units">
          {Math.max(1, Number(item.unidades) || 1)}un
        </span>
        )}
        {item.preco_estimado != null && Number(item.preco_estimado) > 0 && (
          <span className="page-lista-compras__item-price">
            {formatarMoeda(Number(item.preco_estimado) * Math.max(1, Number(item.unidades) || 1))}
          </span>
        )}
      </div>

      <div className="page-lista-compras__item-actions">
        {onEditar && (
          <button
            type="button"
            className="page-lista-compras__item-edit"
            onClick={() => onEditar(item)}
            aria-label={`Editar ${item.nome}`}
          >
            <IconEdit />
          </button>
        )}
        <button
          type="button"
          className="page-lista-compras__item-delete"
          onClick={() => onRemover(item.id)}
          aria-label={`Remover ${item.nome}`}
        >
          <IconX />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modo Comprando (#9) — tela limpa fullscreen pro mercado
// ---------------------------------------------------------------------------

function ModoComprando({ lista, itens, onToggle, onClose }) {
  const pendentes = itens.filter((i) => !i.checked)
  const noCarrinho = itens.filter((i) => i.checked)
  const totalCarrinho = noCarrinho.reduce((s, i) => {
    const p = i.preco_estimado != null ? Number(i.preco_estimado) : 0
    return s + p * Math.max(1, Number(i.unidades) || 1)
  }, 0)
  const total = itens.length
  const feitos = noCarrinho.length

  // Mantém a tela acordada durante as compras (best-effort, sem suporte = ignora)
  useEffect(() => {
    let lock = null
    let released = false
    const pedir = async () => {
      try {
        if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
      } catch { /* sem suporte/negado */ }
    }
    void pedir()
    const onVis = () => {
      if (document.visibilityState === 'visible' && !released) void pedir()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVis)
      try { lock?.release?.() } catch { /* ignore */ }
    }
  }, [])

  // Trava o scroll do conteúdo por trás
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const precoItem = (item) =>
    item.preco_estimado != null && Number(item.preco_estimado) > 0
      ? formatarMoeda(Number(item.preco_estimado) * Math.max(1, Number(item.unidades) || 1))
      : ''

  return createPortal(
    <div className="modo-comprando" role="dialog" aria-modal="true" aria-label="Modo comprando">
      <header className="modo-comprando__header">
        <div className="modo-comprando__header-info">
          <span className="modo-comprando__lista-nome">{lista?.nome || 'Compras'}</span>
          <span className="modo-comprando__progresso">{feitos} de {total} no carrinho</span>
        </div>
        <button type="button" className="modo-comprando__close" onClick={onClose} aria-label="Sair do modo comprando">
          <IconX />
        </button>
      </header>

      <div className="modo-comprando__progress-bar" aria-hidden="true">
        <span
          className="modo-comprando__progress-fill"
          style={{ width: `${total > 0 ? (feitos / total) * 100 : 0}%` }}
        />
      </div>

      <div className="modo-comprando__scroll">
        {pendentes.length === 0 && (
          <div className="modo-comprando__done">
            <span className="modo-comprando__done-emoji" aria-hidden="true">🎉</span>
            <p className="modo-comprando__done-text">Tudo no carrinho!</p>
          </div>
        )}

        {pendentes.map((item) => (
          <button
            key={item.id}
            type="button"
            className="modo-comprando__item"
            onClick={() => onToggle(item)}
          >
            <span className="modo-comprando__check" aria-hidden="true" />
            <span className="modo-comprando__item-nome">{item.nome}</span>
            <span className="modo-comprando__item-meta">{precoItem(item)}</span>
          </button>
        ))}

        {noCarrinho.length > 0 && (
          <div className="modo-comprando__cart-section">
            <p className="modo-comprando__cart-label">No carrinho ({noCarrinho.length})</p>
            {noCarrinho.map((item) => (
              <button
                key={item.id}
                type="button"
                className="modo-comprando__item modo-comprando__item--done"
                onClick={() => onToggle(item)}
              >
                <span className="modo-comprando__check modo-comprando__check--on" aria-hidden="true">
                  <IconCheck />
                </span>
                <span className="modo-comprando__item-nome">{item.nome}</span>
                <span className="modo-comprando__item-meta">{precoItem(item)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="modo-comprando__footer">
        <div className="modo-comprando__total">
          <span className="modo-comprando__total-label">🛒 No carrinho</span>
          <span className="modo-comprando__total-value">{formatarMoeda(totalCarrinho)}</span>
        </div>
        <button type="button" className="modo-comprando__finish" onClick={onClose}>
          {pendentes.length === 0 ? 'Concluir' : 'Sair'}
        </button>
      </footer>
    </div>,
    document.body,
  )
}
