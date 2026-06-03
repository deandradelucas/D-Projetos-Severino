import LegalDocLayout from '../components/LegalDocLayout'

const CONTROLADOR = '[CONTROLADOR — preencher: razão social e CNPJ, ou nome completo e CPF do responsável]'
const CONTATO_EMAIL = 'privacidade@mestredamente.com'
const VERSAO = '2026-06-03'

export default function TermosUso() {
  return (
    <LegalDocLayout titulo="Termos de Uso" versao={VERSAO} atualizadoEm="3 de junho de 2026">
      <p>
        Estes Termos de Uso regulam o acesso e a utilização do <strong>Severino</strong>, aplicativo de
        organização de finanças pessoais e agenda. Ao criar uma conta, você concorda com estes Termos.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O Severino é uma ferramenta para registrar e visualizar finanças pessoais, metas, investimentos e
        compromissos, incluindo um assistente por WhatsApp. O serviço é fornecido por {CONTROLADOR}.
      </p>

      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>Você deve fornecer informações verdadeiras e manter seus dados atualizados.</li>
        <li>Você é responsável por manter a confidencialidade da sua senha e pelo uso da sua conta.</li>
        <li>É necessário ter pelo menos 18 anos ou autorização do responsável legal.</li>
      </ul>

      <h2>3. Uso aceitável</h2>
      <p>Você concorda em não:</p>
      <ul>
        <li>Usar o serviço para fins ilícitos ou que violem direitos de terceiros.</li>
        <li>Tentar acessar contas ou dados de outros usuários.</li>
        <li>Comprometer a segurança, a integridade ou a disponibilidade do sistema.</li>
      </ul>

      <h2>4. Assinatura e pagamento</h2>
      <p>
        O Severino pode oferecer um período de teste e planos pagos. As cobranças são processadas pela
        Asaas. O cancelamento da assinatura pode ser feito a qualquer momento e interrompe as cobranças
        futuras, conforme as condições do plano contratado.
      </p>

      <h2>5. Não é consultoria financeira</h2>
      <p>
        O Severino é uma ferramenta de organização e não constitui aconselhamento financeiro, contábil ou
        de investimentos. As decisões tomadas com base nas informações do app são de sua responsabilidade.
      </p>

      <h2>6. Propriedade intelectual</h2>
      <p>
        A marca, o software, o design e os conteúdos do Severino são protegidos e pertencem ao seu titular.
        Seus dados pessoais e financeiros permanecem seus — apenas os tratamos conforme a Política de
        Privacidade.
      </p>

      <h2>7. Limitação de responsabilidade</h2>
      <p>
        O serviço é fornecido "como está". Empregamos esforços para mantê-lo disponível e correto, mas não
        garantimos ausência de falhas ou interrupções. Não nos responsabilizamos por perdas decorrentes de
        uso indevido ou de fatores fora do nosso controle razoável.
      </p>

      <h2>8. Encerramento e exclusão</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento em Configurações. Após a solicitação, seus dados
        pessoais são apagados definitivamente em até 30 dias, conforme a Política de Privacidade.
      </p>

      <h2>9. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do
        domicílio do consumidor para dirimir eventuais controvérsias.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre estes Termos: <a href={`mailto:${CONTATO_EMAIL}`}>{CONTATO_EMAIL}</a>.
      </p>
    </LegalDocLayout>
  )
}
