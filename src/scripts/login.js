import { getSupabaseErrorMessage, parseSupabaseResponse, supabaseKey, supabaseUrl } from '../lib/supabase'

const formulario = document.getElementById('loginForm')
const mensagem = document.getElementById('mensagem')
const toggleSenha = document.getElementById('toggleSenha')
const inputSenha = document.getElementById('senha')

toggleSenha.addEventListener('click', () => {
  const type = inputSenha.type === 'password' ? 'text' : 'password'
  inputSenha.type = type
  
  toggleSenha.querySelector('.eye-icon').classList.toggle('hidden')
  toggleSenha.querySelector('.eye-off-icon').classList.toggle('hidden')
})

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

formulario.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const email = document.getElementById('email').value
  const senha = inputSenha.value

  if (!validateEmail(email)) {
    mostrarMensagem('E-mail inválido', 'erro')
    return
  }

  if (!senha) {
    mostrarMensagem('Preencha a senha', 'erro')
    return
  }

  const btn = formulario.querySelector('.btn-entrar')
  btn.disabled = true
  btn.textContent = 'Entrando...'
  mostrarMensagem('', '')

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&senha=eq.${encodeURIComponent(senha)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    const data = await parseSupabaseResponse(response)

    if (!response.ok) {
      mostrarMensagem('Erro ao fazer login: ' + getSupabaseErrorMessage(data), 'erro')
      btn.disabled = false
      btn.textContent = 'Entrar'
      return
    }

    if (data.length === 0) {
      mostrarMensagem('E-mail ou senha incorretos', 'erro')
      btn.disabled = false
      btn.textContent = 'Entrar'
      return
    }

    mostrarMensagem('Login realizado com sucesso!', 'sucesso')
    btn.disabled = false
    btn.textContent = 'Entrar'
    setTimeout(() => {
      window.location.href = '/dashboard'
    }, 2000)
  } catch (err) {
    mostrarMensagem('Erro ao conectar com o banco', 'erro')
    btn.disabled = false
    btn.textContent = 'Entrar'
  }
})

function mostrarMensagem(texto, tipo) {
  if (!texto) {
    mensagem.style.display = 'none'
    return
  }
  mensagem.textContent = texto
  mensagem.className = 'mensagem ' + tipo
}
