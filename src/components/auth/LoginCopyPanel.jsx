/**
 * Coluna de copy do login (desktop 50% | mobile compacto no topo).
 * Estrutura PAS: problema → agitação → solução + benefícios tangíveis.
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
    title: 'Severino IA com seus dados',
    text: 'Pergunte, planeje e decida com respostas baseadas no que você registrou.',
  },
]

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414L9 11.586l6.52-6.52a1 1 0 0 1 1.414 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function LoginCopyPanel() {
  return (
    <div className="auth-login-copy flex h-full flex-col justify-center">
      <p className="auth-login-copy__eyebrow">Horizonte Financeiro</p>

      <h2 className="auth-login-copy__headline">
        Veja para onde vai cada real — <span className="auth-login-copy__headline-accent">antes do mês acabar</span>.
      </h2>

      <p className="auth-login-copy__lead">
        Planilhas que não fecham. Lembretes soltos. Contas que só aparecem quando o boleto vence.
      </p>

      <p className="auth-login-copy__solution">
        O <strong>Severino</strong> reúne finanças, agenda e um assistente que responde com os seus dados — não com
        chute.
      </p>

      <ul className="auth-login-copy__benefits" aria-label="Benefícios do Severino">
        {BENEFITS.map((item) => (
          <li key={item.title} className="auth-login-copy__benefit">
            <span className="auth-login-copy__check">
              <CheckIcon />
            </span>
            <span>
              <span className="auth-login-copy__benefit-title">{item.title}</span>
              <span className="auth-login-copy__benefit-text">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="auth-login-copy__proof">
        Feito para quem quer clareza no bolso e na rotina — sem virar especialista em planilha.
      </p>

      <p className="auth-login-copy__cta-hint">Entre na sua conta e retome o controle em minutos.</p>
    </div>
  )
}
