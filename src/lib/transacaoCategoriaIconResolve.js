/** Remove acentos e normaliza para comparação. */
function norm(s) {
  if (s == null) return ''
  const t = String(s).trim()
  if (!t || t === '—') return ''
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Identificador do ícone (ou null = seta receita/despesa padrão).
 * Ordem: pistas na subcategoria + texto combinado, depois nome exato da categoria (normalizado).
 */
export function getTransacaoCategoriaIconKey(categoriaNome, subcategoriaNome) {
  const c = norm(categoriaNome)
  const s = norm(subcategoriaNome)
  const hay = `${c} ${s}`

  const test = (patterns, key) => {
    for (const p of patterns) {
      if (p.test(hay) || p.test(s) || p.test(c)) return key
    }
    return null
  }

  const byCat =
    {
      alimentacao: 'utensils',
      transporte: 'car',
      moradia: 'home',
      saude: 'health',
      educacao: 'education',
      lazer: 'leisure',
      compras: 'shopping',
      pets: 'pet',
      viagem: 'plane',
      servicos: 'subscription',
    }[c] || null

  const resolved =
    test([/combustivel|gasolina|etanol|gnv|posto|abastec/, /\bfuel\b/], 'fuel') ||
    test(
      [/restaurante|lanches|lanche|supermercado|mercado|delivery|ifood|padaria|feira|nutricao/, /\bfood\b/],
      'utensils',
    ) ||
    test(
      [/estacionament|pedagio|uber|99pop|99\b|taxi|onibus|metro|passagem|transporte publico|locacao de veiculo|manutencao veicular/],
      'car',
    ) ||
    test([/agua\b|luz\b|energia|internet|telefone|celular|condominio|iptu|aluguel|moradia|reforma|\bcasa\b/], 'home') ||
    test([/farmacia|medico|hospital|clinica|plano de saude|odonto|dentista|exame|psicologo/], 'health') ||
    test([/escola|faculdade|curso|livro|mensalidade escolar|educacao|estudo|material escolar/], 'education') ||
    test([/cinema|show|streaming|netflix|spotify|jogo|video game|bar\b|balada|lazer|hobby|entretenimento/], 'leisure') ||
    test([/roupa|vestuario|calcado|acessorio|shopping|\bcompra|ecommerce|e-commerce|marketplace/], 'shopping') ||
    test([/tecnologia|gadget|eletronic|smartphone|notebook|computador|software|hardware|assinatura digital/], 'tech') ||
    test([/mensalidade fixa|servico recorrente|streaming fixo/, /^assinatura\b/], 'subscription') ||
    test([/academia|crossfit|musculacao|pilates|corrida|esporte/], 'fitness') ||
    test([/imposto|taxa|boleto|tributo|iptu|ipva|irpf|contabilidade/], 'receipt') ||
    test([/pet\b|racao|veterinario|cachorro|gato\b/], 'pet') ||
    test([/viagem|hotel|passagem aerea|airbnb|turismo/], 'plane') ||
    test([/presente|doacao|caridade/], 'gift') ||
    test([/salario|ordenado|holerite|pagamento pj|rendimento trabalho/], 'wallet') ||
    test([/freela|freelance|consultoria|projeto\b|trabalho extra|honorario/], 'work') ||
    test([/investimento|acao\b|fundo|crypto|cripto|dividendo|cdb|tesouro/], 'investment') ||
    test([/filho|filha|infantil|escola infantil|creche|fralda/], 'child') ||
    test([/tarifa bancaria|saque|transferencia entre contas|pix.*taxa/, /\bbanco\b/], 'bank') ||
    null

  return resolved || byCat || null
}

/** Referência: ícone SVG ↔ categorias / palavras-chave reconhecidas */
export const LISTA_ICONES_CATEGORIA_TRANSACOES = [
  { id: 'utensils', nomeIcone: 'Utensílios / refeição', categorias: 'Alimentação; compras tipo mercado', palavras: 'restaurante, lanches, supermercado, delivery, padaria…' },
  { id: 'fuel', nomeIcone: 'Bomba de combustível', categorias: 'Transporte', palavras: 'combustível, gasolina, etanol, GNV, posto…' },
  { id: 'car', nomeIcone: 'Carro / mobilidade', categorias: 'Transporte', palavras: 'Uber, táxi, ônibus, metrô, pedágio, estacionamento…' },
  { id: 'home', nomeIcone: 'Casa', categorias: 'Moradia', palavras: 'aluguel, condomínio, luz, água, internet, IPTU…' },
  { id: 'health', nomeIcone: 'Coração / saúde', categorias: 'Saúde', palavras: 'farmácia, médico, hospital, plano, odonto…' },
  { id: 'education', nomeIcone: 'Livro', categorias: 'Educação', palavras: 'escola, faculdade, curso, livro…' },
  { id: 'leisure', nomeIcone: 'Ticket / lazer', categorias: 'Lazer', palavras: 'cinema, streaming, jogos, bar…' },
  { id: 'shopping', nomeIcone: 'Sacola', categorias: 'Compras', palavras: 'roupa, calçado, e-commerce…' },
  { id: 'tech', nomeIcone: 'Smartphone', categorias: 'Tecnologia e gadgets', palavras: 'notebook, software, eletrônicos…' },
  { id: 'subscription', nomeIcone: 'Cartão', categorias: 'Serviços', palavras: 'assinatura fixa, mensalidade recorrente…' },
  { id: 'fitness', nomeIcone: 'Halteres', categorias: 'Academia / esporte', palavras: 'musculação, pilates, corrida…' },
  { id: 'receipt', nomeIcone: 'Nota fiscal', categorias: 'Impostos e taxas', palavras: 'boleto, IPVA, IR…' },
  { id: 'pet', nomeIcone: 'Pata', categorias: 'Pets', palavras: 'ração, veterinário…' },
  { id: 'plane', nomeIcone: 'Avião', categorias: 'Viagem', palavras: 'hotel, passagem, turismo…' },
  { id: 'gift', nomeIcone: 'Presente', categorias: 'Presentes / doações', palavras: 'presente, doação…' },
  { id: 'wallet', nomeIcone: 'Carteira', categorias: 'Receitas', palavras: 'salário, holerite…' },
  { id: 'work', nomeIcone: 'Maleta', categorias: 'Receitas', palavras: 'freela, consultoria…' },
  { id: 'investment', nomeIcone: 'Metas / investimento', categorias: 'Investimentos', palavras: 'dividendo, CDB, cripto…' },
  { id: 'child', nomeIcone: 'Rosto infantil', categorias: 'Família', palavras: 'creche, fralda…' },
  { id: 'bank', nomeIcone: 'Banco', categorias: 'Banco', palavras: 'tarifa, PIX com taxa…' },
  { id: 'arrow-up', nomeIcone: 'Seta ↑', categorias: '(padrão)', palavras: 'Receita sem ícone específico' },
  { id: 'arrow-down', nomeIcone: 'Seta ↓', categorias: '(padrão)', palavras: 'Despesa sem ícone específico' },
]
