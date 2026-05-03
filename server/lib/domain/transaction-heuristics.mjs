import { DEFAULT_CATEGORIES } from '../transacoes.mjs'

/**
 * Normaliza texto para comparação (remove acentos e espaços).
 */
export function normTxt(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Resolve categoria pelo nome exato do seed (`DEFAULT_CATEGORIES`). */
export function findCategoryBySeedNome(cats, categoriaNome) {
  const nref = normTxt(categoriaNome)
  return cats.find((c) => c.nome === categoriaNome || normTxt(c.nome) === nref)
}

/**
 * Escolhe subcategoria na ordem de preferência (rótulos iguais ou contidos no nome do banco).
 * Rótulos devem coincidir com `subcategorias` em `DEFAULT_CATEGORIES`.
 */
export function findSubPreferida(cat, subLabels) {
  if (!cat?.subcategorias?.length || !subLabels?.length) return null
  for (const label of subLabels) {
    const n = normTxt(label)
    const s = cat.subcategorias.find((sub) => {
      const sn = normTxt(sub.nome)
      return sn === n || sn.includes(n) || n.includes(sn)
    })
    if (s) return s
  }
  return null
}

/** Nomes de categorias válidos no seed (evita typo nas regras). */
export const SEED_CAT_NOMES = new Set(DEFAULT_CATEGORIES.map((c) => c.nome))

/**
 * Regras alinhadas a `DEFAULT_CATEGORIES` — ordem: mais específicas primeiro.
 */
export const DESPESA_RULES = [
  { re: /atacad|assai|atacadao|makro/i, categoriaNome: 'Alimentação', subLabels: ['Atacadista', 'Supermercado'] },
  { re: /feira|sacolao|sacolão|hortifrut|hortifruti|verdur/i, categoriaNome: 'Alimentação', subLabels: ['Feira e Sacolão', 'Hortifruti', 'Supermercado'] },
  { re: /mercado|supermercado|carrefour|walmart|hiper|pao de acucar|pão de açúcar/i, categoriaNome: 'Alimentação', subLabels: ['Supermercado', 'Atacadista'] },
  { re: /padaria|pao|pão|cafeteria|cafe\b|café/i, categoriaNome: 'Alimentação', subLabels: ['Padaria e Cafeteira'] },
  { re: /açougue|acougue|peixaria|peixe\b/i, categoriaNome: 'Alimentação', subLabels: ['Açougue e Peixaria'] },
  { re: /bebida|cerveja|vinho|refrigerante/i, categoriaNome: 'Alimentação', subLabels: ['Bebidas'] },
  { re: /ifood|rappi|delivery|uber\s*eats|zap\s*food|99\s*food/i, categoriaNome: 'Alimentação', subLabels: ['Delivery (iFood, etc)', 'Restaurantes e Lanches', 'Fast Food'] },
  { re: /restaurante|lanche|almoco|almoço|jantar|mcdonald|burguer|burger|pizza|bk\b/i, categoriaNome: 'Alimentação', subLabels: ['Restaurantes e Lanches', 'Fast Food', 'Delivery (iFood, etc)'] },
  { re: /combust|gasolina|etanol|posto|diesel|shell|ipiranga|petrobras/i, categoriaNome: 'Transporte', subLabels: ['Combustível'] },
  { re: /\buber\b|\b99\b(?!\s*food)|taxi|táxi|cabify|indriver|bolt\b|99pop/i, categoriaNome: 'Transporte', subLabels: ['App de Transporte (Uber, 99)', 'Táxi'] },
  { re: /onibus|ônibus|metro|metrô|vlt|bilhete unico|integracao/i, categoriaNome: 'Transporte', subLabels: ['Transporte Público'] },
  { re: /estaciona|zona azul/i, categoriaNome: 'Transporte', subLabels: ['Estacionamento'] },
  { re: /pedagio|pedágio/i, categoriaNome: 'Transporte', subLabels: ['Pedágio'] },
  { re: /farmacia|drogaria|remedio|remédio|medicamento|droga\b/i, categoriaNome: 'Saúde', subLabels: ['Medicamentos'] },
  { re: /plano de saude|plano de saúde|unimed|amil|bradesco saude/i, categoriaNome: 'Saúde', subLabels: ['Plano de Saúde'] },
  { re: /dentista|odontologia|odontoi/i, categoriaNome: 'Saúde', subLabels: ['Odontologia / Dentista'] },
  { re: /consulta|clinico|clínico|medico\b|médico\b|hospital(?!idade)/i, categoriaNome: 'Saúde', subLabels: ['Consultas Médicas', 'Exames'] },
  { re: /academia|smartfit|musculacao|musculação/i, categoriaNome: 'Saúde', subLabels: ['Academia e Esportes'] },
  { re: /mensalidade.*escola|faculdade|universidade|col[eé]gio|matricula\b|matrícula/i, categoriaNome: 'Educação', subLabels: ['Mensalidade (Escola/Faculdade)'] },
  { re: /curso\b|certificacao|certificação|udemy|alura/i, categoriaNome: 'Educação', subLabels: ['Cursos e Certificações'] },
  { re: /netflix|spotify|prime video|disney\+|hbo|globoplay|assinatura/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Assinaturas (Netflix, Spotify, etc)'] },
  { re: /cinema|show\b|teatro|ingresso.*show/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Cinema, Shows e Teatro'] },
  { re: /bar\b|balada|cervejaria/i, categoriaNome: 'Lazer e Entretenimento', subLabels: ['Bares e Baladas'] },
  { re: /salao|salão|barbearia|cabelo|manicure/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Salão de Beleza / Barbearia'] },
  { re: /roupa|camisa|calca|calça|tenis|tênis|vestuario/i, categoriaNome: 'Cuidados Pessoais', subLabels: ['Vestuário (Roupas do Dia a Dia)', 'Sapatos e Tênis'] },
  { re: /amazon|mercado\s*livre|shopee|shein|aliexpress|magalu|americanas|shopping|loja de departamento/i, categoriaNome: 'Compras e Varejo', subLabels: ['Marketplace (Amazon, Mercado Livre)', 'Compras Online', 'Shopping', 'Loja de Departamento'] },
  { re: /presente(?!.*receb)|lembrancinha|casamento|aniversario|aniversário|natal|amigo oculto/i, categoriaNome: 'Doações e Presentes', subLabels: ['Presentes de Aniversário', 'Natal e Festas Comemorativas', 'Casamentos', 'Presentes Diversos'] },
  { re: /racao|pet\b|dog|gato|veterinar|banho e tosa/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Ração e Alimentação PET', 'Veterinário e Petshop', 'Banho e Tosa'] },
  { re: /fralda|baba\b|babá|creche|bercario|berçário|filho|filha|lanche escolar/i, categoriaNome: 'Pets e Dependentes', subLabels: ['Fraldas e Higiene', 'Babá / Cuidador', 'Creche / Escola Infantil', 'Lanche Escolar'] },
  { re: /passagem|hotel|hospedagem|airbnb|booking/i, categoriaNome: 'Viagens', subLabels: ['Passagens Aéreas / Ônibus', 'Hospedagem / Hotel'] },
  { re: /visto|bagagem|cambio|câmbio|roaming|seguro viagem/i, categoriaNome: 'Viagens', subLabels: ['Visto / Documentação', 'Bagagem Extra', 'Câmbio / Moeda Estrangeira', 'Roaming Internacional', 'Seguro Viagem'] },
  {
    re: /jogo[s]?\s*eletr[ôo]nic|jogos?\s*eletronic|videogame|video[-\s]?game|steam\b|epic\s*games|playstation|ps[45]\b|xbox|nintendo|switch\b|\bdlc\b|jogos?\s*digitais?|jogos?\s*digital|console(s)?\s*(de)?\s*jogo|riot\s*games|battle\.net|gog\.com|humble\s*bundle|microtransa[cç][aã]o|loot\s*box/i,
    categoriaNome: 'Tecnologia e Gadgets',
    subLabels: ['Jogos Digitais / Consoles'],
  },
  { re: /chatgpt|claude|cursor|midjourney|canva|notion|office|adobe|software|saas|dominio|domínio|hospedagem/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['IA / Ferramentas de Produtividade', 'Assinatura de Softwares (Office, Adobe)', 'Hospedagem / Domínios'] },
  { re: /notebook|celular novo|iphone|galaxy|computador|monitor\b|tecnologia|smartwatch|wearable|periferico|periférico/i, categoriaNome: 'Tecnologia e Gadgets', subLabels: ['Computadores e Periféricos', 'Celular Novo e Acessórios', 'Smartwatch e Wearables'] },
  { re: /telefone|plano.*celular|nuvem|icloud|google drive|dropbox|antivirus|antivírus|correios|entrega|diarista|faxina|advogado/i, categoriaNome: 'Serviços e Assinaturas', subLabels: ['Telefone / Celular', 'Armazenamento em Nuvem', 'Antivírus / Segurança Digital', 'Correios e Entregas', 'Diarista / Faxina', 'Advogado / Serviços Jurídicos'] },
  { re: /coworking|trafego pago|tráfego pago|anuncio|anúncio|marketing|branding|frete.*venda|taxa.*plataforma|equipamento profissional/i, categoriaNome: 'Trabalho e Negócios', subLabels: ['Coworking', 'Tráfego Pago', 'Marketing e Anúncios', 'Design e Branding', 'Fretes de Venda', 'Taxas de Plataforma', 'Equipamentos Profissionais'] },
  { re: /aluguel(?!.*receb)/i, categoriaNome: 'Moradia', subLabels: ['Aluguel'] },
  { re: /condominio|condomínio/i, categoriaNome: 'Moradia', subLabels: ['Condomínio'] },
  { re: /luz\b|energia eletrica|energia elétrica|celesc|copel|enel/i, categoriaNome: 'Moradia', subLabels: ['Conta de Luz'] },
  { re: /agua\b|água\b|sanepar|cedae/i, categoriaNome: 'Moradia', subLabels: ['Conta de Água'] },
  { re: /internet\b|fibra|wifi|vivo fibra|net\b claro|oi fibra/i, categoriaNome: 'Moradia', subLabels: ['Internet e TV'] },
  { re: /\bgas\b|glp|botijao|botijão/i, categoriaNome: 'Moradia', subLabels: ['Gás'] },
  { re: /iptu\b/i, categoriaNome: 'Moradia', subLabels: ['IPTU'] },
  { re: /passaporte|cartorio|cartório|certidao|certidão|cnh|das\b|mei\b|simples nacional|imposto de renda.*pag/i, categoriaNome: 'Documentações e Impostos', subLabels: ['Emissão de Passaporte', 'Cartório e Certidões', 'Renovação CNH / Multas', 'MEI / DAS', 'Simples Nacional', 'Imposto de Renda (Pagamento)'] },
  { re: /aporte|investi|tesouro|cdb|acao|ação|fii|fiis|cripto|bitcoin|previdencia privada|previdência privada/i, categoriaNome: 'Investimentos e Patrimônio', subLabels: ['Aporte em Investimentos', 'Tesouro Direto', 'CDB / Renda Fixa', 'Compra de Ações / FIIs', 'Criptomoedas', 'Previdência Privada'] },
  { re: /fatura|cartao|cartão|anuidade|ted|pix.*tarifa|tarifa banc/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Pagamento de Fatura (Não Categorizado)', 'Taxas e Tarifas Bancárias', 'Juros Cartão de Crédito'] },
  { re: /emprestimo|empréstimo|financiamento(?!.*veic)/i, categoriaNome: 'Despesas Financeiras', subLabels: ['Parcela de Empréstimo'] },
]

export const RECEITA_RULES = [
  { re: /salario|salário|folha|clt|holerite/i, categoriaNome: 'Renda Principal', subLabels: ['Salário'] },
  { re: /ferias|férias/i, categoriaNome: 'Renda Principal', subLabels: ['Férias'] },
  { re: /13o|13º|decimo terceiro|décimo terceiro/i, categoriaNome: 'Renda Principal', subLabels: ['13º Salário'] },
  { re: /plr|bonus|bônus|gratificacao|gratificação/i, categoriaNome: 'Renda Principal', subLabels: ['PLR / Bônus'] },
  { re: /inss|aposentadoria|aposent\b|bpc\b/i, categoriaNome: 'Renda Principal', subLabels: ['Aposentadoria / INSS', 'BPC'] },
  { re: /pro.?labore|prolabore|pró-labore/i, categoriaNome: 'Rendas PJ / Empresa', subLabels: ['Pró-labore', 'Distribuição de Lucros'] },
  { re: /freelance|freela|pj\b|honorario|honorário|servico extra|serviço extra/i, categoriaNome: 'Renda Extra', subLabels: ['Freelance / Serviços Extras'] },
  { re: /venda\b|comiss[aã]o|comission/i, categoriaNome: 'Renda Extra', subLabels: ['Vendas e Comissionamentos', 'Venda de Bens/Ativos Usados'] },
  { re: /aluguel.*receb|rendimento.*aluguel/i, categoriaNome: 'Renda Extra', subLabels: ['Aluguéis Recebidos'] },
  { re: /restituicao|restituição|imposto.*restit/i, categoriaNome: 'Renda Extra', subLabels: ['Restituição de Imposto'] },
  { re: /dividend|fii|fiis|acao|ação|cdb|tesouro|juros.*receb|rendimento.*invest/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['Dividendos (Ações e FIIs)', 'Rendimento de Investimentos', 'Juros Recebidos'] },
  { re: /fgts|seguro.desemprego|abono|auxilio|auxílio|mesada recebida/i, categoriaNome: 'Rendimentos e Benefícios', subLabels: ['FGTS', 'Seguro-Desemprego', 'Abono Salarial', 'Auxílios Governamentais', 'Mesada Recebida'] },
  { re: /presente.*receb|premio|prêmio|sorteio|heranca|herança|indenizacao|indenização|seguro.*receb|estorno|devolucao|devolução|vaquinha.*receb|ajuda.*familiar/i, categoriaNome: 'Receitas Eventuais', subLabels: ['Presente Recebido', 'Sorteio / Prêmio', 'Herança', 'Indenização', 'Seguro Recebido', 'Devolução / Estorno', 'Vaquinha Recebida', 'Ajuda Familiar Recebida'] },
]

export function rulesForTipo(tipo) {
  return tipo === 'RECEITA' ? RECEITA_RULES : DESPESA_RULES
}

/**
 * Se a IA deixou categoria/subcategoria vazias, tenta casar palavras da mensagem com nomes reais do usuário.
 */
export function enriquecerCategoriaPorTexto(message, extractedData, categoriasUsuario) {
  if (!extractedData || !categoriasUsuario?.length) return extractedData

  const tipo = extractedData.tipo
  if (tipo !== 'DESPESA' && tipo !== 'RECEITA') return extractedData

  const low = normTxt(message)
  const catsTipo = categoriasUsuario.filter((c) => c.tipo === tipo)

  if (extractedData.categoria_id && !extractedData.subcategoria_id) {
    const cat = categoriasUsuario.find((c) => c.id === extractedData.categoria_id && c.tipo === tipo)
    if (cat?.subcategorias?.length) {
      for (const rule of rulesForTipo(tipo)) {
        if (!rule.categoriaNome || !rule.subLabels?.length) continue
        if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
        if (!rule.re.test(low)) continue
        if (findCategoryBySeedNome(catsTipo, rule.categoriaNome)?.id !== cat.id) continue
        const sub = findSubPreferida(cat, rule.subLabels)
        if (sub) {
          extractedData.subcategoria_id = sub.id
          return extractedData
        }
      }
    }
  }

  if (extractedData.categoria_id && extractedData.subcategoria_id) return extractedData

  for (const rule of rulesForTipo(tipo)) {
    if (!rule.categoriaNome || !rule.subLabels?.length) continue
    if (!SEED_CAT_NOMES.has(rule.categoriaNome)) continue
    if (!rule.re.test(low)) continue
    const cat = findCategoryBySeedNome(catsTipo, rule.categoriaNome)
    if (!cat) continue
    const sub = findSubPreferida(cat, rule.subLabels)
    if (sub) {
      extractedData.categoria_id = cat.id
      extractedData.subcategoria_id = sub.id
      return extractedData
    }
  }

  return extractedData
}

export function inferTipoBasicoFromTexto(message) {
  const m = normTxt(message)
  if (/(recebi|ganhei|entrou|caiu na conta|salario|salário|deposito|dep[oó]sito|pix recebido)/.test(m)) {
    return 'RECEITA'
  }
  if (/(gastei|paguei|pago|pagando|comprei|enviei pix|fiz um pix|transferi|debito|d[eé]bito|saquei)/.test(m)) {
    return 'DESPESA'
  }
  if (/(gasto|conta|boleto|fatura|aluguel|iptu|luz|agua|água|gas|gás)/.test(m)) {
    return 'DESPESA'
  }
  return null
}

export function extrairValorBasicoFromTexto(message) {
  const m = message.match(/(\d+(?:[.,]\d+)?)/)
  if (!m) return null
  let raw = m[1].trim()
  if (raw.includes(',') && !raw.includes('.')) {
    raw = raw.replace(',', '.')
  } else if (raw.includes('.') && raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  }
  const val = parseFloat(raw)
  if (!isFinite(val) || val <= 0) return null
  return val
}

/**
 * Fallback local quando nem o JSON da IA vem parseável.
 */
export function fallbackParseMensagemSimples(message) {
  const tipo = inferTipoBasicoFromTexto(message)
  const valor = extrairValorBasicoFromTexto(message)
  if (!tipo || !valor) return null
  return {
    tipo,
    valor,
    descricao: message,
    categoria_id: null,
    subcategoria_id: null,
  }
}
