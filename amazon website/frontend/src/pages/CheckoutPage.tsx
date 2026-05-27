import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, ChevronRight, MapPin, Truck, CreditCard, ClipboardCheck, Lock } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'

const STEPS = [
  { id: 1, label: 'Address', icon: MapPin },
  { id: 2, label: 'Delivery', icon: Truck },
  { id: 3, label: 'Payment', icon: CreditCard },
  { id: 4, label: 'Confirm', icon: ClipboardCheck },
]

const addressSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  address: z.string().min(5),
  city: z.string().min(2),
  state: z.string().min(2),
  zip: z.string().min(4),
})
type AddressForm = z.infer<typeof addressSchema>

const paymentSchema = z.object({
  cardNumber: z.string().min(16).max(19),
  cardHolder: z.string().min(2),
  expiry: z.string().min(4),
  cvv: z.string().min(3).max(4),
})
type PaymentForm = z.infer<typeof paymentSchema>

const DELIVERY_OPTIONS = [
  { id: 'standard', label: 'Standard Shipping', sub: '5-7 business days', price: 0, icon: '📦' },
  { id: 'express', label: 'Express Shipping', sub: '2-3 business days', price: 9.99, icon: '🚀' },
  { id: 'nextday', label: 'Next Day Delivery', sub: '1 business day', price: 19.99, icon: '⚡' },
]

export default function CheckoutPage() {
  const [step, setStep] = useState(1)
  const [address, setAddress] = useState<AddressForm | null>(null)
  const [delivery, setDelivery] = useState(DELIVERY_OPTIONS[0])
  const navigate = useNavigate()
  const { items, getSubtotal, getTaxAmount, clearCart } = useCartStore()
  const activeItems = items.filter(i => !i.saved_for_later)
  const subtotal = getSubtotal()
  const tax = getTaxAmount()
  const total = subtotal + delivery.price + tax

  const addressForm = useForm<AddressForm>({ resolver: zodResolver(addressSchema) })
  const paymentForm = useForm<PaymentForm>({ resolver: zodResolver(paymentSchema) })

  const handleAddressSubmit = (data: AddressForm) => {
    setAddress(data)
    setStep(2)
  }

  const handlePaymentSubmit = () => {
    setStep(4)
  }

  const handlePlaceOrder = () => {
    clearCart()
    navigate('/order-success')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-10">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step > s.id ? 'bg-primary border-primary text-secondary' :
                  step === s.id ? 'border-primary text-primary bg-primary/10' :
                  'border-border text-gray-600'
                }`}
              >
                {step > s.id ? <Check size={18} /> : <s.icon size={18} />}
              </motion.div>
              <span className={`text-xs mt-1 font-medium ${step >= s.id ? 'text-primary' : 'text-gray-600'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-all duration-500 ${step > s.id ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {/* Step 1: Address */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="card">
                <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <MapPin className="text-primary" size={22} /> Delivery Address
                </h2>
                <form onSubmit={addressForm.handleSubmit(handleAddressSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                      <input {...addressForm.register('fullName')} placeholder="John Doe" className="input" />
                      {addressForm.formState.errors.fullName && <p className="text-red-400 text-xs mt-1">Required</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Phone *</label>
                      <input {...addressForm.register('phone')} placeholder="+1 234 567 8900" className="input" />
                      {addressForm.formState.errors.phone && <p className="text-red-400 text-xs mt-1">Required</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Street Address *</label>
                    <input {...addressForm.register('address')} placeholder="123 Main Street, Apt 4B" className="input" />
                    {addressForm.formState.errors.address && <p className="text-red-400 text-xs mt-1">Required</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">City *</label>
                      <input {...addressForm.register('city')} placeholder="New York" className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">State *</label>
                      <input {...addressForm.register('state')} placeholder="NY" className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">ZIP *</label>
                      <input {...addressForm.register('zip')} placeholder="10001" className="input" />
                    </div>
                  </div>
                  <button type="submit" className="w-full btn-primary flex items-center justify-center gap-2 py-3">
                    Continue to Delivery <ChevronRight size={18} />
                  </button>
                </form>
              </motion.div>
            )}

            {/* Step 2: Delivery */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="card">
                <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <Truck className="text-primary" size={22} /> Delivery Method
                </h2>
                <div className="space-y-3 mb-6">
                  {DELIVERY_OPTIONS.map(opt => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
                        delivery.id === opt.id ? 'border-primary bg-primary/10' : 'border-border hover:border-gray-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="delivery"
                        checked={delivery.id === opt.id}
                        onChange={() => setDelivery(opt)}
                        className="accent-primary"
                      />
                      <span className="text-2xl">{opt.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{opt.label}</p>
                        <p className="text-sm text-gray-400">{opt.sub}</p>
                      </div>
                      <span className={`font-bold ${opt.price === 0 ? 'text-green-400' : 'text-white'}`}>
                        {opt.price === 0 ? 'FREE' : `$${opt.price.toFixed(2)}`}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="btn-secondary flex-1 py-3">← Back</button>
                  <button onClick={() => setStep(3)} className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                    Continue to Payment <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="card">
                <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <CreditCard className="text-primary" size={22} /> Payment
                </h2>
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-400 flex items-center gap-2">
                    <Lock size={14} /> Demo Mode — No real payments processed
                  </p>
                </div>
                <form onSubmit={paymentForm.handleSubmit(handlePaymentSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Card Number</label>
                    <input {...paymentForm.register('cardNumber')} placeholder="1234 5678 9012 3456" className="input font-mono" maxLength={19} />
                    {paymentForm.formState.errors.cardNumber && <p className="text-red-400 text-xs mt-1">Enter a valid card number</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Cardholder Name</label>
                    <input {...paymentForm.register('cardHolder')} placeholder="John Doe" className="input" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Expiry Date</label>
                      <input {...paymentForm.register('expiry')} placeholder="MM/YY" className="input font-mono" maxLength={5} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">CVV</label>
                      <input {...paymentForm.register('cvv')} placeholder="•••" className="input font-mono" maxLength={4} type="password" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-gray-500">or pay with</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <button
                    type="button"
                    onClick={handlePaymentSubmit}
                    className="w-full py-3 bg-[#003087] hover:bg-[#002475] text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="text-[#009cde] font-black">Pay</span>
                    <span className="text-[#012169] font-black">Pal</span>
                  </button>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1 py-3">← Back</button>
                    <button type="submit" className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                      Review Order <ChevronRight size={18} />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Step 4: Confirm */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="card">
                <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
                  <ClipboardCheck className="text-primary" size={22} /> Order Summary
                </h2>
                {/* Items */}
                <div className="space-y-3 mb-5">
                  {activeItems.slice(0, 3).map(item => (
                    <div key={item.id} className="flex gap-3">
                      <img src={item.product.images?.[0]?.url} alt="" className="w-14 h-14 object-cover rounded-lg" />
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium line-clamp-1">{item.product.title}</p>
                        <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-primary">${(item.product.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {/* Address summary */}
                {address && (
                  <div className="p-3 bg-surface rounded-lg mb-4">
                    <p className="text-xs text-gray-400 mb-1">Delivering to:</p>
                    <p className="text-sm text-white font-medium">{address.fullName}</p>
                    <p className="text-xs text-gray-300">{address.address}, {address.city}, {address.state} {address.zip}</p>
                  </div>
                )}
                {/* Price summary */}
                <div className="space-y-1.5 border-t border-border pt-4 mb-5">
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Subtotal</span><span className="text-white">${subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Shipping ({delivery.label})</span><span className={delivery.price === 0 ? 'text-green-400' : 'text-white'}>{delivery.price === 0 ? 'FREE' : `$${delivery.price.toFixed(2)}`}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-400">Tax</span><span className="text-white">${tax.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                    <span className="text-white">Total</span>
                    <span className="text-primary">${total.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(3)} className="btn-secondary flex-1 py-3">← Back</button>
                  <motion.button
                    onClick={handlePlaceOrder}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                  >
                    <Lock size={16} /> Place Order
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Mini summary */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="font-bold text-white mb-3">
              {activeItems.length} Items in Cart
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeItems.map(item => (
                <div key={item.id} className="flex gap-2">
                  <img src={item.product.images?.[0]?.url} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white line-clamp-1">{item.product.title}</p>
                    <p className="text-xs text-gray-400">×{item.quantity}</p>
                  </div>
                  <p className="text-xs font-bold text-primary">${(item.product.price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-3 pt-3">
              <div className="flex justify-between font-bold">
                <span className="text-white">Total</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
