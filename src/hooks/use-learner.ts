'use client'

import { useEffect, useState } from 'react'
import { getLearnerId } from '@/lib/api'

export interface UseLearner {
  learnerId: string | null
  loading: boolean
  error: string | null
}

export function useLearner(): UseLearner {
  const [learnerId, setLearnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getLearnerId()
      .then((id) => {
        if (!mounted) return
        setLearnerId(id)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'Failed to init learner')
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { learnerId, loading, error }
}
