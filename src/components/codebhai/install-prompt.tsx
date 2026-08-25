'use client'

import * as React from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = React.useState(false)

  React.useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBIP as EventListener)
    window.addEventListener('appinstalled', onInstalled)

    // Already installed as a standalone PWA?
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP as EventListener)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const onClick = async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setDeferred(null)
  }

  if (installed || !deferred) return null

  return (
    <Button
      onClick={onClick}
      size="sm"
      variant="outline"
      className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
    >
      <Download className="size-4" />
      <span className="hidden sm:inline">Install app</span>
      <span className="sm:hidden">Install</span>
    </Button>
  )
}
