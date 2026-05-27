import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, CreditCard, Shield, Truck, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const footerLinks = {
  company: [
    { label: 'About Us', to: '/about' },
    { label: 'Careers', to: '/careers' },
    { label: 'Press', to: '/press' },
    { label: 'Blog', to: '/blog' },
    { label: 'Affiliates', to: '/affiliates' },
  ],
  help: [
    { label: 'Customer Service', to: '/customer-service' },
    { label: 'Track Your Order', to: '/orders' },
    { label: 'Returns & Refunds', to: '/returns' },
    { label: 'Shipping Info', to: '/shipping' },
    { label: 'Gift Cards', to: '/gift-center' },
  ],
  account: [
    { label: 'My Account', to: '/account' },
    { label: 'My Orders', to: '/orders' },
    { label: 'Wishlist', to: '/wishlist' },
    { label: 'Become a Seller', to: '/seller/register' },
    { label: 'Notifications', to: '/notifications' },
  ],
}

const trustBadges = [
  { icon: <Truck size={20} />, label: 'Free Shipping', sub: 'On orders over $50' },
  { icon: <RefreshCw size={20} />, label: 'Easy Returns', sub: '30-day policy' },
  { icon: <Shield size={20} />, label: 'Secure Payment', sub: 'SSL encrypted' },
  { icon: <CreditCard size={20} />, label: 'Best Prices', sub: 'Price match guarantee' },
]

export default function Footer() {
  const [email, setEmail] = useState('')

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      toast.success('🎉 Subscribed successfully! Get ready for exclusive deals.')
      setEmail('')
    }
  }

  return (
    <footer className="bg-[#131921] border-t border-border">
      {/* Trust badges */}
      <div className="bg-[#1F2937] border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {trustBadges.map((badge, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="text-primary shrink-0">{badge.icon}</div>
              <div>
                <p className="text-sm font-semibold text-white">{badge.label}</p>
                <p className="text-xs text-gray-400">{badge.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
        {/* Brand */}
        <div className="lg:col-span-2">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <span className="text-3xl">🛒</span>
            <span className="font-black text-white text-xl">
              Market<span className="text-primary">Pro</span>
            </span>
          </Link>
          <p className="text-gray-400 text-sm mb-5 leading-relaxed">
            Your one-stop destination for millions of products. Fast delivery, easy returns,
            and unbeatable prices. Shopping made simple.
          </p>
          <div className="space-y-2 mb-6">
            <a href="tel:+18001234567" className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors">
              <Phone size={15} /> 1-800-MARKET-PRO
            </a>
            <a href="mailto:support@marketpro.com" className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors">
              <Mail size={15} /> support@marketpro.com
            </a>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin size={15} /> 123 Commerce Blvd, NY 10001
            </div>
          </div>
          {/* Social icons */}
          <div className="flex gap-3">
            {[
              { icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg>, href: '#', color: 'hover:bg-blue-600' },
              { icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, href: '#', color: 'hover:bg-sky-500' },
              { icon: <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01"/></svg>, href: '#', color: 'hover:bg-pink-600' },
              { icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>, href: '#', color: 'hover:bg-red-600' },
            ].map((s, i) => (
              <a
                key={i}
                href={s.href}
                className={`w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center text-gray-400 hover:text-white ${s.color} hover:border-transparent transition-all duration-200`}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        {/* Links columns */}
        <div>
          <h4 className="text-white font-semibold mb-4">Company</h4>
          <ul className="space-y-2.5">
            {footerLinks.company.map(link => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-gray-400 hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Help</h4>
          <ul className="space-y-2.5">
            {footerLinks.help.map(link => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-gray-400 hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-4">Account</h4>
          <ul className="space-y-2.5">
            {footerLinks.account.map(link => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-gray-400 hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Newsletter */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-white font-semibold mb-1">Stay in the loop</h4>
            <p className="text-sm text-gray-400">Get exclusive deals and new arrivals right in your inbox.</p>
          </div>
          <form onSubmit={handleNewsletter} className="flex gap-2 w-full md:w-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="input flex-1 md:w-64"
              required
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} MarketPro. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Cookies</Link>
          </div>
          {/* Payment icons */}
          <div className="flex items-center gap-2">
            {['VISA', 'MC', 'AMEX', 'PP'].map(p => (
              <span key={p} className="px-2 py-0.5 bg-surface border border-border rounded text-xs text-gray-400 font-mono">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
