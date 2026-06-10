import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Rahul Sharma',
    location: 'Ranchi',
    rating: 5,
    text: "Best camera store in Ranchi! Got my Canon EOS R50 at an unbeatable price. Genuine product, fast delivery. The staff is very knowledgeable and helped me pick the right lens too.",
    avatar: 'RS',
    date: '2 weeks ago',
    product: 'Canon EOS R50',
  },
  {
    id: 2,
    name: 'Priya Mehta',
    location: 'Jamshedpur',
    rating: 5,
    text: "Ordered a second-hand Nikon D7500. It was in excellent condition, exactly as described. Delivery was quick and packaging was safe. Will definitely order again from DSLR WORLD!",
    avatar: 'PM',
    date: '1 month ago',
    product: 'Nikon D7500 (Used)',
  },
  {
    id: 3,
    name: 'Aakash Verma',
    location: 'Dhanbad',
    rating: 5,
    text: "Amazing experience! The team helped me through WhatsApp to choose between Sony A7C and A6700. Got the best deal in all of Jharkhand. 100% genuine product. Highly recommended! 📷",
    avatar: 'AV',
    date: '3 weeks ago',
    product: 'Sony A7C',
  },
];

export const Testimonials: React.FC = () => (
  <section className="max-w-7xl mx-auto px-4 py-16">
    <div className="text-center mb-12">
      <h2 className="font-poppins font-bold text-2xl sm:text-3xl text-midnight mb-3">
        What Our Customers Say
      </h2>
      <div className="flex items-center justify-center gap-2 mb-2">
        <div className="flex">
          {[1,2,3,4,5].map(i => <Star key={i} size={18} className="text-gold fill-gold" />)}
        </div>
        <span className="font-bold text-midnight">4.8</span>
        <span className="text-gray-500 text-sm">on Google (72 reviews)</span>
      </div>
      <p className="text-gray-500 text-sm">Trusted by photographers across India</p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {TESTIMONIALS.map(({ id, name, location, rating, text, avatar, date, product }, i) => (
        <motion.div
          key={id}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 p-6 relative"
        >
          <Quote size={28} className="text-accent/20 absolute top-5 right-5" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-gradient-accent rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {avatar}
            </div>
            <div>
              <p className="font-poppins font-semibold text-gray-800 text-sm">{name}</p>
              <p className="text-xs text-gray-500">{location} · {date}</p>
            </div>
          </div>
          <div className="flex gap-0.5 mb-3">
            {Array.from({ length: rating }).map((_, j) => (
              <Star key={j} size={14} className="text-gold fill-gold" />
            ))}
          </div>
          <p className="text-gray-600 text-sm leading-relaxed mb-3">"{text}"</p>
          <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-500 inline-block">
            📦 Purchased: {product}
          </div>
        </motion.div>
      ))}
    </div>
  </section>
);
