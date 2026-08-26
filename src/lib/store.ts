'use client'

import { create } from 'zustand'

export type Tab = 'chat' | 'voice' | 'learn' | 'playground'
export type Language =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'go'
  | 'rust'
  | 'c'
  | 'cpp'
  | 'java'
  | 'csharp'
  | 'sql'
  | 'html'
  | 'css'
  | 'bash'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'general'

interface AppState {
  activeTab: Tab
  /** When set, the Chat view will pick this up, fill the input, and send it. */
  chatPrefill: string | null
  currentLanguage: Language
  setActiveTab: (t: Tab) => void
  setChatPrefill: (s: string | null) => void
  setCurrentLanguage: (l: Language) => void
  /** Returns the prefill message and clears it (one-shot consumption). */
  consumePrefill: () => string | null
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'chat',
  chatPrefill: null,
  currentLanguage: 'general',
  setActiveTab: (t) => set({ activeTab: t }),
  setChatPrefill: (s) => set({ chatPrefill: s }),
  setCurrentLanguage: (l) => set({ currentLanguage: l }),
  consumePrefill: () => {
    const v = get().chatPrefill
    if (v) {
      set({ chatPrefill: null })
      return v
    }
    return null
  },
}))

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  go: 'Go',
  rust: 'Rust',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  csharp: 'C#',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  bash: 'Bash',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  general: 'General',
}
