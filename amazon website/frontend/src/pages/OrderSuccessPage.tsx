import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Package, ArrowRight, Home } from 'lucide-react'
import confetti from 'canvas-confetti'

export default function OrderSuccessPage() {
  const orderNumber = `MP-${Date.now().toString().slice(-8)}`

  useEffect(() => {
    const fire = () => {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.5 },
        colors: ['#FF9900', '#FFD814', '#FFFFFF'],
      })
    }
    const timer = setTimeout(fire, 300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="max-w-md w-full text-center"
      >
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 15 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full animate-pulse-slow" />
            <CheckCircle2 size={96} className="text-green-400 relative" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <h1 className="text-3xl font-black text-white mb-2">Order Placed! 🎉</h1>
          <p className="text-gray-400 mb-6">
            Thank you for your purchase. Your order has been confirmed and is being processed.
          </p>

          <div className="bg-[#0d1117] rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-400 mb-1">Order Number</p>
            <p className="text-2xl font-mono font-bold text-primary">{orderNumber}</p>
          </div>

          {/* Tracking steps */}
          <div className="text-left mb-6">
            <p className="text-sm font-semibold text-gray-300 mb-3">What happens next?</p>
            <div className="space-y-3">
              {[
                { step: 1, label: 'Order Confirmed', done: true, desc: 'We\'ve received your order' },
                { step: 2, label: 'Processing', done: false, desc: 'Your items are being prepared' },
                { step: 3, label: 'Shipped', done: false, desc: 'Your order is on its way' },
                { step: 4, label: 'Delivered', done: false, desc: 'Expected in 3-5 business days' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    s.done ? 'bg-green-500 text-white' : 'bg-surface border border-border text-gray-600'
                  }`}>
                    {s.done ? <CheckCircle2 size={14} /> : <span className="text-xs">{s.step}</span>}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${s.done ? 'text-green-400' : 'text-gray-300'}`}>{s.label}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Link to="/orders" className="w-full btn-primary flex items-center justify-center gap-2 py-3">
              <Package size={18} />
              Track My Order
              <ArrowRight size={16} />
            </Link>
            <Link to="/" className="w-full btn-secondary flex items-center justify-center gap-2 py-3">
              <Home size={18} />
              Back to Home
            </Link>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            A confirmation email has been sent to your registered email address.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
