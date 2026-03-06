type ToastVariant = 'success' | 'error' | 'info'

type Toast = {
  id: string
  title?: string
  message: string
  variant: ToastVariant
  timeout: number
}

type AddToastInput = {
  title?: string
  message: string
  variant?: ToastVariant
  timeout?: number
}

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function addToast(input: AddToastInput) {
    const toast: Toast = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: input.title,
      message: input.message,
      variant: input.variant ?? 'info',
      timeout: input.timeout ?? 3200
    }

    toasts.value = [toast, ...toasts.value]

    if (toast.timeout > 0) {
      setTimeout(() => {
        removeToast(toast.id)
      }, toast.timeout)
    }
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return { toasts, addToast, removeToast }
}
