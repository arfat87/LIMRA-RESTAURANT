import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, ShoppingCart, User, Heart, Menu, X, ChevronDown,
  Package, Settings, LogOut, Bell, Truck, Tag, Star, Mic
} from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { mockCategories, mockProducts } from '@/data/mockData'

const NAV_CATEGORIES = mockCategories.slice(0, 8)

export default function Navbar() {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const navigate = useNavigate()
  const { getItemCount, openDrawer } = useCartStore()
  const { user, profile, signOut } = useAuthStore()
  const { mobileMenuOpen, toggleMobileMenu, setMobileMenuOpen } = useUIStore()
  const searchRef = useRef<HTMLDivElement>(null)
  const itemCount = getItemCount()

  const suggestions = searchQuery.length > 1
    ? mockProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5)
    : []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setShowSuggestions(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    setAccountOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar */}
      <div
        className="bg-[#232F3E] px-4 py-2.5"
        style={{ background: 'linear-gradient(to bottom, #232F3E, #1a2534)' }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl">🛒</span>
            <span className="font-black text-white text-lg leading-none hidden sm:block">
              Market<span className="text-primary">Pro</span>
            </span>
          </Link>

          {/* Search */}
          <div ref={searchRef} className="flex-1 relative max-w-2xl mx-auto">
            <form onSubmit={handleSearch} className="flex">
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true) }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search products, brands, categories..."
                className="flex-1 bg-white text-gray-900 px-4 py-2.5 text-sm rounded-l-lg outline-none focus:ring-2 focus:ring-primary/60"
              />
              <button
                type="button"
                className="bg-white text-gray-400 hover:text-gray-600 px-2 py-2.5 border-l border-gray-200 transition-colors"
                onClick={() => {}}
              >
                <Mic size={18} />
              </button>
              <button
                type="submit"
                className="bg-primary hover:bg-primary-600 text-secondary px-4 py-2.5 rounded-r-lg transition-colors"
              >
                <Search size={18} />
              </button>
            </form>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-[#1F2937] border border-border rounded-lg shadow-2xl overflow-hidden z-50"
                >
                  {suggestions.map(p => (
                    <Link
                      key={p.id}
                      to={`/product/${p.id}`}
                      onClick={() => { setShowSuggestions(false); setSearchQuery('') }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
                    >
                      <img src={p.images[0]?.url} alt={p.title} className="w-10 h-10 object-cover rounded" />
                      <div>
                        <p className="text-sm text-white">{p.title}</p>
                        <p className="text-xs text-primary font-semibold">${p.price}</p>
                      </div>
                    </Link>
                  ))}
                  <div
                    className="px-4 py-2 bg-surface text-center cursor-pointer"
                    onClick={handleSearch}
                  >
                    <span className="text-sm text-primary hover:text-primary-400">
                      Search for "<strong>{searchQuery}</strong>"
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Wishlist */}
            <Link to="/wishlist" className="p-2 hover:bg-white/10 rounded-lg transition-colors hidden sm:block">
              <Heart size={22} className="text-gray-300 hover:text-primary" />
            </Link>

            {/* Notifications */}
            {user && (
              <Link to="/notifications" className="p-2 hover:bg-white/10 rounded-lg transition-colors relative hidden sm:block">
                <Bell size={22} className="text-gray-300 hover:text-primary" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Link>
            )}

            {/* Cart */}
            <button
              onClick={openDrawer}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors relative"
            >
              <ShoppingCart size={22} className="text-gray-300 hover:text-primary" />
              {itemCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-primary text-secondary text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </motion.span>
              )}
            </button>

            {/* Account */}
            <div className="relative">
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                className="flex items-center gap-1.5 p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <User size={22} className="text-gray-300" />
                )}
                <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
              </button>

              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    className="absolute right-0 mt-1 w-56 bg-[#1F2937] border border-border rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    {user ? (
                      <>
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-sm font-semibold text-white">{profile?.full_name || 'User'}</p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                          {user.role !== 'customer' && (
                            <span className="badge bg-primary/20 text-primary mt-1">
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                          )}
                        </div>
                        <div className="py-1">
                          <DropdownLink to="/account" icon={<User size={16} />} label="My Account" onClick={() => setAccountOpen(false)} />
                          <DropdownLink to="/orders" icon={<Package size={16} />} label="My Orders" onClick={() => setAccountOpen(false)} />
                          <DropdownLink to="/wishlist" icon={<Heart size={16} />} label="Wishlist" onClick={() => setAccountOpen(false)} />
                          <DropdownLink to="/notifications" icon={<Bell size={16} />} label="Notifications" onClick={() => setAccountOpen(false)} />
                          {user.role === 'seller' && (
                            <DropdownLink to="/seller" icon={<Tag size={16} />} label="Seller Dashboard" onClick={() => setAccountOpen(false)} />
                          )}
                          {user.role === 'admin' && (
                            <DropdownLink to="/admin" icon={<Settings size={16} />} label="Admin Panel" onClick={() => setAccountOpen(false)} />
                          )}
                        </div>
                        <div className="border-t border-border py-1">
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut size={16} />
                            Sign Out
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 space-y-2">
                        <Link
                          to="/login"
                          onClick={() => setAccountOpen(false)}
                          className="block btn-primary text-center text-sm"
                        >
                          Sign In
                        </Link>
                        <Link
                          to="/register"
                          onClick={() => setAccountOpen(false)}
                          className="block btn-secondary text-center text-sm"
                        >
                          Create Account
                        </Link>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X size={22} className="text-white" /> : <Menu size={22} className="text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Category nav bar */}
      <div className="bg-[#37475A] hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 py-1 overflow-x-auto scrollbar-hide">
          <Link to="/deals" className="flex items-center gap-1 px-3 py-1.5 text-sm text-white hover:text-primary hover:bg-white/10 rounded-md transition-colors whitespace-nowrap font-medium">
            <Tag size={14} className="text-primary" />
            Today's Deals
          </Link>
          <Link to="/products" className="flex items-center gap-1 px-3 py-1.5 text-sm text-white hover:text-primary hover:bg-white/10 rounded-md transition-colors whitespace-nowrap">
            <Star size={14} />
            Best Sellers
          </Link>
          <Link to="/products?new=1" className="flex items-center gap-1 px-3 py-1.5 text-sm text-white hover:text-primary hover:bg-white/10 rounded-md transition-colors whitespace-nowrap">
            <Truck size={14} />
            New Arrivals
          </Link>
          <div className="h-4 w-px bg-white/20 mx-1" />
          {NAV_CATEGORIES.map(cat => (
            <Link
              key={cat.id}
              to={`/category/${cat.slug}`}
              className="px-3 py-1.5 text-sm text-white hover:text-primary hover:bg-white/10 rounded-md transition-colors whitespace-nowrap"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-72 h-full bg-[#1F2937] shadow-2xl overflow-y-auto">
              <div className="p-4 bg-[#232F3E] flex items-center justify-between">
                <span className="font-bold text-white text-lg">Menu</span>
                <button onClick={() => setMobileMenuOpen(false)}>
                  <X size={22} className="text-white" />
                </button>
              </div>
              {!user && (
                <div className="p-4 space-y-2 border-b border-border">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block btn-primary text-center">Sign In</Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="block btn-secondary text-center">Create Account</Link>
                </div>
              )}
              <nav className="p-4 space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Browse</p>
                {NAV_CATEGORIES.map(cat => (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-surface rounded-lg transition-colors"
                  >
                    <span>{cat.icon}</span>
                    {cat.name}
                  </Link>
                ))}
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick Links</p>
                  <Link to="/deals" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-surface rounded-lg transition-colors">
                    <Tag size={16} />
                    Today's Deals
                  </Link>
                  {user && (
                    <>
                      <Link to="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-surface rounded-lg transition-colors">
                        <User size={16} />
                        My Account
                      </Link>
                      <Link to="/orders" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-surface rounded-lg transition-colors">
                        <Package size={16} />
                        My Orders
                      </Link>
                      <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-surface rounded-lg transition-colors">
                        <LogOut size={16} />
                        Sign Out
                      </button>
                    </>
                  )}
                </div>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function DropdownLink({
  to, icon, label, onClick
}: { to: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-surface transition-colors"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  )
}
