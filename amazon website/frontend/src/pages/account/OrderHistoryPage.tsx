import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, ChevronRight, Search, Filter } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  shipped: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  processing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  confirmed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const mockOrders = [
  { id: 'ORD-20240520-001', date: '2024-05-20', items: [{ title: 'Wireless Pro Headphones', image: 'https://picsum.photos/seed/prod10/80/80', price: 89.99 }, { title: 'Charging Pad', image: 'https://picsum.photos/seed/prod21/80/80', price: 29.99 }], total: 189.97, status: 'delivered' },
  { id: 'ORD-20240515-002', date: '2024-05-15', items: [{ title: 'Smart Watch Pro', image: 'https://picsum.photos/seed/prod25/80/80', price: 199.99 }], total: 199.99, status: 'shipped' },
  { id: 'ORD-20240510-003', date: '2024-05-10', items: [{ title: 'Ultra Gaming Laptop', image: 'https://picsum.photos/seed/prod12/80/80', price: 1299.99 }], total: 1299.99, status: 'processing' },
  { id: 'ORD-20240501-004', date: '2024-05-01', items: [{ title: 'Running Shoes', image: 'https://picsum.photos/seed/prod13/80/80', price: 79.99 }], total: 79.99, status: 'cancelled' },
  { id: 'ORD-20240425-005', date: '2024-04-25', items: [{ title: 'Mechanical Keyboard', image: 'https://picsum.photos/seed/prod19/80/80', price: 119.99 }, { title: '4K TV', image: 'https://picsum.photos/seed/prod11/80/80', price: 899.99 }], total: 1019.98, status: 'delivered' },
]

const FILTER_TABS = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

export default function OrderHistoryPage() {
  const [activeFilter, setActiveFilter] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = mockOrders.filter(o => {
    const matchesFilter = activeFilter === 'All' || o.status === activeFilter.toLowerCase()
    const matchesSearch = o.id.toLowerCase().includes(search.toLowerCase()) || o.items.some(i => i.title.toLowerCase().includes(search.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Package className="text-primary" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-white">My Orders</h1>
          <p className="text-gray-400 text-sm">{mockOrders.length} orders placed</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by order ID or product name..."
          className="input pl-9"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              activeFilter === tab ? 'bg-primary text-secondary' : 'bg-surface border border-border text-gray-400 hover:text-white'
            }`}
          >
            {tab}
            {tab !== 'All' && (
              <span className="ml-1 text-xs">
                ({mockOrders.filter(o => o.status === tab.toLowerCase()).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package size={64} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No orders found</p>
          </div>
        ) : (
          filtered.map(order => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-border">
                <div>
                  <p className="font-mono font-bold text-white">{order.id}</p>
                  <p className="text-xs text-gray-400">Placed on {order.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge border ${STATUS_COLORS[order.status]}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                  <p className="font-bold text-primary text-lg">${order.total.toFixed(2)}</p>
                </div>
              </div>

              {/* Items preview */}
              <div className="flex gap-3 mb-3">
                {order.items.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <img src={item.image} alt={item.title} className="w-14 h-14 rounded-lg object-cover" />
                    <div className="hidden sm:block">
                      <p className="text-xs text-white font-medium line-clamp-1 max-w-[150px]">{item.title}</p>
                      <p className="text-xs text-gray-500">${item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {order.items.length > 3 && (
                  <div className="w-14 h-14 rounded-lg bg-surface border border-border flex items-center justify-center">
                    <span className="text-xs text-gray-400">+{order.items.length - 3}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  to={`/orders/${order.id}`}
                  className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-2"
                >
                  View Details <ChevronRight size={14} />
                </Link>
                {order.status === 'shipped' && (
                  <Link to={`/orders/${order.id}`} className="flex-1 btn-outline text-sm py-2 text-center flex items-center justify-center gap-2">
                    <Filter size={14} /> Track Order
                  </Link>
                )}
                {order.status === 'delivered' && (
                  <button className="flex-1 btn-outline text-sm py-2">
                    Write Review
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
