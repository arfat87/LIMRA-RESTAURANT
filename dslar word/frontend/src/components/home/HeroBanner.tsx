import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, Shield, Truck } from 'lucide-react';
import { Button } from '../ui/Button';
import { ROUTES } from '../../constants/routes';

const slides = [
  {
    id: 1,
    badge: '⚡ Mega Sale — Up to 40% Off',
    title: 'India का सबसे सस्ता',
    subtitle: 'Camera Store',
    description: 'New & Second-Hand DSLRs, Mirrorless, Lenses & Accessories — Pan-India Delivery',
    cta: 'Shop Now',
    ctaLink: ROUTES.SHOP,
    secondCta: 'View Deals',
    secondCtaLink: `${ROUTES.SHOP}?sort=price_asc`,
    accent: 'Lowest Prices in Ranchi',
    gradient: 'from-[#1A1A2E] via-[#16213E] to-[#0F3460]',
    highlight: '#E94560',
  },
  {
    id: 2,
    badge: '📷 Certified Second-Hand',
    title: 'Quality Cameras',
    subtitle: 'at Half the Price',
    description: 'Thoroughly tested second-hand DSLRs and mirrorless cameras with 30-day warranty',
    cta: 'Explore Used',
    ctaLink: `${ROUTES.SHOP}?condition=SECOND_HAND`,
    secondCta: 'Learn More',
    secondCtaLink: ROUTES.SHOP,
    accent: 'Inspected & Verified',
    gradient: 'from-[#0F3460] via-[#16213E] to-[#1A1A2E]',
    highlight: '#F5A623',
  },
  {
    id: 3,
    badge: '🚚 Free Shipping',
    title: 'Delivered to Your',
    subtitle: 'Doorstep',
    description: 'Free shipping on orders above ₹500. Delivered across India via Shiprocket',
    cta: 'Order Now',
    ctaLink: ROUTES.SHOP,
    secondCta: 'Track Order',
    secondCtaLink: ROUTES.ORDERS,
    accent: 'Pan-India Delivery',
    gradient: 'from-[#16213E] via-[#1A1A2E] to-[#0F3460]',
    highlight: '#28A745',
  },
];

const TRUST_BADGES = [
  { icon: Star, text: '4.8★ Rated', sub: '72 Reviews' },
  { icon: Shield, text: 'Genuine Products', sub: '100% Authentic' },
  { icon: Truck, text: 'Pan-India Delivery', sub: 'Fast Shipping' },
];

export const HeroBanner: React.FC = () => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const go = (idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
  };

  const slide = slides[current];

  return (
    <section className="relative overflow-hidden">
      <div className={`relative min-h-[500px] sm:min-h-[600px] bg-gradient-to-br ${slide.gradient} transition-all duration-1000`}>
        {/* Decorative grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />

        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-20 flex flex-col lg:flex-row items-center gap-10">
          {/* Text content */}
          <div className="flex-1 text-white text-center lg:text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, x: direction * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -direction * 40 }}
                transition={{ duration: 0.4 }}
              >
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm text-gray-200 mb-6">
                  {slide.badge}
                </div>

                <h1 className="font-poppins font-black text-4xl sm:text-5xl lg:text-6xl leading-tight mb-2">
                  <span className="font-devanagari">{slide.title}</span>
                  <br />
                  <span className="text-gradient-accent">{slide.subtitle}</span>
                </h1>

                <p className="text-gray-300 text-base sm:text-lg mt-4 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  {slide.description}
                </p>

                <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-8">
                  <Link to={slide.ctaLink}>
                    <Button size="lg" variant="primary">
                      {slide.cta}
                    </Button>
                  </Link>
                  <Link to={slide.secondCtaLink}>
                    <Button size="lg" variant="outline" className="!border-white/40 !text-white hover:!bg-white/10 hover:!text-white">
                      {slide.secondCta}
                    </Button>
                  </Link>
                </div>

                <div className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {slide.accent}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Camera illustration */}
          <div className="hidden lg:flex flex-1 items-center justify-center">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, type: 'spring' }}
              className="relative"
            >
              <div className="w-72 h-72 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 flex items-center justify-center shadow-2xl">
                <svg viewBox="0 0 200 200" className="w-48 h-48 opacity-90" fill="none">
                  {/* Camera body */}
                  <rect x="20" y="65" width="160" height="110" rx="16" fill="#E94560" fillOpacity="0.3" stroke="#E94560" strokeWidth="2" />
                  {/* Viewfinder bump */}
                  <rect x="55" y="45" width="90" height="30" rx="8" fill="#E94560" fillOpacity="0.2" stroke="#E94560" strokeWidth="2" />
                  {/* Lens outer */}
                  <circle cx="100" cy="115" r="38" fill="#1A1A2E" stroke="#E94560" strokeWidth="3" />
                  {/* Lens inner rings */}
                  <circle cx="100" cy="115" r="30" fill="#0F3460" stroke="#E94560" strokeWidth="1.5" />
                  <circle cx="100" cy="115" r="20" fill="#16213E" stroke="#E9456080" strokeWidth="1" />
                  <circle cx="100" cy="115" r="10" fill="#E94560" />
                  {/* Flash */}
                  <rect x="30" y="75" width="22" height="14" rx="4" fill="#F5A623" fillOpacity="0.8" />
                  {/* Shutter button */}
                  <circle cx="150" cy="55" r="8" fill="#F5A623" />
                </svg>
              </div>
              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-4 -right-4 bg-accent text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-accent"
              >
                ⭐ 4.8 Rated
              </motion.div>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity }}
                className="absolute -bottom-4 -left-4 bg-white text-midnight text-xs font-bold px-3 py-1.5 rounded-xl shadow-card"
              >
                🏆 Best Price
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Slider controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <button onClick={() => go((current - 1 + slides.length) % slides.length)}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
            <ChevronLeft size={16} className="text-white" />
          </button>
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => go(i)}
                className={`transition-all duration-300 rounded-full ${i === current ? 'w-6 h-2 bg-accent' : 'w-2 h-2 bg-white/40'}`} />
            ))}
          </div>
          <button onClick={() => go((current + 1) % slides.length)}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
            <ChevronRight size={16} className="text-white" />
          </button>
        </div>
      </div>

      {/* Trust badges bar */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 grid grid-cols-3 divide-x divide-gray-100">
          {TRUST_BADGES.map(({ icon: Icon, text, sub }) => (
            <div key={text} className="flex items-center justify-center gap-2 px-4">
              <Icon size={18} className="text-accent flex-shrink-0" />
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-midnight">{text}</p>
                <p className="text-[10px] text-gray-500">{sub}</p>
              </div>
              <span className="text-xs font-semibold text-midnight sm:hidden">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
