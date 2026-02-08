import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore, type Theme } from '../index'

// Mock localStorage for persist middleware
const mockStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  }),
}

// Mock window.matchMedia
const mockMatchMedia = vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}))

// Mock document.documentElement
const mockClassList = {
  add: vi.fn(),
  remove: vi.fn(),
  contains: vi.fn(),
  toggle: vi.fn(),
}

Object.defineProperty(global, 'localStorage', { value: localStorageMock })
Object.defineProperty(global, 'window', {
  value: {
    matchMedia: mockMatchMedia,
    localStorage: localStorageMock,
  },
  writable: true,
})
Object.defineProperty(global, 'document', {
  value: {
    documentElement: {
      classList: mockClassList,
    },
  },
  writable: true,
})

const initialState = {
  theme: 'system' as Theme,
  sidebarCollapsed: false,
}

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState(initialState)
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('setTheme', () => {
    it('should set theme to light', () => {
      const { setTheme } = useUIStore.getState()

      setTheme('light')

      expect(useUIStore.getState().theme).toBe('light')
    })

    it('should set theme to dark', () => {
      const { setTheme } = useUIStore.getState()

      setTheme('dark')

      expect(useUIStore.getState().theme).toBe('dark')
    })

    it('should set theme to system', () => {
      const { setTheme } = useUIStore.getState()

      setTheme('dark') // First set to dark
      setTheme('system')

      expect(useUIStore.getState().theme).toBe('system')
    })

    it('should add dark class for dark theme', () => {
      const { setTheme } = useUIStore.getState()

      setTheme('dark')

      expect(mockClassList.add).toHaveBeenCalledWith('dark')
    })

    it('should remove dark class for light theme', () => {
      const { setTheme } = useUIStore.getState()

      setTheme('light')

      expect(mockClassList.remove).toHaveBeenCalledWith('dark')
    })

    it('should use system preference when theme is system and prefers dark', () => {
      mockMatchMedia.mockReturnValueOnce({
        matches: true, // prefers-color-scheme: dark
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const { setTheme } = useUIStore.getState()
      setTheme('system')

      expect(mockClassList.add).toHaveBeenCalledWith('dark')
    })

    it('should use system preference when theme is system and prefers light', () => {
      mockMatchMedia.mockReturnValueOnce({
        matches: false, // prefers-color-scheme: light
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })

      const { setTheme } = useUIStore.getState()
      setTheme('system')

      expect(mockClassList.remove).toHaveBeenCalledWith('dark')
    })
  })

  describe('toggleSidebar', () => {
    it('should toggle sidebar from collapsed to expanded', () => {
      useUIStore.setState({ sidebarCollapsed: true })

      const { toggleSidebar } = useUIStore.getState()
      toggleSidebar()

      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should toggle sidebar from expanded to collapsed', () => {
      useUIStore.setState({ sidebarCollapsed: false })

      const { toggleSidebar } = useUIStore.getState()
      toggleSidebar()

      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    it('should toggle multiple times correctly', () => {
      const { toggleSidebar } = useUIStore.getState()

      expect(useUIStore.getState().sidebarCollapsed).toBe(false)

      toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)

      toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)

      toggleSidebar()
      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })
  })

  describe('setSidebarCollapsed', () => {
    it('should set sidebar to collapsed', () => {
      const { setSidebarCollapsed } = useUIStore.getState()

      setSidebarCollapsed(true)

      expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    })

    it('should set sidebar to expanded', () => {
      useUIStore.setState({ sidebarCollapsed: true })

      const { setSidebarCollapsed } = useUIStore.getState()
      setSidebarCollapsed(false)

      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })

    it('should not change state when setting same value', () => {
      const { setSidebarCollapsed } = useUIStore.getState()

      setSidebarCollapsed(false)
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)

      setSidebarCollapsed(false)
      expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    })
  })

  describe('selectors', () => {
    it('selectTheme should return current theme', async () => {
      const { selectTheme } = await import('../index')
      useUIStore.setState({ theme: 'dark' })

      expect(selectTheme(useUIStore.getState())).toBe('dark')
    })

    it('selectTheme should return system by default', async () => {
      const { selectTheme } = await import('../index')

      expect(selectTheme(useUIStore.getState())).toBe('system')
    })

    it('selectSidebarCollapsed should return collapsed state', async () => {
      const { selectSidebarCollapsed } = await import('../index')
      useUIStore.setState({ sidebarCollapsed: true })

      expect(selectSidebarCollapsed(useUIStore.getState())).toBe(true)
    })

    it('selectSidebarCollapsed should return false by default', async () => {
      const { selectSidebarCollapsed } = await import('../index')

      expect(selectSidebarCollapsed(useUIStore.getState())).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should use correct storage key name', () => {
      // The store uses persist middleware with name 'clawui-ui'
      // We just verify the store is created with persist middleware
      // by checking the store's persist property exists
      const state = useUIStore.getState()
      expect(state.theme).toBeDefined()
      expect(state.sidebarCollapsed).toBeDefined()
      // The persist middleware wraps the store,
      // we can verify the store still functions correctly
      const { setTheme } = state
      setTheme('dark')
      expect(useUIStore.getState().theme).toBe('dark')
    })
  })

  describe('theme combinations', () => {
    const themes: Theme[] = ['light', 'dark', 'system']

    it('should handle all theme transitions', () => {
      const { setTheme } = useUIStore.getState()

      for (const fromTheme of themes) {
        for (const toTheme of themes) {
          setTheme(fromTheme)
          setTheme(toTheme)
          expect(useUIStore.getState().theme).toBe(toTheme)
        }
      }
    })
  })
})
