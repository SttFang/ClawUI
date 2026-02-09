import { create } from 'zustand'
import { ipc } from '@/lib/ipc'

export type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarCollapsed: boolean
}

interface UIActions {
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  hydrate: (state: Partial<UIState>) => void
}

type UIStore = UIState & UIActions

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  const effectiveTheme = theme === 'system' ? getSystemTheme() : theme

  if (effectiveTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const useUIStore = create<UIStore>()(
  (set, get) => ({
    theme: 'system',
    sidebarCollapsed: false,

    hydrate: (state) => {
      if (state.theme) {
        set({ theme: state.theme })
        applyTheme(state.theme)
      }
      if (typeof state.sidebarCollapsed === 'boolean') {
        set({ sidebarCollapsed: state.sidebarCollapsed })
      }
    },

    setTheme: (theme) => {
      set({ theme })
      applyTheme(theme)
      // Persist to ClawUI state (best-effort)
      void ipc.state.patch({ ui: { theme } } as any).catch(() => {})
    },

    toggleSidebar: () => {
      const next = !get().sidebarCollapsed
      set({ sidebarCollapsed: next })
      void ipc.state.patch({ ui: { sidebarCollapsed: next } } as any).catch(() => {})
    },

    setSidebarCollapsed: (collapsed) => {
      set({ sidebarCollapsed: collapsed })
      void ipc.state.patch({ ui: { sidebarCollapsed: collapsed } } as any).catch(() => {})
    },
  })
)

// Initialize theme on load (uses in-memory default until hydrated).
export function initThemeListeners() {
  const { theme } = useUIStore.getState()
  applyTheme(theme)

  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (useUIStore.getState().theme === 'system') applyTheme('system')
    })
  }
}

// Backward-compatible alias (App.tsx expects initTheme()).
export function initTheme() {
  initThemeListeners()
}

// Selectors
export const selectTheme = (state: UIStore) => state.theme
export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed
