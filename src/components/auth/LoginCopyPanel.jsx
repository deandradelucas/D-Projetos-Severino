/**
 * Coluna de copy do login (desktop ≥1024px).
 */

const BENEFITS = [
  {
    title: 'Finanças no mesmo painel',
    text: 'Gastos, categorias e visão do mês sem planilha paralela.',
  },
  {
    title: 'Agenda ligada ao bolso',
    text: 'Compromissos e lembretes ao lado do que você pode gastar.',
  },
  {
    title: 'Automação no WhatsApp',
    text: 'Lance gastos por mensagem, receba lembretes e fale com o assistente no celular.',
    whatsapp: true,
  },
  {
    title: 'Severino IA com seus dados',
    text: 'Pergunte e decida com respostas baseadas no que você registrou.',
  },
]

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="auth-login-copy__svg" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414L9 11.586l6.52-6.52a1 1 0 0 1 1.414 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="auth-login-copy__svg" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 3.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  )
}

export default function LoginCopyPanel() {
  return (
    <div className="auth-login-copy">
      <h2 className="auth-login-copy__headline">
        Veja para onde vai cada real —{' '}
        <span className="auth-login-copy__headline-accent">antes do mês acabar</span>.
      </h2>

      <p className="auth-login-copy__lead">
        Planilhas que não fecham. Lembretes soltos. Contas que só aparecem quando o boleto vence.
      </p>

      <p className="auth-login-copy__solution">
        O <strong>Severino</strong> une finanças, agenda, WhatsApp e assistente com os seus dados reais.
      </p>

      <ul className="auth-login-copy__benefits" aria-label="Benefícios do Severino">
        {BENEFITS.map((item, index) => (
          <li
            key={item.title}
            className={`auth-login-copy__benefit${item.whatsapp ? ' auth-login-copy__benefit--whatsapp' : ''}`}
            style={{ '--benefit-i': index }}
          >
            <span className={`auth-login-copy__icon${item.whatsapp ? ' auth-login-copy__icon--whatsapp' : ''}`}>
              {item.whatsapp ? <WhatsAppIcon /> : <CheckIcon />}
            </span>
            <span className="auth-login-copy__benefit-body">
              <span className="auth-login-copy__benefit-title">{item.title}</span>
              <span className="auth-login-copy__benefit-text">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="auth-login-copy__proof">
        Clareza no bolso e na rotina — sem virar especialista em planilha.
      </p>

      <p className="auth-login-copy__cta-hint">Entre na sua conta e retome o controle em minutos.</p>
    </div>
  )
}
