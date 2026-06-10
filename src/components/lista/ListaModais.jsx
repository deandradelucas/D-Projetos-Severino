import { useState, useEffect, useRef } from 'react'
import { useModalA11y } from '../../hooks/useModalA11y'
import { useSheetDragClose } from '../../hooks/useSheetDragClose'
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset'
import { IconX, IconSupermercado, IconChecklist } from './ListaIcons'
import {
  formatarMoeda, CATEGORIA_EMOJI, dataHojeIso, detectarCategoria,
  encontrarSubcategoriaMercado,
} from '../../lib/listaCompras'
import { apiUrl } from '../../lib/apiUrl'
import { apiFetch } from '../../lib/apiFetch'
import { redirectSeAuthBloqueada } from '../../lib/authRedirect'
import { showToast } from '../../lib/toastStore'

// Modais da página de Listas (Compras / Tarefas) — extraídos de pages/ListaDeCompras.jsx.

// ---------------------------------------------------------------------------
// Modal Nova Lista
// ---------------------------------------------------------------------------

export function ModalNovaLista({ onClose, onCriada, pessoalParam = '' }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('compras')
  const [orcamentoCentavos, setOrcamentoCentavos] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef(null)
  const sheetRef = useRef(null)
  useSheetDragClose(sheetRef, { open: true, onClose })
  useModalA11y({ open: true, onClose, containerRef: sheetRef, autoFocus: false })
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
      if (redirectSeAuthBloqueada(res)) return
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
                <IconSupermercado /> Compras
              </button>
              <button
                type="button"
                className={`page-lista-compras__tipo-btn${tipo === 'tarefas' ? ' page-lista-compras__tipo-btn--active' : ''}`}
                onClick={() => setTipo('tarefas')}
                aria-pressed={tipo === 'tarefas'}
              >
                <IconChecklist /> Tarefas
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

export function ModalRegistrarGasto({ lista, total, onClose, onRegistrado }) {
  const [categorias, setCategorias] = useState([])
  const [categoriaId, setCategoriaId] = useState('')
  const [subcategoriaId, setSubcategoriaId] = useState('')
  const [subcategoriaNome, setSubcategoriaNome] = useState('')
  const [descricao, setDescricao] = useState(`${lista?.nome || 'Lista de compras'} — ${dataHojeIso()}`)
  const [valorCentavos, setValorCentavos] = useState(Math.round((Number(total) || 0) * 100))
  const [salvando, setSalvando] = useState(false)
  const [carregandoCategorias, setCarregandoCategorias] = useState(true)
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef })

  const valorReal = valorCentavos / 100
  // Diferença entre o que foi pago e o estimado (#8 planejado vs real)
  const diff = valorReal - (Number(total) || 0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch(apiUrl('/api/categorias'))
        if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      <div ref={modalRef} className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-gasto-titulo">
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

export function ModalNovoItem({ historico, historicoPrecos = {}, onClose, onSalvar, adicionando, itemEditando = null, permitePreco = true }) {
  const editando = !!itemEditando
  const sheetRef = useRef(null)
  useSheetDragClose(sheetRef, { open: true, onClose })
  useModalA11y({ open: true, onClose, containerRef: sheetRef, autoFocus: false })
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
      <div ref={sheetRef} className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-novo-item-titulo">
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
export function ModalRenomearLista({ nomeAtual, onClose, onSalvar, salvando }) {
  const [nome, setNome] = useState(nomeAtual || '')
  const inputRef = useRef(null)
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef, autoFocus: false })
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
      <div ref={modalRef} className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-renomear-titulo">
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
export function ModalOrcamentoLista({ orcamentoAtual, onClose, onSalvar, salvando }) {
  const [centavos, setCentavos] = useState(orcamentoAtual != null ? Math.round(Number(orcamentoAtual) * 100) : 0)
  const inputRef = useRef(null)
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef, autoFocus: false })
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
      <div ref={modalRef} className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-orcamento-titulo">
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
export function ModalRecorrenciaLista({ recorrenciaAtual, onClose, onSalvar, salvando }) {
  const [sel, setSel] = useState(recorrenciaAtual || 'nenhuma')
  const modalRef = useRef(null)
  useModalA11y({ open: true, onClose, containerRef: modalRef })
  const keyboardH = useKeyboardOffset()
  const overlayStyle = { '--lista-kb': keyboardH > 0 ? `${keyboardH + 8}px` : '0px' }
  const OPCOES = [
    { v: 'nenhuma', l: 'Não repetir' },
    { v: 'semanal', l: 'Toda semana' },
    { v: 'mensal', l: 'Todo mês' },
  ]

  return (
    <div className="page-lista-compras__modal-overlay" style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className="page-lista-compras__modal" role="dialog" aria-modal="true" aria-labelledby="modal-recorrencia-titulo">
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
