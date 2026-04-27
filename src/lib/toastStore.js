let toastFn = null

export const registerToastFn = (fn) => {
  toastFn = fn
}

export const unregisterToastFn = () => {
  toastFn = null
}

export const showToast = (message, type = 'success') => {
  if (toastFn) toastFn(message, type)
}
