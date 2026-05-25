/**
 * Mensagem de convite conta familiar + instruções PWA (WhatsApp, e-mail, etc.).
 */

/** Bloco reutilizável: como instalar o Severino como app (PWA). */
function paragrafoInstrucoesPwaSeverino() {
  return [
    '📱 Instalar o app Severino (PWA) no celular',
    '',
    '• Android (Chrome ou Edge): abra o link do convite no navegador. Toque no menu ⋮ → "Instalar app" ou "Adicionar à tela inicial".',
    '',
    '• iPhone ou iPad: abra o link no Safari. Toque em Compartilhar → "Adicionar à Tela de Início". (No iOS, use o Safari para melhor resultado.)',
    '',
    '• Computador (Chrome ou Edge): procure o ícone de instalação na barra de endereço ou no menu do navegador.',
  ].join('\n')
}

/**
 * Texto completo para colar no WhatsApp ou e-mail.
 * @param {{ baseUrl: string, token: string, titularNome?: string | null }} p
 */
export function montarTextoConviteFamiliaComPwa(p) {
  const token = String(p.token || '').trim()
  if (!token) return ''

  const origin = String(p.baseUrl || '').replace(/\/$/, '')
  const link = `${origin}/login?convite=${encodeURIComponent(token)}`
  const quem = String(p.titularNome || '').trim()
  const abertura = quem
    ? `Olá! ${quem} convidou você para participar da conta familiar no Severino.`
    : 'Olá! Você recebeu um convite para participar de uma conta familiar no Severino.'

  return [
    abertura,
    '',
    '— Link do convite —',
    link,
    '',
    '— Código (se preferir colar só isso) —',
    token,
    '',
    paragrafoInstrucoesPwaSeverino(),
    '',
    '— Depois de instalar o app ou no navegador —',
    '1) Crie sua conta ou faça login.',
    '2) Se já tiver conta: menu Ajustes → Código de convite familiar → cole o link ou o código → Vincular à esta conta.',
    '',
    'Se o convite expirar, peça um novo ao titular.',
  ].join('\n')
}
