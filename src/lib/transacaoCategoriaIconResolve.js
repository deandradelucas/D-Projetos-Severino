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

  if (c === 'saldo' || s === 'saldo' || /\bsaldo\b/.test(hay)) return 'saldoPng'

  /* Antes de PNG genérico «Trabalho e Negócios» e heurísticas de carteira. */
  if (/\brenda principal\b/.test(hay) || c === 'renda principal' || s === 'renda principal') {
    return 'rendaPrincipalPng'
  }
  if (/\brenda extra\b/.test(hay) || c === 'renda extra' || s === 'renda extra') {
    return 'rendaExtraPng'
  }
  if (
    /\brendimentos e beneficios\b/.test(hay) ||
    c === 'rendimentos e beneficios' ||
    s === 'rendimentos e beneficios'
  ) {
    return 'rendimentosBeneficiosPng'
  }
  if (
    /\breceitas eventuais\b/.test(hay) ||
    c === 'receitas eventuais' ||
    s === 'receitas eventuais'
  ) {
    return 'receitasEventuaisPng'
  }
  if (
    /\brendas pj\b|\brenda pj\b/.test(hay) ||
    /\brendas pj\s*\/\s*empresa\b/.test(hay) ||
    c === 'rendas pj' ||
    s === 'rendas pj' ||
    c === 'renda pj' ||
    s === 'renda pj' ||
    c === 'empresa' ||
    s === 'empresa'
  ) {
    return 'rendasPjPng'
  }

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

  const key = resolved || byCat || null
  /* PNG único para toda a categoria Transporte (inclui combustível). */
  if (c === 'transporte') return 'transportePng'
  if (c === 'compras e varejo') return 'comprasVarejoPng'
  if (c === 'alimentacao') return 'alimentacaoPng'
  if (c === 'cuidados pessoais') return 'cuidadosPessoaisPng'
  if (c === 'despesas financeiras') return 'despesasFinanceirasPng'
  if (c === 'doacoes e presentes') return 'doacoesPresentesPng'
  if (c === 'documentacao e impostos') return 'documentacaoImpostosPng'
  if (c === 'educacao') return 'educacaoPng'
  if (c === 'investimentos e patrimonio') return 'investimentosPatrimonioPng'
  /* Ficheiro «Entreterimento»; aceita também a grafia correta «entretenimento». */
  if (c === 'lazer e entreterimento' || c === 'lazer e entretenimento') return 'lazerEntreterimentoPng'
  if (c === 'moradia') return 'moradiaPng'
  if (c === 'pets e dependentes') return 'petsDependentesPng'
  if (c === 'saude') return 'saudePng'
  if (c === 'servicos e assinaturas') return 'servicosAssinaturasPng'
  if (c === 'tecnologia e gadgets') return 'tecnologiaGadgetsPng'
  if (c === 'trabalho e negocios') return 'trabalhoNegociosPng'
  if (c === 'viagens' || c === 'viagem') return 'viagensPng'
  if (c === 'pix') return 'pixPng'
  return key
}
