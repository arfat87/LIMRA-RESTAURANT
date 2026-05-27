import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Zap, Shield, Truck, RotateCcw, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from '@/components/cards/ProductCard'
import { mockCategories, mockFlashDeals, trendingProducts, newArrivals, featuredProducts } from '@/data/mockData'
import type { FlashDeal } from '@/types'

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}

function FlashDealCard({ deal }: { deal: FlashDeal }) {
  const timer = useCountdown(deal.ends_at)
  const percent = Math.round((deal.sold_count / deal.total_quantity) * 100)

  return (
    <motion.div
      whileHover={{ y: -6 }}
      className="min-w-[200px] w-[200px] bg-surface border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 shadow-lg"
    >
      <Link to={`/product/${deal.product.id}`}>
        <div className="relative">
          <img
            src={deal.product.images?.[0]?.url}
            alt={deal.product.title}
            className="w-full h-36 object-cover"
          />
          <div className="absolute top-2 left-2 badge bg-red-600 text-white font-bold text-sm">
            -{deal.discount_percentage}%
          </div>
        </div>
        <div className="p-3">
          <p className="text-xs text-white font-medium line-clamp-2 mb-2">{deal.product.title}</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-primary font-bold text-lg">${deal.deal_price.toFixed(2)}</span>
            <span className="text-gray-500 text-xs line-through">${deal.original_price.toFixed(2)}</span>
          </div>
          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
              <span>Sold: {deal.sold_count}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-1.5 bg-[#0d1117] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1, delay: 0.3 }}
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
              />
            </div>
          </div>
          {/* Timer */}
          <div className="flex gap-1 justify-center">
            {[
              { v: timer.hours, l: 'h' },
              { v: timer.minutes, l: 'm' },
              { v: timer.seconds, l: 's' },
            ].map(({ v, l }, i) => (
              <div key={i} className="flex items-center">
                <span className="bg-[#0d1117] border border-border text-white text-[11px] font-mono font-bold px-1.5 py-0.5 rounded">
                  {String(v).padStart(2, '0')}
                  <span className="text-[9px] text-gray-500 ml-0.5">{l}</span>
                </span>
                {i < 2 && <span className="text-primary text-xs mx-0.5">:</span>}
              </div>
            ))}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  )
}

const whyChooseUs = [
  { icon: <Truck size={28} className="text-primary" />, title: 'Fast Delivery', desc: 'Free shipping on orders over $50. Express delivery in 1-2 days.' },
  { icon: <RotateCcw size={28} className="text-primary" />, title: 'Easy Returns', desc: '30-day hassle-free returns. No questions asked.' },
  { icon: <Shield size={28} className="text-primary" />, title: 'Secure Payment', desc: '256-bit SSL encryption. Your data is always safe.' },
  { icon: <Star size={28} className="text-primary" />, title: 'Best Prices', desc: 'Price match guarantee. We beat any competitor price.' },
]

export default function HomePage() {
  const flashScrollRef = useRef<HTMLDivElement>(null)
  const [heroIndex, setHeroIndex] = useState(0)

  const heroSlides = [
    {
      title: 'Everything.',
      sub: 'Delivered Fast.',
      desc: 'Shop millions of products from top brands. Fast delivery, easy returns, unbeatable prices.',
      bg: 'from-[#131921] via-[#1a2234] to-[#232F3E]',
      cta: 'Shop Now',
      ctaLink: '/products',
      image: 'https://picsum.photos/seed/hero1/600/500',
    },
    {
      title: 'Flash Deals',
      sub: 'Up to 60% Off',
      desc: 'Limited time offers on top products. Grab them before they\'re gone!',
      bg: 'from-[#131921] via-[#2a1a00] to-[#3d2800]',
      cta: 'View Deals',
      ctaLink: '/deals',
      image: 'https://picsum.photos/seed/hero2/600/500',
    },
    {
      title: 'New Arrivals',
      sub: 'Just Dropped',
      desc: 'Be the first to discover the latest products from top sellers worldwide.',
      bg: 'from-[#131921] via-[#0d1a2a] to-[#0a2040]',
      cta: 'Explore New',
      ctaLink: '/products?new=1',
      image: 'https://picsum.photos/seed/hero3/600/500',
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => setHeroIndex(i => (i + 1) % heroSlides.length), 5000)
    return () => clearInterval(timer)
  }, [heroSlides.length])

  const scrollFlash = (dir: 'left' | 'right') => {
    if (flashScrollRef.current) {
      flashScrollRef.current.scrollBy({ left: dir === 'right' ? 220 : -220, behavior: 'smooth' })
    }
  }

  const slide = heroSlides[heroIndex]

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className={`relative overflow-hidden bg-gradient-to-r ${slide.bg} min-h-[520px] flex items-center`}>
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/30 rounded-full"
              initial={{ x: `${Math.random() * 100}%`, y: `${Math.random() * 100}%` }}
              animate={{
                x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
                y: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
              }}
              transition={{ duration: 8 + Math.random() * 8, repeat: Infinity, repeatType: 'reverse' }}
            />
          ))}
        </div>

        <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col lg:flex-row items-center gap-12 relative z-10">
          {/* Text */}
          <motion.div
            key={heroIndex}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-sm px-3 py-1 rounded-full mb-4"
            >
              <Zap size={14} />
              <span>Limited Time Offers Available</span>
            </motion.div>
            <h1 className="text-5xl md:text-7xl font-black text-white leading-none mb-2">
              {slide.title}
            </h1>
            <h2 className="text-4xl md:text-6xl font-black text-primary mb-4">
              {slide.sub}
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-lg">{slide.desc}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to={slide.ctaLink} className="btn-primary flex items-center justify-center gap-2 text-lg px-8 py-3">
                {slide.cta} <ArrowRight size={20} />
              </Link>
              <Link to="/deals" className="btn-outline flex items-center justify-center gap-2 text-lg px-8 py-3">
                Today's Deals
              </Link>
            </div>
            {/* Slide indicators */}
            <div className="flex gap-2 mt-8 justify-center lg:justify-start">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === heroIndex ? 'bg-primary w-8' : 'bg-white/30 w-4'}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Hero image */}
          <motion.div
            key={`img-${heroIndex}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <motion.img
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                src={slide.image}
                alt="Hero product"
                className="relative w-full max-w-md h-80 object-cover rounded-2xl shadow-2xl border border-primary/20"
              />
              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                className="absolute -top-4 -left-4 glass rounded-xl px-3 py-2 shadow-lg"
              >
                <p className="text-xs text-gray-400">Free Shipping</p>
                <p className="text-sm font-bold text-white">On all orders $50+</p>
              </motion.div>
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                className="absolute -bottom-4 -right-4 glass rounded-xl px-3 py-2 shadow-lg"
              >
                <p className="text-xs text-gray-400">Customer Rating</p>
                <div className="flex items-center gap-1">
                  <span className="text-accent text-sm">★★★★★</span>
                  <span className="text-white text-sm font-bold">4.9</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-primary/5 border-y border-primary/20">
        <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { val: '10M+', label: 'Products' },
            { val: '5M+', label: 'Happy Customers' },
            { val: '99.9%', label: 'Uptime' },
            { val: '2-5 Days', label: 'Average Delivery' },
          ].map((s, i) => (
            <div key={i}>
              <p className="text-2xl font-black text-primary">{s.val}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Flash Deals */}
      <AnimatedSection>
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Zap className="text-primary" size={28} />
                  Flash Deals
                </h2>
                <p className="text-gray-400 text-sm">Limited time offers — hurry before they're gone!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollFlash('left')}
                className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center hover:border-primary transition-colors"
              >
                <ChevronLeft size={18} className="text-white" />
              </button>
              <button
                onClick={() => scrollFlash('right')}
                className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center hover:border-primary transition-colors"
              >
                <ChevronRight size={18} className="text-white" />
              </button>
              <Link to="/deals" className="link text-sm flex items-center gap-1">
                View All <ArrowRight size={14} />
              </Link>
            </div>
          </div>
          <div
            ref={flashScrollRef}
            className="flex gap-4 overflow-x-auto pb-2 scroll-smooth scrollbar-hide"
          >
            {mockFlashDeals.map(deal => (
              <FlashDealCard key={deal.id} deal={deal} />
            ))}
          </div>
        </section>
      </AnimatedSection>

      {/* Categories */}
      <AnimatedSection delay={0.1}>
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-8 bg-primary rounded-full" />
            <div>
              <h2 className="section-title">Shop by Category</h2>
              <p className="text-gray-400 text-sm">Find exactly what you're looking for</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {mockCategories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.08 }}
              >
                <Link
                  to={`/category/${cat.slug}`}
                  className="flex flex-col items-center gap-2 p-4 bg-surface border border-border rounded-xl hover:border-primary/60 hover:bg-primary/5 transition-all duration-200 text-center group"
                >
                  <span className="text-3xl group-hover:scale-110 transition-transform duration-200">{cat.icon}</span>
                  <span className="text-xs text-gray-300 font-medium group-hover:text-primary transition-colors">{cat.name}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      </AnimatedSection>

      {/* Trending Products */}
      <AnimatedSection delay={0.2}>
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-primary rounded-full" />
              <div>
                <h2 className="section-title">🔥 Trending Now</h2>
                <p className="text-gray-400 text-sm">Most popular products this week</p>
              </div>
            </div>
            <Link to="/products" className="link text-sm flex items-center gap-1">
              See All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trendingProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </AnimatedSection>

      {/* Why Choose Us */}
      <AnimatedSection delay={0.1}>
        <section className="bg-[#1F2937] border-y border-border py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="section-title mb-2">Why Choose MarketPro?</h2>
              <p className="text-gray-400">We're committed to making your shopping experience exceptional</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {whyChooseUs.map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -4 }}
                  className="text-center p-6 bg-surface border border-border rounded-xl hover:border-primary/40 transition-all duration-300"
                >
                  <div className="flex justify-center mb-3">{item.icon}</div>
                  <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-400">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Featured Products */}
      <AnimatedSection delay={0.2}>
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-accent rounded-full" />
              <div>
                <h2 className="section-title">⭐ Featured Products</h2>
                <p className="text-gray-400 text-sm">Hand-picked by our team</p>
              </div>
            </div>
            <Link to="/products?featured=1" className="link text-sm flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </AnimatedSection>

      {/* New Arrivals */}
      <AnimatedSection>
        <section className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-blue-500 rounded-full" />
              <div>
                <h2 className="section-title">🆕 New Arrivals</h2>
                <p className="text-gray-400 text-sm">Fresh additions to our marketplace</p>
              </div>
            </div>
            <Link to="/products?new=1" className="link text-sm flex items-center gap-1">
              See All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {newArrivals.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </AnimatedSection>

      {/* Newsletter CTA */}
      <AnimatedSection>
        <section className="max-w-7xl mx-auto px-4 py-10 mb-6">
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="relative overflow-hidden bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-2xl p-8 md:p-12 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">
                Get Exclusive Deals 🎁
              </h2>
              <p className="text-gray-300 mb-6 max-w-md mx-auto">
                Subscribe to our newsletter and get 15% off your first order plus early access to flash deals.
              </p>
              <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" onSubmit={e => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="input flex-1"
                />
                <button type="submit" className="btn-primary whitespace-nowrap">
                  Get 15% Off
                </button>
              </form>
              <p className="text-xs text-gray-500 mt-3">No spam. Unsubscribe at any time.</p>
            </div>
          </motion.div>
        </section>
      </AnimatedSection>
    </div>
  )
}
