import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';

const NotFound: React.FC = () => (
  <>
    <Helmet><title>Page Not Found | DSLR WORLD</title></Helmet>
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        {/* Camera SVG with 404 */}
        <div className="relative inline-block mb-8">
          <div className="w-32 h-32 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto">
            <Camera size={56} className="text-gray-300" />
          </div>
          <div className="absolute -top-3 -right-3 w-14 h-14 bg-accent rounded-2xl flex items-center justify-center">
            <span className="text-white font-poppins font-black text-lg leading-none">404</span>
          </div>
        </div>

        <h1 className="font-poppins font-black text-3xl text-midnight mb-3">Page Not Found</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Looks like this page went out of focus! The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to={ROUTES.HOME}><Button size="lg">Back to Home</Button></Link>
          <Link to={ROUTES.SHOP}><Button size="lg" variant="outline">Browse Products</Button></Link>
        </div>
      </motion.div>
    </div>
  </>
);

export default NotFound;
