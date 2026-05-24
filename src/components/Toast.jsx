import React, { useEffect, useState } from 'react'

import { registerToastFn, unregisterToastFn } from '../lib/toastStore'

export default function ToastContainer() {
  const [toast, setToast] = useState(null)

  useEffect(() => {
    registerToastFn((message, type) => {
      setToast({ message, type, id: Date.now() })
    })
    return () => unregisterToastFn()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])

  if (!toast) return null

  const isError = toast.type === 'error'
  const isSuccess = toast.type === 'success'

  return (
    <div className="fixed bottom-6 right-4 z-[9999] pointer-events-none sm:right-6" role="alert" aria-live="assertive" aria-atomic="true">
      <div className={`hz-toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border${isSuccess ? ' bg-[#0f2e1a] border-success/50 text-success' : ''}${isError ? ' bg-[#2e0f0f] border-red-500/60 text-red-300' : ''}${!isSuccess && !isError ? ' bg-neutral-900 border-white/20 text-white' : ''}`}>
        {isSuccess && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {isError && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
        <span className="text-sm font-semibold tracking-tight">{toast.message}</span>
      </div>
    </div>
  )
}
