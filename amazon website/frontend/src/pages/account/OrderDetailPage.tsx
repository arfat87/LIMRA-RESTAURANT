import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Check, Truck, Home, MapPin, ShoppingBag } from 'lucide-react'

const TRACKING_STEPS = [
  { id: 1, label: 'Order Placed', icon: ShoppingBag, desc: 'Your order has been received', time: 'May 15, 2024 9:00 AM' },
  { id: 2, label: 'Confirmed', icon: Check, desc: 'Order confirmed by seller', time: 'May 15, 2024 10:30 AM' },
  { id: 3, label: 'Shipped', icon: Package, desc: 'Your package is on its way', time: 'May 16, 2024 2:00 PM' },
  { id: 4, label: 'Out for Delivery', icon: Truck, desc: 'With delivery agent', time: 'May 18, 2024 8:00 AM' },
  { id: 5, label: 'Delivered', icon: Home, desc: 'Package delivered', time: '' },
]

const mockOrder = {
  id: 'ORD-20240515-002',
  date: '2024-05-15',
  status: 'shipped',
  currentStep: 3,
  items: [
    { title: 'Smart Watch Pro', image: 'https://picsum.photos/seed/prod25/100/100', price: 199.99, qty: 1 },
  ],
  address: { name: 'John Doe', line: '123 Main St, New York, NY 10001', phone: '+1 234 567 8900' },
  subtotal: 199.99,
  shipping: 0,
  tax: 16,
  total: 215.99,
  tracking: 'MP1234567890US',
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const order = mockOrder

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white font-mono">{id || order.id}</h1>
            <p className="text-gray-400 text-sm">Placed on {order.date}</p>
          </div>
          <div>
            <span className="badge bg-blue-500/20 text-blue-400 border border-blue-500/30 text-sm px-3 py-1">
              Shipped
            </span>
          </div>
        </div>
        {order.tracking && (
          <div className="mt-3 p-2 bg-surface rounded-lg">
            <span className="text-xs text-gray-400">Tracking: </span>
            <span className="text-sm font-mono text-primary">{order.tracking}</span>
          </div>
        )}
      </div>

      {/* Tracking timeline */}
      <div className="card mb-6">
        <h2 className="font-bold text-white mb-6">Order Tracking</h2>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />
          {/* Progress line */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${((order.currentStep - 1) / (TRACKING_STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            className="absolute left-5 top-5 w-0.5 bg-primary"
          />

          <div className="space-y-6 relative">
            {TRACKING_STEPS.map((step, i) => {
              const done = i + 1 <= order.currentStep
              const current = i + 1 === order.currentStep
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="flex gap-4 items-start"
                >
                  <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500 ${
                    done ? 'bg-primary border-primary' :
                    current ? 'border-primary bg-primary/20 animate-pulse' :
                    'bg-surface border-border'
                  }`}>
                    <step.icon size={16} className={done ? 'text-secondary' : current ? 'text-primary' : 'text-gray-600'} />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className={`font-semibold ${done ? 'text-white' : 'text-gray-500'}`}>{step.label}</p>
                    <p className={`text-sm ${done ? 'text-gray-400' : 'text-gray-600'}`}>{step.desc}</p>
                    {step.time && done && (
                      <p className="text-xs text-primary mt-0.5">{step.time}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Items */}
        <div className="card">
          <h2 className="font-bold text-white mb-4">Order Items</h2>
          <div className="space-y-3">
            {order.items.map((item, i) => (
              <div key={i} className="flex gap-3">
                <img src={item.image} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                <div>
                  <p className="font-medium text-white text-sm">{item.title}</p>
                  <p className="text-xs text-gray-400">Qty: {item.qty}</p>
                  <p className="text-primary font-bold">${item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Delivery address */}
          <div className="card">
            <h2 className="font-bold text-white mb-3 flex items-center gap-2">
              <MapPin size={18} className="text-primary" /> Delivery Address
            </h2>
            <p className="text-white font-medium">{order.address.name}</p>
            <p className="text-gray-400 text-sm">{order.address.line}</p>
            <p className="text-gray-400 text-sm">{order.address.phone}</p>
          </div>

          {/* Price breakdown */}
          <div className="card">
            <h2 className="font-bold text-white mb-3">Price Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-400">Subtotal</span><span className="text-white">${order.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Shipping</span><span className="text-green-400">FREE</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-400">Tax</span><span className="text-white">${order.tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-2">
                <span className="text-white">Total</span>
                <span className="text-primary">${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
