import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DollarSign, ShoppingBag, Users, Package, TrendingUp, TrendingDown } from 'lucide-react'

const revenueData = [
  { month: 'Jan', revenue: 42000, orders: 380 },
  { month: 'Feb', revenue: 58000, orders: 520 },
  { month: 'Mar', revenue: 49000, orders: 440 },
  { month: 'Apr', revenue: 72000, orders: 650 },
  { month: 'May', revenue: 89000, orders: 800 },
  { month: 'Jun', revenue: 67000, orders: 600 },
  { month: 'Jul', revenue: 95000, orders: 860 },
]

const userGrowthData = [
  { month: 'Jan', users: 1200 },
  { month: 'Feb', users: 1580 },
  { month: 'Mar', users: 2100 },
  { month: 'Apr', users: 2800 },
  { month: 'May', users: 3400 },
  { month: 'Jun', users: 4100 },
  { month: 'Jul', users: 4900 },
]

const kpis = [
  { label: 'Total Revenue', value: '$472,000', icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10', delta: '+18.5%', up: true },
  { label: 'Total Orders', value: '4,250', icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10', delta: '+12.3%', up: true },
  { label: 'Total Users', value: '4,900', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10', delta: '+24.1%', up: true },
  { label: 'Total Products', value: '1,284', icon: Package, color: 'text-primary', bg: 'bg-primary/10', delta: '-2.1%', up: false },
]

const topSellers = [
  { name: 'TechVault', revenue: '$124,500', orders: 892, rating: 4.8 },
  { name: 'StyleHub', revenue: '$89,200', orders: 654, rating: 4.6 },
  { name: 'HomeDecor', revenue: '$67,400', orders: 445, rating: 4.7 },
  { name: 'SportZone', revenue: '$54,100', orders: 387, rating: 4.5 },
]

const recentOrders = [
  { id: 'ORD-9001', customer: 'Alice Brown', total: '$234.99', status: 'delivered', date: 'May 20' },
  { id: 'ORD-9002', customer: 'Bob Smith', total: '$89.99', status: 'processing', date: 'May 19' },
  { id: 'ORD-9003', customer: 'Carol Lee', total: '$1,299.00', status: 'shipped', date: 'May 18' },
  { id: 'ORD-9004', customer: 'David K.', total: '$45.00', status: 'pending', date: 'May 17' },
]

const STATUS_COLORS: Record<string, string> = {
  delivered: 'text-green-400',
  shipped: 'text-blue-400',
  processing: 'text-yellow-400',
  pending: 'text-gray-400',
}

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-400">Platform analytics and management overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`card border border-white/5 ${kpi.bg}`}
          >
            <div className="flex justify-between items-start">
              <kpi.icon size={24} className={kpi.color} />
              <span className={`text-xs font-medium flex items-center gap-1 ${kpi.up ? 'text-green-400' : 'text-red-400'}`}>
                {kpi.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {kpi.delta}
              </span>
            </div>
            <p className="text-2xl font-black text-white mt-3">{kpi.value}</p>
            <p className="text-xs text-gray-400">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="card">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" /> Monthly Revenue
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="#FF9900" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* User growth */}
        <div className="card">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <Users size={18} className="text-purple-400" /> User Growth
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={userGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                formatter={(v: number) => [v.toLocaleString(), 'Users']}
              />
              <Line type="monotone" dataKey="users" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top sellers */}
        <div className="card">
          <h2 className="font-bold text-white mb-4">Top Sellers</h2>
          <div className="space-y-3">
            {topSellers.map((seller, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-xl">
                <span className="text-gray-500 font-bold w-6 text-center">#{i + 1}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white text-sm">{seller.name}</p>
                  <p className="text-xs text-gray-400">{seller.orders} orders · ★ {seller.rating}</p>
                </div>
                <span className="font-bold text-primary">{seller.revenue}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        <div className="card">
          <h2 className="font-bold text-white mb-4">Recent Orders</h2>
          <div className="space-y-2">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center gap-3 p-3 bg-surface rounded-xl">
                <div className="flex-1">
                  <p className="font-mono text-sm text-white">{order.id}</p>
                  <p className="text-xs text-gray-400">{order.customer} · {order.date}</p>
                </div>
                <span className={`text-xs font-medium ${STATUS_COLORS[order.status]}`}>{order.status}</span>
                <span className="font-bold text-primary text-sm">{order.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
