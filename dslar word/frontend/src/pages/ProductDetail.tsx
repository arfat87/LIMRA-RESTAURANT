import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart, AlertTriangle, CheckCircle, Truck, ShieldCheck, Star, MessageSquare } from 'lucide-react';
import { productApi } from '../api/product.api';
import { reviewApi } from '../api/review.api';
import { QUERY_KEYS } from '../constants/queryKeys';
import { useCartStore } from '../store/cartStore';
import { useWishlistStore } from '../store/wishlistStore';
import { useAuthStore } from '../store/authStore';
import { ConditionBadge } from '../components/ui/Badge';
import { Rating } from '../components/ui/Rating';
import { Button } from '../components/ui/Button';
import { PageSpinner } from '../components/ui/Spinner';
import { formatPrice } from '../utils/formatCurrency';
import { userApi } from '../api/user.api';
import { ROUTES } from '../constants/routes';
import toast from 'react-hot-toast';
import type { Review } from '../types/product.types';

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem, openCart } = useCartStore();
  const { toggle, has } = useWishlistStore();

  const [selectedImage, setSelectedImage] = useState(0);
  const [pincode, setPincode] = useState('');
  const [serviceability, setServiceability] = useState<{ serviceable: boolean } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.PRODUCT(slug!),
    queryFn: () => productApi.getProduct(slug!).then((r) => r.data.data!),
    enabled: !!slug,
  });

  if (isLoading) return <PageSpinner />;
  if (isError || !data) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <p className="text-6xl mb-4">😢</p>
      <h2 className="font-poppins font-bold text-xl text-midnight mb-2">Product not found</h2>
      <Button onClick={() => navigate(ROUTES.SHOP)}>Back to Shop</Button>
    </div>
  );

  const product = data;
  const isWishlisted = has(product.id);
  const discount = product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      mrp: product.mrp,
      image: product.images[0] || '',
      stock: product.stock,
      condition: product.condition,
      quantity: 1,
    });
    openCart();
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate(ROUTES.CHECKOUT);
  };

  const checkPincode = async () => {
    if (pincode.length !== 6) { toast.error('Enter a valid 6-digit pincode'); return; }
    try {
      const { data: res } = await userApi.checkServiceability(pincode);
      setServiceability({ serviceable: (res as { data?: { serviceable?: boolean } }).data?.serviceable ?? false });
    } catch { setServiceability({ serviceable: false }); }
  };

  return (
    <>
      <Helmet>
        <title>{product.name} | DSLR WORLD</title>
        <meta name="description" content={product.description?.slice(0, 155)} />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Image Gallery */}
          <div className="space-y-4">
            <motion.div
              key={selectedImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="aspect-square bg-gray-50 rounded-2xl overflow-hidden border border-gray-100"
            >
              <img
                src={product.images[selectedImage] || '/placeholder-camera.jpg'}
                alt={product.name}
                className="w-full h-full object-contain p-4"
              />
            </motion.div>
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImage === i ? 'border-accent' : 'border-gray-200'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ConditionBadge condition={product.condition} />
                {product.brand && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{product.brand}</span>
                )}
              </div>
              <h1 className="font-poppins font-bold text-2xl text-midnight leading-tight">{product.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Rating value={product._count?.reviews ? 4.5 : 0} size={16} showValue count={product._count?.reviews || 0} />
                <a href="#reviews" className="text-accent text-sm hover:underline">Write a review</a>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-baseline gap-3">
                <span className="font-poppins font-black text-3xl text-midnight">{formatPrice(product.price)}</span>
                {product.mrp > product.price && (
                  <>
                    <span className="text-gray-400 text-lg line-through">{formatPrice(product.mrp)}</span>
                    <span className="bg-accent text-white text-sm font-bold px-2 py-0.5 rounded-lg">{discount}% OFF</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Inclusive of all taxes</p>
            </div>

            {/* Stock */}
            {product.stock > 0 && product.stock <= 5 && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                <AlertTriangle size={15} />
                <span className="text-sm font-semibold">Only {product.stock} left in stock!</span>
              </div>
            )}
            {product.stock === 0 && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-3 py-2">
                <AlertTriangle size={15} />
                <span className="text-sm font-semibold">Out of Stock</span>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <Button
                size="lg"
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                leftIcon={<ShoppingCart size={18} />}
                className="flex-1"
              >
                Add to Cart
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="flex-1"
              >
                Buy Now
              </Button>
              <button
                onClick={() => toggle(product.id)}
                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                  isWishlisted ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 text-gray-400 hover:border-accent hover:text-accent'
                }`}
              >
                <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
              </button>
            </div>

            {/* Delivery check */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="font-semibold text-gray-700 text-sm mb-3 flex items-center gap-1.5">
                <Truck size={16} className="text-accent" />Check Delivery
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => { setPincode(e.target.value); setServiceability(null); }}
                  placeholder="Enter 6-digit pincode"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-accent outline-none"
                />
                <Button size="sm" variant="outline" onClick={checkPincode}>Check</Button>
              </div>
              {serviceability && (
                <div className={`flex items-center gap-2 mt-2 text-sm ${serviceability.serviceable ? 'text-emerald-600' : 'text-red-600'}`}>
                  {serviceability.serviceable ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {serviceability.serviceable ? 'Delivery available at this pincode!' : 'Sorry, delivery not available here.'}
                </div>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: ShieldCheck, text: 'Genuine Product', sub: '100% Authentic' },
                { icon: Truck, text: 'Free Shipping', sub: 'On orders above ₹500' },
              ].map(({ icon: Icon, text, sub }) => (
                <div key={text} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <Icon size={18} className="text-accent" />
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{text}</p>
                    <p className="text-[10px] text-gray-500">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            {product.description && (
              <div>
                <h2 className="font-poppins font-bold text-gray-800 mb-2">Description</h2>
                <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <ReviewsSection productId={product.id} />
      </div>
    </>
  );
};

// ─── Reviews Section Component ────────────────────────────────────────────────
const ReviewsSection: React.FC<{ productId: string }> = ({ productId }) => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => reviewApi.getProductReviews(productId).then((r) => r.data.data),
  });

  const reviews: Review[] = (data as { reviews?: Review[] })?.reviews || [];
  const avgRating: number = (data as { avgRating?: number })?.avgRating || 0;

  const addMutation = useMutation({
    mutationFn: () => reviewApi.addReview(productId, { rating, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', productId] });
      setRating(0);
      setComment('');
      toast.success('Review submitted!');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to submit review');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast.error('Please select a rating'); return; }
    addMutation.mutate();
  };

  return (
    <div id="reviews" className="mt-12 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <MessageSquare size={22} className="text-accent" />
        <h2 className="font-poppins font-bold text-xl text-midnight">Customer Reviews</h2>
        {reviews.length > 0 && (
          <span className="text-sm text-gray-500">({reviews.length})</span>
        )}
      </div>

      {/* Average Rating */}
      {reviews.length > 0 && (
        <div className="flex items-center gap-4 bg-white rounded-2xl shadow-card p-5 mb-6">
          <div className="text-center">
            <p className="font-poppins font-black text-5xl text-midnight">{avgRating.toFixed(1)}</p>
            <Rating value={avgRating} size={18} />
            <p className="text-xs text-gray-500 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => Math.round(r.rating) === star).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-4 text-right">{star}</span>
                  <Star size={10} className="text-gold fill-gold" />
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl shadow-card p-5 animate-pulse h-24" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-10 text-center mb-6">
          <Star size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No reviews yet</p>
          <p className="text-gray-400 text-sm mt-1">Be the first to review this product!</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-accent to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">{review.user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{review.user.name}</p>
                      <Rating value={review.rating} size={13} />
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-gray-600 text-sm mt-2 leading-relaxed">{review.comment}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Write Review Form */}
      {user ? (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="font-poppins font-semibold text-gray-800 mb-4">Write a Review</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Your Rating <span className="text-accent">*</span></label>
              <Rating value={rating} size={28} interactive onChange={setRating} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Share your experience with this product..."
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-none outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
              />
            </div>
            <Button type="submit" loading={addMutation.isPending}>Submit Review</Button>
          </form>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
          <p className="text-gray-600 mb-3">Please log in to write a review</p>
          <Link to={ROUTES.LOGIN}>
            <Button variant="outline">Login to Review</Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
