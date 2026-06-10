import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { Camera, LayoutDashboard, Package, Grid3X3, ShoppingCart, Users, ArrowLeft } from 'lucide-react';

const NAV_ITEMS = [
  { to: ROUTES.ADMIN, label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: ROUTES.ADMIN_PRODUCTS, label: 'Products', icon: Package },
  { to: ROUTES.ADMIN_CATEGORIES, label: 'Categories', icon: Grid3X3 },
  { to: ROUTES.ADMIN_ORDERS, label: 'Orders', icon: ShoppingCart },
  { to: ROUTES.ADMIN_USERS, label: 'Users', icon: Users },
];

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-60 bg-midnight text-white flex-shrink-0 flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-gradient-accent rounded-lg flex items-center justify-center">
              <Camera size={16} className="text-white" />
            </div>
            <div>
              <p className="font-poppins font-bold text-white text-sm">DSLR WORLD</p>
              <p className="text-gray-400 text-[10px]">Admin Panel</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
            const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive ? 'bg-accent text-white font-semibold' : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <Link
            to={ROUTES.HOME}
            className="flex items-center gap-2 px-3 py-2.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={15} />Back to Store
          </Link>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};
