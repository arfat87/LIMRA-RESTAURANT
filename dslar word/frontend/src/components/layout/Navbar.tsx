import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingCart, Heart, User, Menu, X, ChevronDown, LogOut, Package, MapPin, Camera } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { ROUTES } from '../../constants/routes';
import { productApi } from '../../api/product.api';
import type { Product } from '../../types/product.types';
import { formatPrice } from '../../utils/formatCurrency';

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { toggleCart } = useCartStore();
  const { productIds } = useWishlistStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await productApi.search(searchQuery);
        setSearchResults(data.data?.products || []);
      } catch { setSearchResults([]); }
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  const handleLogout = () => {
    logout();
    navigate(ROUTES.HOME);
  };

  const cartCount = useCartStore((s) => s.itemCount());

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'shadow-xl' : ''}`}>
        {/* Top bar */}
        <div className="bg-midnight text-white">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-300">
              <MapPin size={11} className="text-accent" />
              RR Plaza, Ranchi, Jharkhand — Lowest Prices Guaranteed 📷
            </span>
            <span className="text-gray-300 hidden sm:block">📞 062023 81019</span>
          </div>
        </div>

        {/* Main nav */}
        <div className="bg-midnight/95 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
            {/* Logo */}
            <Link to={ROUTES.HOME} className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center shadow-accent group-hover:scale-110 transition-transform">
                <Camera size={18} className="text-white" />
              </div>
              <div className="leading-tight">
                <div className="font-poppins font-bold text-white text-base tracking-wide">DSLR WORLD</div>
                <div className="font-devanagari text-accent text-[10px] leading-none">डीएसएलआर वर्ल्ड</div>
              </div>
            </Link>

            {/* Search bar */}
            <div ref={searchRef} className="flex-1 relative hidden sm:block">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                  placeholder="Search cameras, lenses, accessories..."
                  className="w-full bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:bg-white/15 focus:border-accent/60 transition-all"
                />
              </div>
              <AnimatePresence>
                {searchOpen && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
                  >
                    {searchResults.map((p) => (
                      <Link
                        key={p.id}
                        to={ROUTES.PRODUCT(p.slug)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                        onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                      >
                        <img src={p.images[0] || '/placeholder.jpg'} alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 line-clamp-1">{p.name}</p>
                          <p className="text-sm font-semibold text-accent">{formatPrice(p.price)}</p>
                        </div>
                      </Link>
                    ))}
                    <button
                      onClick={() => { navigate(`${ROUTES.SHOP}?q=${searchQuery}`); setSearchOpen(false); }}
                      className="w-full px-4 py-2.5 text-sm text-accent font-semibold hover:bg-gray-50 border-t text-center"
                    >
                      View all results →
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Nav actions */}
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              {/* Wishlist */}
              <Link to={ROUTES.WISHLIST} className="relative p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition-all">
                <Heart size={20} />
                {productIds.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {productIds.length > 9 ? '9+' : productIds.length}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button onClick={toggleCart} className="relative p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10 transition-all">
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </button>

              {/* User menu */}
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1.5 pl-1.5 pr-3 rounded-xl hover:bg-white/10 transition-all"
                  >
                    <div className="w-7 h-7 bg-gradient-accent rounded-lg flex items-center justify-center text-white text-xs font-bold">
                      {user?.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white text-sm font-medium hidden md:block">{user?.name.split(' ')[0]}</span>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50"
                      >
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                          <p className="font-semibold text-gray-800 text-sm">{user?.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                        <div className="py-1">
                          {[
                            { to: ROUTES.PROFILE, icon: User, label: 'My Profile' },
                            { to: ROUTES.ORDERS, icon: Package, label: 'My Orders' },
                            { to: ROUTES.ADDRESSES, icon: MapPin, label: 'Addresses' },
                          ].map(({ to, icon: Icon, label }) => (
                            <Link key={to} to={to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-gray-700 transition-colors">
                              <Icon size={15} className="text-gray-400" />{label}
                            </Link>
                          ))}
                          {user?.role === 'ADMIN' && (
                            <Link to={ROUTES.ADMIN} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-sm text-purple-600 font-medium transition-colors">
                              <Camera size={15} />Admin Panel
                            </Link>
                          )}
                        </div>
                        <div className="border-t border-gray-100 py-1">
                          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-red-50 text-sm text-red-600 transition-colors">
                            <LogOut size={15} />Sign Out
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link to={ROUTES.LOGIN} className="bg-gradient-accent text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5">
                  <User size={14} />Sign In
                </Link>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2 text-gray-300 hover:text-white rounded-xl hover:bg-white/10"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile search */}
          <div className="sm:hidden px-4 pb-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search cameras, lenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`${ROUTES.SHOP}?q=${searchQuery}`)}
                className="w-full bg-white/10 text-white placeholder-gray-400 border border-white/20 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-accent/60"
              />
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-midnight-100 border-b border-white/10 sm:hidden"
            >
              <nav className="px-4 py-3 flex flex-col gap-1">
                {[
                  { to: ROUTES.SHOP, label: 'Shop' },
                  { to: `${ROUTES.SHOP}?condition=NEW`, label: 'New Cameras' },
                  { to: `${ROUTES.SHOP}?condition=SECOND_HAND`, label: 'Second Hand' },
                ].map(({ to, label }) => (
                  <Link key={to} to={to} className="text-gray-300 hover:text-white py-2 text-sm border-b border-white/5 last:border-0">
                    {label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      {/* Spacer for fixed header */}
      <div className="h-[108px] sm:h-[88px]" />
    </>
  );
};
