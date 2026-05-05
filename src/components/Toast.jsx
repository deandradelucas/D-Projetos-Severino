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
    <div className="fixed bottom-6 right-4 z-[9999] pointer-events-none sm:right-6">
      <div className={`hz-toast-enter flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md${isSuccess ? ' bg-success/10 border-success/30 text-success' : ''}${isError ? ' bg-error/10 border-error/30 text-error' : ''}${!isSuccess && !isError ? ' bg-white/10 border-white/20 text-white' : ''}`}>
        {isSuccess && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        <span className="text-sm font-semibold tracking-tight">{toast.message}</span>
      </div>
    </div>
  )
}
