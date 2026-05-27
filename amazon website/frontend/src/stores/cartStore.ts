import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, Product, ProductVariant } from '@/types'

interface CartState {
  items: CartItem[]
  isOpen: boolean
  addItem: (product: Product, variant?: ProductVariant, quantity?: number) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  saveForLater: (id: string) => void
  moveToCart: (id: string) => void
  toggleDrawer: () => void
  openDrawer: () => void
  closeDrawer: () => void
  getTotal: () => number
  getSubtotal: () => number
  getTaxAmount: () => number
  getShippingCost: () => number
  getItemCount: () => number
  getSavedItems: () => CartItem[]
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (product, variant, quantity = 1) => {
        const { items } = get()
        const existingId = variant
          ? `${product.id}-${variant.id}`
          : product.id
        const existing = items.find(i => i.id === existingId)

        if (existing) {
          set({
            items: items.map(i =>
              i.id === existingId
                ? { ...i, quantity: i.quantity + quantity }
                : i
            ),
          })
        } else {
          const newItem: CartItem = {
            id: existingId,
            product,
            variant,
            quantity,
          }
          set({ items: [...items, newItem], isOpen: true })
        }
      },

      removeItem: (id) => {
        set({ items: get().items.filter(i => i.id !== id) })
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id)
          return
        }
        set({
          items: get().items.map(i =>
            i.id === id ? { ...i, quantity } : i
          ),
        })
      },

      clearCart: () => set({ items: [] }),

      saveForLater: (id) => {
        set({
          items: get().items.map(i =>
            i.id === id ? { ...i, saved_for_later: true } : i
          ),
        })
      },

      moveToCart: (id) => {
        set({
          items: get().items.map(i =>
            i.id === id ? { ...i, saved_for_later: false } : i
          ),
        })
      },

      toggleDrawer: () => set(s => ({ isOpen: !s.isOpen })),
      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),

      getTotal: () => {
        const { items } = get()
        const subtotal = items
          .filter(i => !i.saved_for_later)
          .reduce((sum, i) => sum + (i.product.price + (i.variant?.price_modifier ?? 0)) * i.quantity, 0)
        const shipping = subtotal > 50 ? 0 : 4.99
        const tax = subtotal * 0.08
        return subtotal + shipping + tax
      },

      getSubtotal: () => {
        return get().items
          .filter(i => !i.saved_for_later)
          .reduce((sum, i) => sum + (i.product.price + (i.variant?.price_modifier ?? 0)) * i.quantity, 0)
      },

      getTaxAmount: () => get().getSubtotal() * 0.08,

      getShippingCost: () => {
        const subtotal = get().getSubtotal()
        return subtotal > 50 ? 0 : 4.99
      },

      getItemCount: () => {
        return get().items
          .filter(i => !i.saved_for_later)
          .reduce((sum, i) => sum + i.quantity, 0)
      },

      getSavedItems: () => get().items.filter(i => i.saved_for_later),
    }),
    {
      name: 'marketplace-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
)
