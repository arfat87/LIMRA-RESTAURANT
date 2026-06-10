import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Check, CreditCard, MapPin, ShoppingBag } from 'lucide-react';
import { orderApi } from '../api/order.api';
import { userApi } from '../api/user.api';
import { QUERY_KEYS } from '../constants/queryKeys';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../utils/formatCurrency';
import { initiateRazorpayPayment } from '../utils/razorpay';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { INDIAN_STATES } from '../constants/indianStates';
import { ROUTES } from '../constants/routes';
import type { Address } from '../types/order.types';
import toast from 'react-hot-toast';

const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().regex(/^\d{10}$/),
  line1: z.string().min(5),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
});
type AddressForm = z.infer<typeof addressSchema>;

const STEPS = ['Address', 'Review Order', 'Payment'];

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const sub = subtotal();
  const shipping = sub >= 50000 ? 0 : 4900;
  const total = sub + shipping;

  const { data: addresses, refetch: refetchAddresses } = useQuery({
    queryKey: [QUERY_KEYS.ADDRESSES],
    queryFn: () => userApi.getAddresses().then((r) => r.data.data || []),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
  });

  const saveAddress = async (data: AddressForm) => {
    await userApi.addAddress({ ...data, isDefault: false });
    await refetchAddresses();
    setAddingNew(false);
    toast.success('Address saved!');
  };

  const placeOrder = async () => {
    if (!selectedAddressId) { toast.error('Please select a delivery address'); return; }
    setIsPlacingOrder(true);
    try {
      const { data: res } = await orderApi.placeOrder({ addressId: selectedAddressId });
      const order = res.data!;

      await initiateRazorpayPayment({
        orderId: order.id,
        userName: user!.name,
        userEmail: user!.email,
        userPhone: user!.phone,
        onSuccess: (verifiedOrderId) => {
          clearCart();
          toast.success('Payment successful! Order placed! 🎉');
          navigate(ROUTES.ORDER_DETAIL(verifiedOrderId));
        },
        onDismiss: () => toast.error('Payment cancelled'),
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (items.length === 0) {
    navigate(ROUTES.CART);
    return null;
  }

  return (
    <>
      <Helmet><title>Checkout | DSLR WORLD</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-poppins font-bold text-2xl text-midnight mb-6">Checkout</h1>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step ? 'bg-emerald-500 text-white' :
                  i === step ? 'bg-accent text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {i < step ? <Check size={14} /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${i === step ? 'text-midnight' : 'text-gray-400'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 transition-all ${i < step ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main */}
          <div className="flex-1">
            {/* Step 0: Address */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-poppins font-bold text-lg text-midnight flex items-center gap-2">
                  <MapPin size={20} className="text-accent" />Select Delivery Address
                </h2>
                {(addresses as Address[])?.map((addr) => (
                  <motion.label
                    key={addr.id}
                    whileHover={{ scale: 1.01 }}
                    className={`flex items-start gap-3 p-4 bg-white rounded-2xl shadow-card border-2 cursor-pointer transition-all ${
                      selectedAddressId === addr.id ? 'border-accent' : 'border-transparent'
                    }`}
                  >
                    <input type="radio" name="address" value={addr.id}
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="mt-1 accent-accent"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-800">{addr.fullName}</p>
                        {addr.isDefault && <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-bold">Default</span>}
                      </div>
                      <p className="text-sm text-gray-600">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                      <p className="text-sm text-gray-600">{addr.city}, {addr.state} {addr.pincode}</p>
                      <p className="text-sm text-gray-500 mt-0.5">📞 {addr.phone}</p>
                    </div>
                  </motion.label>
                ))}

                {!addingNew ? (
                  <button onClick={() => setAddingNew(true)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-accent font-semibold text-sm hover:border-accent transition-colors">
                    + Add New Address
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl shadow-card p-5">
                    <h3 className="font-poppins font-bold text-gray-800 mb-4">New Address</h3>
                    <form onSubmit={handleSubmit(saveAddress)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input label="Full Name" required error={errors.fullName?.message} {...register('fullName')} />
                      <Input label="Phone" required error={errors.phone?.message} {...register('phone')} />
                      <Input label="Address Line 1" required error={errors.line1?.message} className="sm:col-span-2" {...register('line1')} />
                      <Input label="Address Line 2 (Optional)" error={errors.line2?.message} className="sm:col-span-2" {...register('line2')} />
                      <Input label="City" required error={errors.city?.message} {...register('city')} />
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1.5 block font-poppins">State <span className="text-accent">*</span></label>
                        <select {...register('state')} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none">
                          <option value="">Select State</option>
                          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <Input label="Pincode" required maxLength={6} error={errors.pincode?.message} {...register('pincode')} />
                      <div className="sm:col-span-2 flex gap-2 justify-end">
                        <Button type="button" variant="ghost" onClick={() => setAddingNew(false)}>Cancel</Button>
                        <Button type="submit" loading={isSubmitting}>Save Address</Button>
                      </div>
                    </form>
                  </div>
                )}

                <Button fullWidth size="lg" disabled={!selectedAddressId && !addingNew} onClick={() => setStep(1)}>
                  Continue to Review
                </Button>
              </div>
            )}

            {/* Step 1: Review */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-poppins font-bold text-lg text-midnight flex items-center gap-2">
                  <ShoppingBag size={20} className="text-accent" />Review Your Order
                </h2>
                <div className="bg-white rounded-2xl shadow-card divide-y divide-gray-100">
                  {items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3 p-4">
                      <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-bold text-midnight text-sm">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
                  <Button fullWidth size="lg" onClick={() => setStep(2)}>Continue to Payment</Button>
                </div>
              </div>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-poppins font-bold text-lg text-midnight flex items-center gap-2">
                  <CreditCard size={20} className="text-accent" />Payment
                </h2>
                <div className="bg-white rounded-2xl shadow-card p-6 text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CreditCard size={28} className="text-blue-600" />
                  </div>
                  <h3 className="font-poppins font-bold text-midnight mb-2">Secure Payment via Razorpay</h3>
                  <p className="text-gray-500 text-sm mb-4">Pay using UPI, Credit/Debit Card, Net Banking, or Wallets</p>
                  <div className="flex justify-center gap-4 mb-6 text-xs text-gray-400">
                    {['UPI', 'Credit Card', 'Debit Card', 'Net Banking'].map((m) => (
                      <span key={m} className="bg-gray-100 px-2 py-1 rounded-lg font-medium">{m}</span>
                    ))}
                  </div>
                  <p className="text-xl font-black text-midnight font-poppins mb-1">{formatPrice(total)}</p>
                  <p className="text-xs text-gray-400 mb-6">Total amount to pay (incl. all taxes)</p>
                  <Button fullWidth size="lg" loading={isPlacingOrder} onClick={placeOrder}
                    leftIcon={<CreditCard size={16} />}>
                    Pay {formatPrice(total)} Securely
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24">
              <h3 className="font-poppins font-bold text-gray-800 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm border-b border-gray-100 pb-4 mb-4">
                <div className="flex justify-between text-gray-600"><span>Subtotal ({items.length} items)</span><span>{formatPrice(sub)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Shipping</span><span className={shipping === 0 ? 'text-emerald-600 font-bold' : ''}>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span></div>
              </div>
              <div className="flex justify-between font-bold text-midnight text-base"><span>Total</span><span>{formatPrice(total)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Checkout;
