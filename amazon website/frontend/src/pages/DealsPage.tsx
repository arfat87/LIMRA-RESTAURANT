import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Clock } from 'lucide-react'
import { mockFlashDeals, mockProducts } from '@/data/mockData'
import ProductCard from '@/components/cards/ProductCard'

function useCountdown(target: string) {
  const [t, setT] = useState({ h: 0, m: 0, s: 0 })
  useEffect(() => {
    const update = () => {
      const diff = new Date(target).getTime() - Date.now()
      if (diff <= 0) { setT({ h: 0, m: 0, s: 0 }); return }
      setT({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) })
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [target])
  return t
}

export default function DealsPage() {
  const midnight = new Date(); midnight.setHours(23, 59, 59, 999)
  const timer = useCountdown(midnight.toISOString())

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-r from-red-900/30 via-primary/20 to-red-900/30 border border-primary/30 rounded-2xl p-8 mb-10 text-center">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-5" />
        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Zap className="text-primary animate-pulse" size={28} />
            <h1 className="text-4xl md:text-5xl font-black text-white">Today's Deals</h1>
            <Zap className="text-primary animate-pulse" size={28} />
          </div>
          <p className="text-gray-300 text-lg mb-4">Lightning deals — limited quantities at unbeatable prices!</p>

          {/* Countdown */}
          <div className="inline-flex items-center gap-4 bg-black/40 backdrop-blur rounded-xl px-6 py-3">
            <Clock size={18} className="text-primary" />
            <span className="text-gray-300 text-sm">Deals reset in:</span>
            <div className="flex items-center gap-1">
              {[
                { v: timer.h, l: 'Hours' },
                { v: timer.m, l: 'Min' },
                { v: timer.s, l: 'Sec' },
              ].map(({ v, l }, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="bg-primary/20 border border-primary/40 rounded-lg px-3 py-2 text-center">
                    <p className="text-2xl font-black text-primary font-mono">{String(v).padStart(2, '0')}</p>
                    <p className="text-[9px] text-gray-400">{l}</p>
                  </div>
                  {i < 2 && <span className="text-primary text-xl font-bold">:</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Flash deals grid */}
      <h2 className="section-title mb-6 flex items-center gap-2">
        <Zap className="text-primary" size={24} />
        Flash Deals
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {mockFlashDeals.map(deal => {
          const percent = Math.round((deal.sold_count / deal.total_quantity) * 100)
          return (
            <motion.div
              key={deal.id}
              whileHover={{ y: -4 }}
              className="card hover:border-primary/50"
            >
              <Link to={`/product/${deal.product.id}`}>
                <div className="relative mb-3">
                  <img src={deal.product.images?.[0]?.url} alt={deal.product.title} className="w-full h-32 object-cover rounded-lg" />
                  <div className="absolute top-2 left-2 badge bg-red-600 text-white font-bold">
                    -{deal.discount_percentage}%
                  </div>
                </div>
                <p className="text-sm text-white font-medium line-clamp-2 mb-2">{deal.product.title}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-primary font-bold">${deal.deal_price.toFixed(2)}</span>
                  <span className="text-gray-500 text-xs line-through">${deal.original_price.toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-[#0d1117] rounded-full overflow-hidden mb-1">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1 }}
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                  />
                </div>
                <p className="text-xs text-gray-500">{deal.sold_count}/{deal.total_quantity} sold</p>
              </Link>
            </motion.div>
          )
        })}
      </div>

      {/* More deals */}
      <h2 className="section-title mb-6">More Deals</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {mockProducts.filter(p => p.compare_price).map(p => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  )
}
