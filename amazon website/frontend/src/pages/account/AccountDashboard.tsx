import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Heart, Bell, MapPin, User, ShoppingCart, Star, ArrowRight, TrendingUp } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const mockStats = [
  { label: 'Total Orders', value: '12', icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { label: 'Total Spent', value: '$1,234', icon: ShoppingCart, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
  { label: 'Wishlist Items', value: '8', icon: Heart, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  { label: 'Reviews Written', value: '5', icon: Star, color: 'text-accent', bg: 'bg-accent/10 border-accent/20' },
]

const mockRecentOrders = [
  { id: 'ORD-001', date: '2024-05-20', items: 3, total: 189.97, status: 'delivered' },
  { id: 'ORD-002', date: '2024-05-15', items: 1, total: 89.99, status: 'shipped' },
  { id: 'ORD-003', date: '2024-05-10', items: 2, total: 234.98, status: 'processing' },
]

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-green-500/20 text-green-400',
  shipped: 'bg-blue-500/20 text-blue-400',
  processing: 'bg-yellow-500/20 text-yellow-400',
  pending: 'bg-gray-500/20 text-gray-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

const quickLinks = [
  { label: 'My Orders', to: '/orders', icon: Package, desc: 'Track and manage orders' },
  { label: 'Edit Profile', to: '/profile', icon: User, desc: 'Update personal info' },
  { label: 'Wishlist', to: '/wishlist', icon: Heart, desc: 'Saved items' },
  { label: 'Notifications', to: '/notifications', icon: Bell, desc: 'Your alerts' },
  { label: 'Addresses', to: '/addresses', icon: MapPin, desc: 'Manage addresses' },
  { label: 'Reviews', to: '/reviews', icon: Star, desc: 'Write & manage reviews' },
]

export default function AccountDashboard() {
  const { user, profile } = useAuthStore()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-center gap-4"
      >
        <div className="w-20 h-20 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={36} className="text-primary" />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Shopper'}! 👋
          </h1>
          <p className="text-gray-400">{user?.email}</p>
          <span className="badge bg-primary/20 text-primary border border-primary/30 mt-1">
            {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)} Account
          </span>
        </div>
        <div className="md:ml-auto">
          <Link to="/profile" className="btn-outline flex items-center gap-2 text-sm">
            <User size={16} /> Edit Profile
          </Link>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {mockStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`card border ${stat.bg} hover:scale-105 transition-transform duration-200`}
          >
            <div className="flex items-center gap-3">
              <stat.icon size={24} className={stat.color} />
              <div>
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-xs text-gray-400">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent orders */}
        <div className="lg:col-span-2 card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-white flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" /> Recent Orders
            </h2>
            <Link to="/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {mockRecentOrders.map(order => (
              <div key={order.id} className="flex items-center gap-4 p-3 bg-surface border border-border rounded-xl">
                <div className="flex-1">
                  <p className="font-medium text-white text-sm">{order.id}</p>
                  <p className="text-xs text-gray-400">{order.date} · {order.items} items</p>
                </div>
                <span className={`badge ${STATUS_COLORS[order.status]}`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
                <p className="font-bold text-primary">${order.total.toFixed(2)}</p>
                <Link to={`/orders/${order.id}`} className="text-xs text-gray-400 hover:text-primary transition-colors">
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="card">
          <h2 className="font-bold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="flex flex-col items-center gap-1 p-3 bg-surface border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-center group"
              >
                <link.icon size={22} className="text-gray-400 group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
