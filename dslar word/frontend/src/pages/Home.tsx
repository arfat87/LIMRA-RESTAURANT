import React from 'react';
import { Helmet } from 'react-helmet-async';
import { HeroBanner } from '../components/home/HeroBanner';
import { CategoryStrip } from '../components/home/CategoryStrip';
import { FeaturedProducts } from '../components/home/FeaturedProducts';
import { WhyChooseUs } from '../components/home/WhyChooseUs';
import { Testimonials } from '../components/home/Testimonials';
import { StoreInfo } from '../components/home/StoreInfo';

const Home: React.FC = () => (
  <>
    <Helmet>
      <title>DSLR WORLD — India's Best Camera Store | Ranchi, Jharkhand</title>
      <meta name="description" content="Buy new and second-hand DSLR cameras, mirrorless cameras, lenses and accessories at the lowest prices in India. Pan-India delivery. DSLR WORLD, Ranchi, Jharkhand." />
      <meta property="og:title" content="DSLR WORLD — Lowest Camera Prices in India" />
      <meta property="og:description" content="New & second-hand cameras, DSLRs, lenses and accessories at unbeatable prices. Free delivery across India." />
    </Helmet>
    <HeroBanner />
    <CategoryStrip />
    <FeaturedProducts />
    <WhyChooseUs />
    <Testimonials />
    <StoreInfo />
  </>
);

export default Home;
