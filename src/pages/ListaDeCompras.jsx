import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useFabCompact } from '../hooks/useFabCompact'
import './dashboard.css'
import '../styles/pages/listas.css'
import Sidebar from '../components/Sidebar'
import MobileMenuButton from '../components/MobileMenuButton'
import RefDashboardScroll from '../components/RefDashboardScroll'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { redirectSe401, redirectAssinaturaExpiradaSe403, redirectSeAuthBloqueada } from '../lib/authRedirect'
import { showToast } from '../lib/toastStore'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  IconPlus, IconCheck, IconX, IconEdit, IconWhatsApp, IconChevronDown,
  IconMoreVertical, IconSupermercado, IconChecklist, IconUsers, IconUser,
  IconRepeat, IconClipboard, IconCopy, IconWallet, IconSparkles,
  IconArchive, IconTrash,
} from '../components/lista/ListaIcons'
import {
  formatarMoeda, CATEGORIA_EMOJI, LISTA_GASTO_ROTULO, detectarCategoria,
  LISTA_ULTIMA_KEY,
} from '../lib/listaCompras'
import {
  ModalNovaLista, ModalRegistrarGasto, ModalNovoItem,
  ModalRenomearLista, ModalOrcamentoLista, ModalRecorrenciaLista,
} from '../components/lista/ListaModais'
import { ItemRow } from '../components/lista/ItemRow'
import { ModoComprando } from '../components/lista/ModoComprando'

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
  // FAB padrão: encolhe ao rolar (ver useFabCompact / AGENTS.md «FAB padrão»)
  const fabScrollRef = useRef(null)
  const fabCompact = useFabCompact(fabScrollRef)
  const [checkedAberto, setCheckedAberto] = useState(true)
  const [menuListaAberto, setMenuListaAberto] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [quickNome, setQuickNome] = useState('') // adição rápida (nome só, 1un, sem preço)
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
      if (redirectSeAuthBloqueada(res)) return
      if (!res.ok) return
      let data = await res.json()
      // A última lista editada (id persistido) vai para o primeiro lugar das abas.
      let saved = null
      try { saved = localStorage.getItem(LISTA_ULTIMA_KEY) } catch { /* indisponível */ }
      if (saved && Array.isArray(data)) {
        const idx = data.findIndex((l) => String(l.id) === String(saved))
        if (idx > 0) {
          const arr = data.slice()
          const [it] = arr.splice(idx, 1)
          arr.unshift(it)
          data = arr
        }
      }
      setListas(data)
      // Abre a ÚLTIMA lista que o usuário editou (id persistido em localStorage);
      // fallback: a mais recente (data[0], que o server ordena por criada_em desc).
      let alvoId = null
      if (saved && data.some((l) => String(l.id) === String(saved))) alvoId = saved
      if (!alvoId && data.length > 0) alvoId = String(data[0].id)
      const alvo = alvoId ? data.find((l) => String(l.id) === String(alvoId)) : null
      setListaAtiva(alvo ? alvo.id : null)
      setItens(alvo?.itens || [])
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  // Persiste a lista ativa para reabri-la na próxima visita à aba (ver carregarListas).
  useEffect(() => {
    if (listaAtiva) {
      try { localStorage.setItem(LISTA_ULTIMA_KEY, String(listaAtiva)) } catch { /* noop */ }
    }
  }, [listaAtiva])

  const carregarItens = useCallback(async (listaId, pp = '') => {
    if (!listaId) return
    setLoadingItens(true)
    try {
      const res = await apiFetch(apiUrl(`/api/lista-compras/${listaId}/itens${pp}`), {
        cache: 'no-store',
      })
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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

  // Adição rápida: só o nome → 1 unidade, sem preço (não abre modal)
  const adicionarRapido = useCallback(async (e) => {
    e?.preventDefault()
    const nome = quickNome.trim()
    if (!nome || adicionando) return
    setQuickNome('')
    await adicionarItem({ nome, quantidade: 1, unidade: 'un', unidades: 1, preco_estimado: null, prazo: null })
  }, [quickNome, adicionando, adicionarItem])

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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
      if (redirectSeAuthBloqueada(res)) return
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
    return { grupos, ordenadas, checked, unchecked }
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

    // Lista única, sem categorias (mesma ordem da tela)
    itensAgrupados.unchecked.forEach((item) => {
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
            <RefDashboardScroll ref={fabScrollRef}>
              <div className="page-lista-compras-wrap">

                {/* Header */}
                <div className="page-lista-compras__header">
                  <div className="page-lista-compras__header-left">
                    <MobileMenuButton onClick={() => setMenuAberto((v) => !v)} isOpen={menuAberto} />
                    <h1 className="page-lista-compras__title">Listas</h1>
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
                      <IconUsers /> {titularPrimeiroNome || 'Família'}
                    </button>
                    <button
                      type="button"
                      className={`page-lista-compras__escopo-btn${escopoLista === 'pessoal' ? ' page-lista-compras__escopo-btn--active' : ''}`}
                      onClick={() => setEscopoLista('pessoal')}
                      aria-pressed={escopoLista === 'pessoal'}
                    >
                      <IconUser /> Pessoal
                    </button>
                  </div>
                )}

                {/* Estado: sem listas */}
                {semListas && (
                  <div className="page-lista-compras__onboarding">
                    <span className="page-lista-compras__onboarding-icon"><IconSupermercado /></span>
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
                  <div className="page-lista-compras__tabs-wrap">
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
                  </div>
                )}

                {/* Visão geral: nenhuma lista aberta, mas há listas — orienta o toque */}
                {!loading && listas.length > 0 && !listaAtiva && (
                  <div className="page-lista-compras__overview-hint" role="note">
                    Toque numa lista acima para abrir, ou crie uma nova.
                  </div>
                )}

                {/* Cabeçalho da lista ativa com opções */}
                {listaAtivaDados && (
                  <div className="page-lista-compras__active-head">
                    <div className="page-lista-compras__active-head-main">
                    <h2 className="page-lista-compras__active-name">{listaAtivaDados.nome}</h2>
                    <div className="page-lista-compras__active-head-tags">
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
                          <IconRepeat /> {listaAtivaDados.recorrencia === 'semanal' ? 'Semanal' : 'Mensal'}
                        </span>
                      )}
                    </div>
                    </div>
                    {itens.length > 0 && (() => {
                      const feitos = itens.filter((i) => i.checked).length
                      const ehTarefas = listaAtivaDados?.tipo === 'tarefas'
                      return (
                        <span
                          className="page-lista-compras__active-progress"
                          aria-label={`${feitos} de ${itens.length} ${ehTarefas ? 'concluídas' : 'no carrinho'}`}
                        >
                          <span className="page-lista-compras__active-progress-bar" aria-hidden="true">
                            <span
                              className="page-lista-compras__active-progress-fill"
                              style={{ width: `${itens.length ? (feitos / itens.length) * 100 : 0}%` }}
                            />
                          </span>
                          {feitos} de {itens.length}
                        </span>
                      )
                    })()}
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
                              <IconSupermercado /> Modo comprando
                            </button>
                          )}
                          {temPreco && (
                            <button
                              type="button"
                              role="menuitem"
                              className="page-lista-compras__list-dropdown-item page-lista-compras__list-dropdown-item--accent"
                              onClick={() => { setMenuListaAberto(false); setModalGasto(true) }}
                            >
                              <IconWallet /> Registrar como gasto
                            </button>
                          )}
                          {temPreco && (
                            <button
                              type="button"
                              role="menuitem"
                              className="page-lista-compras__list-dropdown-item"
                              onClick={() => { setMenuListaAberto(false); enviarWhatsApp() }}
                            >
                              <IconWhatsApp /> Enviar no WhatsApp
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={renomearLista}
                          >
                            <IconEdit /> Renomear
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={duplicarLista}
                          >
                            <IconCopy /> Duplicar lista
                          </button>
                          {listaAtivaDados?.tipo !== 'tarefas' && (
                            <button
                              type="button"
                              role="menuitem"
                              className="page-lista-compras__list-dropdown-item"
                              onClick={definirOrcamento}
                            >
                              <IconWallet /> {listaAtivaDados?.orcamento != null ? 'Alterar' : 'Definir'} orçamento
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={definirRecorrencia}
                          >
                            <IconRepeat /> {listaAtivaDados?.recorrencia && listaAtivaDados.recorrencia !== 'nenhuma' ? 'Alterar repetição' : 'Repetir lista'}
                          </button>
                          {itens.some((i) => i.checked) && (
                            <button
                              type="button"
                              role="menuitem"
                              className="page-lista-compras__list-dropdown-item"
                              onClick={confirmarLimpar}
                            >
                              <IconSparkles /> {listaAtivaDados?.tipo === 'tarefas' ? 'Limpar concluídas' : 'Limpar comprados'}
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item"
                            onClick={confirmarArquivar}
                          >
                            <IconArchive /> Arquivar lista
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="page-lista-compras__list-dropdown-item page-lista-compras__list-dropdown-item--danger"
                            onClick={confirmarExcluir}
                          >
                            <IconTrash /> Excluir lista
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
                    <span className="page-lista-compras__empty-icon"><IconClipboard /></span>
                    <h2 className="page-lista-compras__empty-title">Lista vazia</h2>
                    <p className="page-lista-compras__empty-desc">
                      Toque em <strong>Novo item</strong> para adicionar o primeiro.
                    </p>
                    <button
                      type="button"
                      className="page-lista-compras__empty-btn"
                      onClick={() => setModalNovoItem(true)}
                    >
                      + Novo item
                    </button>
                  </div>
                )}

                {/* Tudo comprado/concluído — todos os itens marcados */}
                {!loadingItens && itensAgrupados.unchecked.length === 0 && itensAgrupados.checked.length > 0 && (
                  <div className="page-lista-compras__concluida" role="status">
                    <span className="page-lista-compras__concluida-icon" aria-hidden="true"><IconCheck /></span>
                    <div className="page-lista-compras__concluida-text">
                      <strong>{listaAtivaDados?.tipo === 'tarefas' ? 'Tudo concluído!' : 'Tudo comprado!'}</strong>
                      <span>{itensAgrupados.checked.length} {itensAgrupados.checked.length === 1 ? 'item' : 'itens'} {listaAtivaDados?.tipo === 'tarefas' ? 'concluídos' : 'no carrinho'}</span>
                    </div>
                  </div>
                )}

                {/* Itens (unchecked) — lista única, sem cabeçalhos de categoria */}
                {!loadingItens && itensAgrupados.unchecked.length > 0 && (
                  <div className="page-lista-compras__category-group">
                    {itensAgrupados.unchecked.map((item) => (
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

                {/* Adição rápida — só o nome, vira item com 1un e sem preço */}
                {listaAtiva && !loadingItens && itens.length > 0 && (
                  <form className="page-lista-compras__quick-add" onSubmit={adicionarRapido}>
                    <span className="page-lista-compras__quick-add-icon" aria-hidden="true"><IconPlus /></span>
                    <input
                      type="text"
                      className="page-lista-compras__quick-add-input"
                      value={quickNome}
                      onChange={(e) => setQuickNome(e.target.value)}
                      placeholder="Adicionar rápido"
                      aria-label="Adicionar item rápido (só o nome, 1 unidade, sem preço)"
                      maxLength={200}
                    />
                    {quickNome.trim() && (
                      <button
                        type="submit"
                        className="page-lista-compras__quick-add-btn"
                        disabled={adicionando}
                        aria-label="Adicionar item"
                      >
                        Adicionar
                      </button>
                    )}
                  </form>
                )}

                {/* Footer em fluxo — abaixo do último item da lista (não mais sticky) */}
                {listaAtiva && itens.length > 0 && (
                  <div className={`page-lista-compras__footer${temPreco ? '' : ' page-lista-compras__footer--solo'}`}>
              {orcamento != null && (
                <div className={`page-lista-compras__orcamento${orcamentoExcedido ? ' page-lista-compras__orcamento--excedido' : ''}`}>
                  <div className="page-lista-compras__orcamento-top">
                    <span className="page-lista-compras__orcamento-label">
                      {orcamentoExcedido ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <path d="M12 9v4" /><path d="M12 17h.01" />
                          </svg>
                          Acima do orçamento
                        </>
                      ) : 'Orçamento'}
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
              <div className="page-lista-compras__footer-actions">
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
                {temPreco && (
                  <p className="page-lista-compras__total">
                    <span className="page-lista-compras__total-label">Total:</span>
                    <span className="page-lista-compras__total-value">{formatarMoeda(totalEstimado)}</span>
                  </p>
                )}
                  </div>
                </div>
                )}

              </div>
            </RefDashboardScroll>
          </div>

        </main>
      </div>

      {/* FAB padrão «Nova lista» — só na visão geral (sem lista ativa, sem footer p/ colidir).
          `!loading` evita o flash/encolhe no carregamento (listaAtiva ainda é null antes da lista chegar). */}
      {!loading && !listaAtiva && !modoComprando && !modalNovaLista && (
        <div className="dashboard-mobile-fabs">
          <button
            type="button"
            className={`dashboard-mobile-tx-fab${fabCompact ? ' dashboard-mobile-tx-fab--compact' : ''}`}
            onClick={() => setModalNovaLista(true)}
            aria-label="Criar nova lista"
          >
            <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span className="dashboard-mobile-tx-fab__label">Nova lista</span>
          </button>
        </div>
      )}

      {/* FAB padrão «Novo item» — lista ativa porém vazia (sem footer p/ colidir) */}
      {!loading && listaAtiva && !loadingItens && itens.length === 0 && !modoComprando && !modalNovoItem && !modalNovaLista && (
        <div className="dashboard-mobile-fabs">
          <button
            type="button"
            className={`dashboard-mobile-tx-fab${fabCompact ? ' dashboard-mobile-tx-fab--compact' : ''}`}
            onClick={() => setModalNovoItem(true)}
            aria-label="Adicionar novo item à lista"
          >
            <span className="dashboard-mobile-tx-fab__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
            <span className="dashboard-mobile-tx-fab__label">Novo item</span>
          </button>
        </div>
      )}

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
