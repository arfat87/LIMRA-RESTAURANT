import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { DollarSign, Package, ShoppingBag, Star, TrendingUp, AlertTriangle } from 'lucide-react'

const revenueData = [
  { month: 'Jan', revenue: 4200, orders: 38 },
  { month: 'Feb', revenue: 5800, orders: 52 },
  { month: 'Mar', revenue: 4900, orders: 44 },
  { month: 'Apr', revenue: 7200, orders: 65 },
  { month: 'May', revenue: 8900, orders: 80 },
  { month: 'Jun', revenue: 6700, orders: 60 },
  { month: 'Jul', revenue: 9500, orders: 86 },
]

const mockSellerStats = [
  { label: 'Total Revenue', value: '$47,200', icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', delta: '+12.5%' },
  { label: 'Total Orders', value: '425', icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', delta: '+8.3%' },
  { label: 'Active Products', value: '48', icon: Package, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', delta: '+3' },
  { label: 'Seller Rating', value: '4.8★', icon: Star, color: 'text-accent', bg: 'bg-accent/10 border-accent/20', delta: '2,340 reviews' },
]

const recentOrders = [
  { id: 'ORD-501', customer: 'Alex Johnson', product: 'Wireless Headphones', amount: 89.99, status: 'shipped' },
  { id: 'ORD-502', customer: 'Sarah M.', product: 'Smart Watch Pro', amount: 199.99, status: 'processing' },
  { id: 'ORD-503', customer: 'Mike D.', product: 'Gaming Keyboard', amount: 119.99, status: 'delivered' },
  { id: 'ORD-504', customer: 'Emily R.', product: 'Action Camera 4K', amount: 229.99, status: 'pending' },
]

const lowStockProducts = [
  { title: 'Wireless Pro Headphones', stock: 3, threshold: 10 },
  { title: 'Charging Pad', stock: 2, threshold: 5 },
  { title: 'Smart Watch Pro', stock: 7, threshold: 15 },
]

const STATUS_COLORS: Record<string, string> = {
  delivered: 'text-green-400',
  shipped: 'text-blue-400',
  processing: 'text-yellow-400',
  pending: 'text-gray-400',
}

export default function SellerDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Seller Dashboard</h1>
          <p className="text-gray-400">Welcome back! Here's your business overview.</p>
        </div>
        <div className="flex gap-3">
          <a href="/seller/products/add" className="btn-primary">+ Add Product</a>
          <a href="/seller/products" className="btn-secondary">Manage Products</a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {mockSellerStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`card border ${stat.bg}`}
          >
            <div className="flex justify-between items-start">
              <stat.icon size={24} className={stat.color} />
              <span className="text-xs text-green-400 font-medium">{stat.delta}</span>
            </div>
            <p className="text-2xl font-black text-white mt-3">{stat.value}</p>
            <p className="text-xs text-gray-400">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" /> Revenue Overview
            </h2>
            <select className="input text-xs py-1 w-auto">
              <option>Last 7 months</option>
              <option>Last 3 months</option>
              <option>This year</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis stroke="#6b7280" tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
                formatter={(v: any) => [`$${v.toLocaleString()}`, 'Revenue']}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#FF9900" strokeWidth={3} dot={{ fill: '#FF9900', r: 5 }} activeDot={{ r: 7 }} name="Revenue ($)" />
              <Line type="monotone" dataKey="orders" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 4 }} name="Orders" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Low stock alerts */}
        <div className="card">
          <h2 className="font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-400" /> Low Stock Alerts
          </h2>
          <div className="space-y-3">
            {lowStockProducts.map((p, i) => (
              <div key={i} className="p-3 bg-[#0d1117] border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-white font-medium line-clamp-1">{p.title}</p>
                <div className="flex justify-between items-center mt-1">
                  <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden mr-2">
                    <div
                      className="h-full bg-yellow-500 rounded-full"
                      style={{ width: `${(p.stock / p.threshold) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-yellow-400 font-bold">{p.stock} left</span>
                </div>
              </div>
            ))}
            <a href="/seller/products" className="block text-center text-xs text-primary hover:underline mt-2">
              Manage Inventory →
            </a>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-white">Recent Orders</h2>
          <a href="/seller/orders" className="text-xs text-primary hover:underline">View All →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 text-xs text-gray-400 font-medium">Order ID</th>
                <th className="pb-3 text-xs text-gray-400 font-medium">Customer</th>
                <th className="pb-3 text-xs text-gray-400 font-medium">Product</th>
                <th className="pb-3 text-xs text-gray-400 font-medium">Amount</th>
                <th className="pb-3 text-xs text-gray-400 font-medium">Status</th>
                <th className="pb-3 text-xs text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map(order => (
                <tr key={order.id} className="hover:bg-surface/50 transition-colors">
                  <td className="py-3 font-mono text-sm text-white">{order.id}</td>
                  <td className="py-3 text-sm text-gray-300">{order.customer}</td>
                  <td className="py-3 text-sm text-gray-300 max-w-[150px] truncate">{order.product}</td>
                  <td className="py-3 text-sm font-bold text-primary">${order.amount.toFixed(2)}</td>
                  <td className="py-3">
                    <span className={`text-xs font-medium capitalize ${STATUS_COLORS[order.status]}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <button className="text-xs text-primary hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
