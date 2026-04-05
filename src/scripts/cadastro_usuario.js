import { getSupabaseErrorMessage, parseSupabaseResponse, supabaseKey, supabaseUrl } from '../lib/supabase'

const formulario = document.getElementById('cadastroForm')
const mensagem = document.getElementById('mensagem')

formulario.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const nome = document.getElementById('nome').value
  const email = document.getElementById('email').value
  const senha = document.getElementById('senha').value
  const confirmarSenha = document.getElementById('confirmarSenha').value

  if (senha !== confirmarSenha) {
    mostrarMensagem('As senhas não coincidem', 'erro')
    return
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ nome, email, senha })
    })

    const data = await parseSupabaseResponse(response)

    if (!response.ok) {
      mostrarMensagem('Erro ao cadastrar: ' + getSupabaseErrorMessage(data), 'erro')
      return
    }

    mostrarMensagem('Cadastro realizado com sucesso!', 'sucesso')
    formulario.reset()
    setTimeout(() => {
      window.location.href = 'login.html'
    }, 2000)
  } catch (err) {
    mostrarMensagem('Erro ao conectar com o banco', 'erro')
  }
})

function mostrarMensagem(texto, tipo) {
  mensagem.textContent = texto
  mensagem.className = 'mensagem ' + tipo
}
