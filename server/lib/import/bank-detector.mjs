/**
 * Mapa de bancos brasileiros: COMPE (3 dígitos) → metadados.
 * cor: cor primária da marca. corTexto: cor do texto sobre o badge.
 */
export const BANK_MAP = {
  '001': { nome: 'Banco do Brasil', sigla: 'BB',  cor: '#FFCD00', corTexto: '#003399' },
  '033': { nome: 'Santander',        sigla: 'SAN', cor: '#EC0000', corTexto: '#fff'    },
  '036': { nome: 'Bradesco',         sigla: 'BRA', cor: '#CC0000', corTexto: '#fff'    },
  '041': { nome: 'Banrisul',         sigla: 'BRS', cor: '#003E8A', corTexto: '#fff'    },
  '077': { nome: 'Banco Inter',      sigla: 'INT', cor: '#FF7A00', corTexto: '#fff'    },
  '085': { nome: 'Ailos',            sigla: 'AIL', cor: '#006736', corTexto: '#fff'    },
  '104': { nome: 'Caixa Econômica',  sigla: 'CEF', cor: '#005CA9', corTexto: '#fff'    },
  '197': { nome: 'Stone',            sigla: 'STN', cor: '#00C98D', corTexto: '#fff'    },
  '208': { nome: 'BTG Pactual',      sigla: 'BTG', cor: '#1A1A2E', corTexto: '#fff'    },
  '212': { nome: 'Banco Original',   sigla: 'ORI', cor: '#00994C', corTexto: '#fff'    },
  '237': { nome: 'Bradesco',         sigla: 'BRA', cor: '#CC0000', corTexto: '#fff'    },
  '260': { nome: 'Nubank',           sigla: 'NU',  cor: '#8A05BE', corTexto: '#fff'    },
  '290': { nome: 'PagBank',          sigla: 'PAG', cor: '#05C456', corTexto: '#fff'    },
  '323': { nome: 'Mercado Pago',     sigla: 'MP',  cor: '#009EE3', corTexto: '#fff'    },
  '336': { nome: 'C6 Bank',          sigla: 'C6',  cor: '#242424', corTexto: '#fff'    },
  '341': { nome: 'Itaú',             sigla: 'ITÁ', cor: '#EC7000', corTexto: '#fff'    },
  '380': { nome: 'PicPay',           sigla: 'PIC', cor: '#21C25E', corTexto: '#fff'    },
  '422': { nome: 'Safra',            sigla: 'SAF', cor: '#00205B', corTexto: '#fff'    },
  '633': { nome: 'Banco Rendimento', sigla: 'RND', cor: '#004B8D', corTexto: '#fff'    },
  '655': { nome: 'Neon',             sigla: 'NEO', cor: '#00BFAE', corTexto: '#fff'    },
  '735': { nome: 'Neon',             sigla: 'NEO', cor: '#00BFAE', corTexto: '#fff'    },
  '748': { nome: 'Sicoob',           sigla: 'SCB', cor: '#006400', corTexto: '#fff'    },
  '756': { nome: 'Sicredi',          sigla: 'SCR', cor: '#009900', corTexto: '#fff'    },
  '818': { nome: 'Sofisa',           sigla: 'SOF', cor: '#E8000D', corTexto: '#fff'    },
}

/** Padrões de texto para detectar banco por nome — ordem importa (mais específico primeiro). */
const NAME_PATTERNS = [
  [/nubank|nu\s*pagamentos|nu\s*bank/i,        '260'],
  [/ita[úu]\s*(unibanco)?/i,                   '341'],
  [/bradesco/i,                                 '237'],
  [/banco\s*do\s*brasil|bando\s*brasil/i,       '001'],
  [/caixa\s*(econ[oô]mica)?(\s*federal)?/i,    '104'],
  [/santander/i,                                '033'],
  [/inter(\s*bank)?/i,                          '077'],
  [/c6\s*bank/i,                                '336'],
  [/btg\s*(pactual)?/i,                         '208'],
  [/original/i,                                 '212'],
  [/stone/i,                                    '197'],
  [/pagbank|pag\s*seguro/i,                     '290'],
  [/mercado\s*pago/i,                           '323'],
  [/picpay/i,                                   '380'],
  [/neon/i,                                     '655'],
  [/banrisul/i,                                 '041'],
  [/sicoob/i,                                   '748'],
  [/sicredi/i,                                  '756'],
  [/safra/i,                                    '422'],
]

/** Detecta banco a partir de um nome em texto livre. */
export function detectBankByName(name) {
  if (!name) return null
  const s = String(name).trim()
  for (const [re, code] of NAME_PATTERNS) {
    if (re.test(s)) return BANK_MAP[code] ? { ...BANK_MAP[code], compe: code } : null
  }
  return null
}

/** Detecta banco a partir de um código COMPE (3 dígitos) ou ISPB (8 dígitos). */
export function detectBankByCode(code) {
  const s = String(code || '').replace(/\D/g, '')
  if (s.length === 3) return BANK_MAP[s] ? { ...BANK_MAP[s], compe: s } : null
  // ISPB: mapear os mais comuns
  const ISPB_TO_COMPE = {
    '00000000': '001', // BB
    '90400888': '033', // Santander
    '60746948': '237', // Bradesco
    '00360305': '104', // Caixa
    '60701190': '341', // Itaú
    '18236120': '260', // Nubank
    '00416968': '077', // Inter
    '31872495': '336', // C6
  }
  const compe = ISPB_TO_COMPE[s.padStart(8, '0')]
  return compe && BANK_MAP[compe] ? { ...BANK_MAP[compe], compe } : null
}

/** Extrai informação de banco do texto OFX (SGML ou XML). */
export function detectBankFromOfxText(text) {
  const get = (tag) => {
    const m = new RegExp(`<${tag}>([^\\n\\r<]+)`, 'i').exec(text)
    return m ? m[1].trim() : ''
  }

  // Prioridade: COMPE/FID → ISPB/BANKID → nome da org
  const fid    = get('FID')
  const bankId = get('BANKID')
  const org    = get('ORG')

  if (fid)    { const b = detectBankByCode(fid);    if (b) return b }
  if (bankId) { const b = detectBankByCode(bankId); if (b) return b }
  if (org)    { const b = detectBankByName(org);    if (b) return b }

  return null
}
