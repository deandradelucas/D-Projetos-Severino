import { useState, useEffect, useCallback } from 'react'
import { apiUrl } from '../lib/apiUrl'
import { apiFetch } from '../lib/apiFetch'
import { horizonteApiAuthHeaders } from '../lib/apiAuthHeaders'
import { webAuthnSupported, registerWebAuthnCredential } from '../lib/webauthnBrowser'

export function useConfigWebAuthn({ usuarioIdHeader, showToast }) {
  const [webauthnList, setWebauthnList] = useState([])
  const [webauthnLoading, setWebauthnLoading] = useState(false)
  const [webauthnError, setWebauthnError] = useState(null)
  const [bioRegistering, setBioRegistering] = useState(false)
  const [confirmBiometricRemoval, setConfirmBiometricRemoval] = useState(null)

  const loadWebAuthn = useCallback(async () => {
    if (!usuarioIdHeader) return
    setWebauthnLoading(true)
    setWebauthnError(null)
    try {
      const res = await apiFetch(apiUrl('/api/auth/webauthn/credentials'), {
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWebauthnList([])
        setWebauthnError(data.message || `Não foi possível carregar (${res.status}).`)
        return
      }
      setWebauthnList(Array.isArray(data.credentials) ? data.credentials : [])
    } catch {
      setWebauthnList([])
      setWebauthnError('Erro de rede ao carregar a biometria.')
    } finally {
      setWebauthnLoading(false)
    }
  }, [usuarioIdHeader])

  useEffect(() => {
    loadWebAuthn()
  }, [loadWebAuthn])

  const handleRegisterBiometric = async () => {
    if (!usuarioIdHeader) return
    if (!webAuthnSupported()) {
      showToast('Biometria requer HTTPS (ou localhost) e navegador compatível.')
      return
    }
    setBioRegistering(true)
    try {
      await registerWebAuthnCredential(() => horizonteApiAuthHeaders())
      showToast('Biometria ativada neste aparelho.')
      await loadWebAuthn()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível ativar a biometria.')
    } finally {
      setBioRegistering(false)
    }
  }

  const handleRemoveBiometric = async (credentialRowId) => {
    if (!usuarioIdHeader) return
    try {
      const res = await apiFetch(apiUrl(`/api/auth/webauthn/credentials/${credentialRowId}`), {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Erro ao remover.')
      }
      showToast('Biometria removida.')
      await loadWebAuthn()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao remover.')
    }
  }

  return {
    webauthnList,
    webauthnLoading,
    webauthnError,
    bioRegistering,
    confirmBiometricRemoval,
    setConfirmBiometricRemoval,
    handleRegisterBiometric,
    handleRemoveBiometric,
    loadWebAuthn,
  }
}
