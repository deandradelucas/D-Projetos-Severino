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

function ArrowRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="auth-login-copy__arrow-svg" aria-hidden>
      <path
        fillRule="evenodd"
        d="M3 10a.75.75 0 0 1 .75-.75h10.638L11.23 6.29a.75.75 0 1 1 1.06-1.06l4.5 4.25a.75.75 0 0 1 0 1.06l-4.5 4.25a.75.75 0 0 1-1.06-1.06l2.158-2.959H3.75A.75.75 0 0 1 3 10Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 448 512"
      fill="currentColor"
      className="auth-login-copy__svg auth-login-copy__svg--whatsapp"
      aria-hidden
    >
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l140.9-37.4c32.4 17.7 68.9 27 106.1 27h.1c122.4 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.1c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.7-32.8-16.2-37.9-18-5.1-1.9-8.8-2.7-12.5 2.7-3.7 5.5-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.7-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
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
            <span className="auth-login-copy__arrow" aria-hidden>
              <ArrowRightIcon />
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
