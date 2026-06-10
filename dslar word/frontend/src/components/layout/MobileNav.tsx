import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, ShoppingCart, Heart, User } from 'lucide-react';
import { ROUTES } from '../../constants/routes';
import { useCartStore } from '../../store/cartStore';
import { motion } from 'framer-motion';

const navItems = [
  { to: ROUTES.HOME, icon: Home, label: 'Home' },
  { to: ROUTES.SHOP, icon: ShoppingBag, label: 'Shop' },
  { to: ROUTES.CART, icon: ShoppingCart, label: 'Cart', showCount: true },
  { to: ROUTES.WISHLIST, icon: Heart, label: 'Wishlist' },
  { to: ROUTES.PROFILE, icon: User, label: 'Profile' },
];

export const MobileNav: React.FC = () => {
  const location = useLocation();
  const cartCount = useCartStore((s) => s.itemCount());

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 pb-safe sm:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex">
        {navItems.map(({ to, icon: Icon, label, showCount }) => {
          const isActive = to === ROUTES.HOME
            ? location.pathname === '/'
            : location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center justify-center py-2.5 relative group"
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={`transition-colors ${isActive ? 'text-accent' : 'text-gray-500 group-hover:text-accent'}`}
                />
                {showCount && cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-accent' : 'text-gray-500'}`}>
                {label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent rounded-full"
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
