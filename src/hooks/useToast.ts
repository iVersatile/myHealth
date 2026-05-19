import { useState, useCallback } from 'react'

export function useToast(duration = 2500) {
  const [message, setMessage] = useState<string | null>(null)

  const show = useCallback(
    (msg: string) => {
      setMessage(msg)
      setTimeout(() => setMessage(null), duration)
    },
    [duration],
  )

  return { message, show }
}
