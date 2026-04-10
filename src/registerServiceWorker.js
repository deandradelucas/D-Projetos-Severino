export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return
  }

  // Com Vite em dev, o HMR pode deixar o documento num estado em que
  // `register()` lança InvalidStateError. O PWA só precisa do SW na build.
  const forceDev = import.meta.env.VITE_ENABLE_SW === 'true'
  if (import.meta.env.DEV && !forceDev) {
    return
  }

  window.addEventListener('load', () => {
    queueMicrotask(() => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        if (error?.name === 'InvalidStateError') {
          return
        }
        console.warn('Service worker:', error)
      })
    })
  })
}
