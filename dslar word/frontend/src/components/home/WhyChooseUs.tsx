import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Tag, Truck, RefreshCw } from 'lucide-react';

const USPs = [
  {
    icon: Shield,
    title: 'Genuine Products',
    description: '100% authentic cameras and accessories. Every product is verified before listing.',
    color: 'bg-blue-50 text-blue-600',
    border: 'border-blue-100',
  },
  {
    icon: Tag,
    title: 'Lowest Prices',
    description: "Ranchi's most competitive prices on new and second-hand cameras. Best deal guaranteed.",
    color: 'bg-accent/10 text-accent',
    border: 'border-accent/20',
  },
  {
    icon: Truck,
    title: 'Pan-India Delivery',
    description: 'We deliver to every corner of India. Free shipping on orders above ₹500.',
    color: 'bg-emerald-50 text-emerald-600',
    border: 'border-emerald-100',
  },
  {
    icon: RefreshCw,
    title: 'Easy Returns',
    description: '7-day return policy. Not satisfied? We\'ll make it right, no questions asked.',
    color: 'bg-amber-50 text-amber-600',
    border: 'border-amber-100',
  },
];

export const WhyChooseUs: React.FC = () => (
  <section className="bg-midnight py-16">
    <div className="max-w-7xl mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="font-poppins font-bold text-3xl text-white mb-3">
          Why Choose <span className="text-gradient-accent">DSLR WORLD</span>?
        </h2>
        <p className="text-gray-400 max-w-xl mx-auto">Ranchi's most trusted camera store since years — serving photographers across India</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {USPs.map(({ icon: Icon, title, description, color, border }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            whileHover={{ y: -4 }}
            className={`bg-white/5 backdrop-blur-sm border ${border} rounded-2xl p-6 hover:bg-white/10 transition-all duration-300`}
          >
            <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
              <Icon size={22} />
            </div>
            <h3 className="font-poppins font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
