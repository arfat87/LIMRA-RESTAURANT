import { create } from 'zustand'

interface UIState {
  mobileMenuOpen: boolean
  searchOpen: boolean
  chatbotOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setChatbotOpen: (open: boolean) => void
  toggleMobileMenu: () => void
  toggleSearch: () => void
  toggleChatbot: () => void
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  searchOpen: false,
  chatbotOpen: false,

  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setChatbotOpen: (open) => set({ chatbotOpen: open }),

  toggleMobileMenu: () => set(s => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  toggleSearch: () => set(s => ({ searchOpen: !s.searchOpen })),
  toggleChatbot: () => set(s => ({ chatbotOpen: !s.chatbotOpen })),
}))
