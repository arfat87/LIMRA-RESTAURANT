import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { MobileNav } from './MobileNav';
import { CartDrawer } from '../cart/CartDrawer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />
      <main className="flex-1 pb-16 sm:pb-0">
        {children}
      </main>
      <Footer />
      <MobileNav />
      <CartDrawer />
    </div>
  );
};
