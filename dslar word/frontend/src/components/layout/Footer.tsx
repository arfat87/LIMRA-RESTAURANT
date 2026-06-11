import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, Phone, MapPin, Mail, Share2, MessageCircle, Play, ArrowRight } from 'lucide-react';
import { ROUTES } from '../../constants/routes';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-midnight text-white">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to={ROUTES.HOME} className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-gradient-accent rounded-lg flex items-center justify-center shadow-accent">
                <Camera size={20} className="text-white" />
              </div>
              <div>
                <div className="font-poppins font-bold text-white text-lg">DSLR WORLD</div>
                <div className="font-devanagari text-accent text-xs">डीएसएलआर वर्ल्ड</div>
              </div>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">
              Ranchi's most trusted camera store. New and second-hand DSLRs, lenses, and accessories at the lowest prices — delivered pan-India.
            </p>
            <div className="flex gap-3">
              {[
                { icon: Share2, href: '#', label: 'Instagram' },
                { icon: MessageCircle, href: '#', label: 'Facebook' },
                { icon: Play, href: '#', label: 'YouTube' },
              ].map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} aria-label={label}
                  className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-accent transition-colors">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-poppins font-semibold text-white mb-5">Quick Links</h3>
            <ul className="space-y-3">
              {[
                { to: ROUTES.SHOP, label: 'All Products' },
                { to: `${ROUTES.SHOP}?condition=NEW`, label: 'New Cameras' },
                { to: `${ROUTES.SHOP}?condition=SECOND_HAND`, label: 'Second Hand' },
                { to: `${ROUTES.SHOP}?condition=REFURBISHED`, label: 'Refurbished' },
                { to: ROUTES.WISHLIST, label: 'Wishlist' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-gray-400 hover:text-accent transition-colors text-sm flex items-center gap-1.5 group">
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-poppins font-semibold text-white mb-5">My Account</h3>
            <ul className="space-y-3">
              {[
                { to: ROUTES.PROFILE, label: 'My Profile' },
                { to: ROUTES.ORDERS, label: 'My Orders' },
                { to: ROUTES.ADDRESSES, label: 'My Addresses' },
                { to: ROUTES.WISHLIST, label: 'Wishlist' },
                { to: ROUTES.LOGIN, label: 'Sign In' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-gray-400 hover:text-accent transition-colors text-sm flex items-center gap-1.5 group">
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-poppins font-semibold text-white mb-5">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin size={14} className="text-accent" />
                </div>
                <span className="text-gray-400 text-sm">RR Plaza, Church Rd, near Karbala Chowk, Lower Bazaar, Ranchi, Jharkhand 834001</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone size={14} className="text-accent" />
                </div>
                <a href="tel:06202381019" className="text-gray-400 hover:text-accent transition-colors text-sm">062023 81019</a>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail size={14} className="text-accent" />
                </div>
                <a href="mailto:info@dslrworld.in" className="text-gray-400 hover:text-accent transition-colors text-sm">info@dslrworld.in</a>
              </li>
            </ul>
            <div className="mt-5 bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-gray-400 font-medium mb-1">⏰ Store Hours</p>
              <p className="text-xs text-gray-300">Mon–Sat: 10:00 AM – 8:00 PM</p>
              <p className="text-xs text-gray-300">Sunday: 11:00 AM – 6:00 PM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <p>© {year} DSLR WORLD. All rights reserved. | Ranchi, Jharkhand, India</p>
          <div className="flex items-center gap-1">
            <span>Secure Payments via</span>
            <span className="text-gray-300 font-semibold">Razorpay</span>
            <span>•</span>
            <span>Shipping via</span>
            <span className="text-gray-300 font-semibold">Shiprocket</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
