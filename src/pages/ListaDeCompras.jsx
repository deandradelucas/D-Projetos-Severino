import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import './dashboard.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { apiUrl } from '../lib/apiUrl'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'
import { redirectAssinaturaExpiradaSe403 } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'

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

const CATEGORIAS_FINANCEIRAS = [
  'Alimentação',
  'Saúde',
  'Higiene',
  'Limpeza',
  'Lazer',
  'Transporte',
  'Outros',
]

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

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
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
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) return

    setSalvando(true)
    try {
      const res = await fetch(apiUrl(`/api/lista-compras${pessoalParam}`), {
        method: 'POST',
        headers: { ...horizonteApiAuthHeaders(), 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ nome: nomeTrimmed }),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
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
    <div className="page-lista-compras__modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-nova-lista-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-nova-lista-titulo" className="page-lista-compras__modal-title">Nova lista</h2>
          <button type="button" className="page-lista-compras__modal-close" onClick={onClose} aria-label="Fechar">
            <IconX />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="nome-lista">Nome da lista</label>
            <input
              id="nome-lista"
              ref={inputRef}
              className="page-lista-compras__modal-input"
              type="text"
              placeholder="Ex: Mercado da semana"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={100}
              required
            />
          </div>
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

function ModalRegistrarGasto({ lista, total, onClose, onRegistrado }) {
  const [categoria, setCategoria] = useState(lista?.categoria_financeira || 'Alimentação')
  const [descricao, setDescricao] = useState(`${lista?.nome || 'Lista de compras'} — ${dataHojeIso()}`)
  const [salvando, setSalvando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (total <= 0) {
      showToast('Nenhum item com preço estimado.', 'error')
      return
    }

    setSalvando(true)
    try {
      const res = await fetch(apiUrl('/api/transacoes'), {
        method: 'POST',
        headers: { ...horizonteApiAuthHeaders(), 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          tipo: 'DESPESA',
          valor: total,
          data_transacao: dataHojeIso(),
          descricao: descricao.trim() || lista?.nome || 'Lista de compras',
          status: 'EFETIVADA',
        }),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao registrar gasto.', 'error')
        return
      }
      showToast('Gasto registrado em Transações!', 'success')
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
            <label className="page-lista-compras__modal-label" htmlFor="gasto-cat">Categoria financeira</label>
            <select
              id="gasto-cat"
              className="page-lista-compras__modal-select"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {CATEGORIAS_FINANCEIRAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
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
            <button type="submit" className="page-lista-compras__modal-confirm" disabled={salvando || total <= 0}>
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

function ModalNovoItem({ historico, onClose, onSalvar, adicionando }) {
  const [nome, setNome] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [unidade, setUnidade] = useState('un')
  const [preco, setPreco] = useState('')
  const [sugestoes, setSugestoes] = useState([])
  const [showAuto, setShowAuto] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

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

  function handleSubmit(e) {
    e.preventDefault()
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed) return
    const precoStr = preco.replace(',', '.').trim()
    const precoVal = precoStr !== '' ? parseFloat(precoStr) : null
    onSalvar({
      nome: nomeTrimmed,
      quantidade,
      unidade,
      preco_estimado: precoVal && precoVal > 0 ? precoVal : null,
    })
  }

  return (
    <div className="page-lista-compras__modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-novo-item-titulo">
        <div className="page-lista-compras__modal-header">
          <h2 id="modal-novo-item-titulo" className="page-lista-compras__modal-title">Novo item</h2>
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

          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="item-qty">Quantidade</label>
            <input
              id="item-qty"
              className="page-lista-compras__modal-input page-lista-compras__modal-input--qty"
              type="number"
              min="0.1"
              step="1"
              value={quantidade}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setQuantidade(v) }}
            />
          </div>

          <div className="page-lista-compras__modal-field">
            <span className="page-lista-compras__modal-label">Unidade</span>
            <div className="page-lista-compras__unit-pills" role="group" aria-label="Unidade de medida">
              {['un', 'kg', 'g', 'L', 'mL', 'cx', 'pct', 'dz'].map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`page-lista-compras__unit-pill${unidade === u ? ' page-lista-compras__unit-pill--active' : ''}`}
                  onClick={() => setUnidade(u)}
                  aria-pressed={unidade === u}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="page-lista-compras__modal-field">
            <label className="page-lista-compras__modal-label" htmlFor="item-preco">
              Preço estimado <span className="page-lista-compras__modal-label--optional">(opcional)</span>
            </label>
            <input
              id="item-preco"
              className="page-lista-compras__modal-input"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 7,90"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </div>

          <div className="page-lista-compras__modal-actions">
            <button type="button" className="page-lista-compras__modal-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="page-lista-compras__modal-confirm" disabled={adicionando || !nome.trim()}>
              {adicionando ? 'Adicionando…' : 'Adicionar'}
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
  const [modalNovaLista, setModalNovaLista] = useState(false)
  const [modalNovoItem, setModalNovoItem] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [checkedAberto, setCheckedAberto] = useState(true)
  const [menuListaAberto, setMenuListaAberto] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
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
      const res = await fetch(apiUrl(`/api/lista-compras${pp}`), {
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
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
      const res = await fetch(apiUrl(`/api/lista-compras/${listaId}/itens${pp}`), {
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
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
      const res = await fetch(apiUrl(`/api/lista-compras/historico-nomes${pp}`), {
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = await res.json()
      setHistorico(data)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(apiUrl('/api/familia/meu-escopo'), {
          headers: horizonteApiAuthHeaders(),
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
    }
    init()
  }, [carregarListas, carregarHistorico])

  // Recarregar ao mudar escopo (pessoal ↔ família)
  useEffect(() => {
    if (!isMembroConta) return
    carregarListas(pessoalParam)
    carregarHistorico(pessoalParam)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopoLista])

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

  const adicionarItem = useCallback(async ({ nome, quantidade, unidade, preco_estimado }) => {
    const nomeTrimmed = nome.trim()
    if (!nomeTrimmed || !listaAtiva) return

    setAdicionando(true)
    const categoria = detectarCategoria(nomeTrimmed)

    try {
      const res = await fetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens${pessoalParam}`), {
        method: 'POST',
        headers: { ...horizonteApiAuthHeaders(), 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          nome: nomeTrimmed,
          categoria_item: categoria,
          quantidade,
          unidade,
          preco_estimado: preco_estimado || null,
        }),
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast(err.message || 'Erro ao adicionar item.', 'error')
        return
      }
      const item = await res.json()
      setItens((prev) => [...prev, item])
      if (!historico.includes(item.nome)) {
        setHistorico((prev) => [item.nome, ...prev].slice(0, 50))
      }
      setModalNovoItem(false)
    } catch {
      showToast('Erro ao adicionar item.', 'error')
    } finally {
      setAdicionando(false)
    }
  }, [listaAtiva, historico, pessoalParam])

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
      const res = await fetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens/${item.id}/toggle${pessoalParam}`), {
        method: 'POST',
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
      if (!res.ok) {
        // Reverter em caso de erro
        setItens((prev) => prev.map((i) =>
          i.id === item.id ? { ...i, checked: item.checked, checked_em: item.checked_em } : i
        ))
        showToast('Erro ao atualizar item.', 'error')
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
      const res = await fetch(apiUrl(`/api/lista-compras/${listaAtiva}/itens/${itemId}${pessoalParam}`), {
        method: 'DELETE',
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
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
    setMenuListaAberto(false)

    if (!window.confirm('Arquivar esta lista? Ela não aparecerá mais na tela.')) return

    try {
      const res = await fetch(apiUrl(`/api/lista-compras/${listaAtiva}${pessoalParam}`), {
        method: 'DELETE',
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
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
    setMenuListaAberto(false)

    if (!window.confirm('Excluir lista permanentemente? Todos os itens serão removidos. Esta ação não pode ser desfeita.')) return

    try {
      const res = await fetch(apiUrl(`/api/lista-compras/${listaAtiva}/excluir${pessoalParam}`), {
        method: 'DELETE',
        headers: horizonteApiAuthHeaders(),
        cache: 'no-store',
      })
      if (redirectAssinaturaExpiradaSe403(res)) return
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
      return sum + (i.preco_estimado != null ? Number(i.preco_estimado) * Number(i.quantidade || 1) : 0)
    }, 0),
    [itens]
  )

  const temPreco = useMemo(() =>
    itens.some((i) => !i.checked && i.preco_estimado != null && Number(i.preco_estimado) > 0),
    [itens]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const semListas = !loading && listas.length === 0
  const listaVazia = !loadingItens && listaAtiva && itens.length === 0

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
                    <h1 className="page-lista-compras__title sr-only">Lista de Compras</h1>
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <IconClock /> {listaAtivaDados.categoria_financeira}
                    </span>
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
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={arquivarLista}
                          >
                            🗄️ Arquivar lista
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item page-lista-compras__list-dropdown-item--danger"
                            onClick={excluirLista}
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
                      Digite um item no campo abaixo e pressione Enter para adicionar.
                    </p>
                  </div>
                )}

                {/* Grupos de itens (unchecked) */}
                {!loadingItens && itensAgrupados.ordenadas.map((cat) => (
                  <div key={cat} className="page-lista-compras__category-group">
                    <div className="page-lista-compras__category-header">
                      <span className="page-lista-compras__category-icon" aria-hidden="true">
                        {CATEGORIA_EMOJI[cat] || '🛒'}
                      </span>
                      {cat}
                    </div>
                    {itensAgrupados.grupos[cat].map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={toggleItem}
                        onRemover={removerItem}
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
                      />
                    ))}
                  </div>
                )}

              </div>
            </RefDashboardScroll>
          </div>

          {/* Footer total + CTA (só com preço estimado) */}
          {listaAtiva && temPreco && (
            <div className="page-lista-compras__footer">
              <p className="page-lista-compras__total">
                Total estimado: <strong>{formatarMoeda(totalEstimado)}</strong>
              </p>
              <button
                type="button"
                className="page-lista-compras__cta-btn"
                onClick={() => setModalGasto(true)}
              >
                Registrar como gasto
              </button>
            </div>
          )}

        </main>
      </div>

      {/* FAB: Novo item */}
      {listaAtiva && (
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
      )}

      {/* Modal nova lista */}
      {modalNovaLista && (
        <ModalNovaLista
          onClose={() => setModalNovaLista(false)}
          onCriada={handleListaCriada}
          pessoalParam={pessoalParam}
        />
      )}

      {/* Modal novo item */}
      {modalNovoItem && (
        <ModalNovoItem
          historico={historico}
          onClose={() => setModalNovoItem(false)}
          onSalvar={adicionarItem}
          adicionando={adicionando}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// ItemRow — extraído para evitar re-renders desnecessários
// ---------------------------------------------------------------------------

function ItemRow({ item, onToggle, onRemover }) {
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
        <span className="page-lista-compras__item-qty">{Number(item.quantidade)} {item.unidade}</span>
        {item.preco_estimado != null && Number(item.preco_estimado) > 0 && (
          <span className="page-lista-compras__item-price">
            {formatarMoeda(Number(item.preco_estimado) * Number(item.quantidade || 1))}
          </span>
        )}
      </div>

      <button
        type="button"
        className="page-lista-compras__item-delete"
        onClick={() => onRemover(item.id)}
        aria-label={`Remover ${item.nome}`}
      >
        <IconX />
      </button>
    </div>
  )
}
