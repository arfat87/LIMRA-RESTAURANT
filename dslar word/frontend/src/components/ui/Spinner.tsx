import { motion } from 'framer-motion';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className={`${sizes[size]} ${className}`}
    >
      {/* Aperture-inspired loader */}
      <svg viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="25" cy="25" r="20" stroke="#E9456020" strokeWidth="4" />
        <path
          d="M25 5 A20 20 0 0 1 45 25"
          stroke="#E94560"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="25" cy="25" r="6" fill="#E9456040" />
        <circle cx="25" cy="25" r="3" fill="#E94560" />
      </svg>
    </motion.div>
  );
};

import React from 'react';

export const PageSpinner: React.FC = () => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <div className="flex flex-col items-center gap-4">
      <Spinner size="lg" />
      <p className="text-gray-500 text-sm font-inter">Loading...</p>
    </div>
  </div>
);
