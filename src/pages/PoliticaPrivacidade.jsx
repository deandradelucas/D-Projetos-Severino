import LegalDocLayout from '../components/LegalDocLayout'

/* AÇÃO DO CEO: substituir o controlador pelos dados reais (razão social + CNPJ ou nome/CPF). */
const CONTROLADOR = '[CONTROLADOR — preencher: razão social e CNPJ, ou nome completo e CPF do responsável]'
const DPO_EMAIL = 'privacidade@mestredamente.com'
const VERSAO = '2026-06-03'

export default function PoliticaPrivacidade() {
  return (
    <LegalDocLayout titulo="Política de Privacidade" versao={VERSAO} atualizadoEm="3 de junho de 2026">
      <p>
        Esta Política de Privacidade descreve como o <strong>Severino</strong> coleta, usa, armazena e
        protege os seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº
        13.709/2018 — LGPD). Ao criar uma conta e usar o Severino, você declara estar ciente desta Política.
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        O controlador dos dados é {CONTROLADOR}. Para qualquer assunto relacionado aos seus dados pessoais,
        o canal de contato (Encarregado/DPO) é <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>.
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome, e-mail e telefone (WhatsApp).</li>
        <li><strong>Dados financeiros que você registra:</strong> transações, contas, cartões, metas,
          investimentos, listas e compromissos da agenda.</li>
        <li><strong>Pagamento de assinatura:</strong> ao assinar, o CPF e dados de cobrança são tratados
          pelo nosso processador de pagamentos (Asaas) para emitir cobranças e Pix.</li>
        <li><strong>Interações por WhatsApp:</strong> mensagens e áudios enviados ao assistente são
          processados para registrar transações e compromissos; áudios podem ser transcritos.</li>
        <li><strong>Dados técnicos:</strong> endereço IP e registros de acesso, para segurança e prevenção
          a fraudes.</li>
      </ul>

      <h2>3. Para que usamos seus dados (finalidades)</h2>
      <ul>
        <li>Fornecer e operar o aplicativo (registro e visualização das suas finanças e agenda).</li>
        <li>Processar a assinatura e os pagamentos.</li>
        <li>Enviar avisos essenciais (verificação de cadastro, lembretes, cobrança, suporte).</li>
        <li>Garantir a segurança das contas e melhorar o serviço.</li>
      </ul>

      <h2>4. Base legal</h2>
      <p>
        Tratamos seus dados com base no seu <strong>consentimento</strong> (coletado no cadastro) e na
        <strong> execução do contrato</strong> de prestação do serviço, além do cumprimento de obrigações
        legais e regulatórias (ex.: retenção fiscal de registros de pagamento).
      </p>

      <h2>5. Compartilhamento com terceiros</h2>
      <p>Compartilhamos dados apenas com operadores necessários para o funcionamento do serviço:</p>
      <ul>
        <li><strong>Supabase</strong> — hospedagem do banco de dados.</li>
        <li><strong>Asaas</strong> — processamento de pagamentos e assinaturas.</li>
        <li><strong>Google (Gemini)</strong> — interpretação de mensagens/áudios por IA.</li>
        <li><strong>Provedor de WhatsApp</strong> — envio e recebimento de mensagens.</li>
      </ul>
      <p>Não vendemos seus dados pessoais a terceiros.</p>

      <h2>6. Retenção e exclusão</h2>
      <p>
        Mantemos seus dados enquanto sua conta estiver ativa. Ao solicitar a exclusão da conta (dentro do
        app, em Configurações), sua conta é desativada imediatamente e os seus dados pessoais são
        <strong> apagados definitivamente após 30 dias</strong> (período de carência para evitar exclusão
        acidental). Registros de pagamento são <strong>anonimizados e retidos</strong> pelo prazo exigido
        pela legislação fiscal.
      </p>

      <h2>7. Seus direitos como titular</h2>
      <p>A LGPD garante a você, a qualquer momento, o direito de:</p>
      <ul>
        <li>Confirmar a existência de tratamento e <strong>acessar</strong> seus dados.</li>
        <li><strong>Exportar</strong> seus dados (portabilidade) — disponível em Configurações.</li>
        <li>Corrigir dados incompletos ou desatualizados.</li>
        <li><strong>Excluir</strong> sua conta e seus dados — disponível em Configurações.</li>
        <li>Revogar o consentimento.</li>
      </ul>
      <p>
        Para exercer qualquer direito, use as opções no app ou escreva para{' '}
        <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Adotamos medidas técnicas para proteger seus dados: senhas armazenadas com hash (bcrypt),
        comunicação criptografada (HTTPS), controle de acesso ao banco de dados (Row Level Security) e
        tokens de sessão com expiração curta. Nenhum sistema é 100% imune, mas trabalhamos continuamente
        para reduzir riscos.
      </p>

      <h2>9. Alterações nesta Política</h2>
      <p>
        Podemos atualizar esta Política periodicamente. A versão vigente é sempre identificada pela data no
        topo desta página. Mudanças relevantes serão comunicadas pelos canais do app.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre privacidade e proteção de dados:{' '}
        <a href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</a>.
      </p>
    </LegalDocLayout>
  )
}
