import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Mail, Lock, Loader2, LogIn } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type LoginForm = z.infer<typeof loginSchema>

const otpSchema = z.object({
  email: z.string().email('Invalid email'),
})
type OtpForm = z.infer<typeof otpSchema>

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'password' | 'otp'>('password')
  const [showPassword, setShowPassword] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const navigate = useNavigate()
  const { signIn, signInWithGoogle, loading } = useAuthStore()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const { register: regOtp, handleSubmit: handleOtp } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    const { error } = await signIn(data.email, data.password)
    if (error) {
      toast.error(error, { style: { background: '#1F2937', color: '#fff' } })
    } else {
      toast.success('Welcome back!', { style: { background: '#1F2937', color: '#fff' } })
      navigate('/account')
    }
  }

  const onOtpSubmit = async (_data: OtpForm) => {
    // Demo mode
    setOtpSent(true)
    toast.success('OTP sent! Check your email.', { style: { background: '#1F2937', color: '#fff' } })
  }

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle()
    if (error) {
      toast.error('Demo mode: Google OAuth not configured', { style: { background: '#1F2937', color: '#fff' } })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="text-4xl">🛒</span>
            <span className="font-black text-white text-2xl">Market<span className="text-primary">Pro</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4">Welcome Back</h1>
          <p className="text-gray-400 mt-1">Sign in to your account to continue</p>
        </div>

        <div className="card">
          {/* Tabs */}
          <div className="flex bg-[#0d1117] rounded-lg p-1 mb-6">
            {(['password', 'otp'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === tab ? 'bg-primary text-secondary shadow-md' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'password' ? '🔑 Password' : '📱 OTP Login'}
              </button>
            ))}
          </div>

          {activeTab === 'password' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="you@example.com"
                    className="input pl-9"
                    autoComplete="email"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-gray-300">Password</label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pl-9 pr-9"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                {loading ? 'Signing In...' : 'Sign In'}
              </motion.button>
            </form>
          )}

          {activeTab === 'otp' && (
            <div className="space-y-4">
              {!otpSent ? (
                <form onSubmit={handleOtp(onOtpSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input {...regOtp('email')} type="email" placeholder="you@example.com" className="input pl-9" />
                    </div>
                  </div>
                  <button type="submit" className="w-full btn-primary py-3">Send OTP</button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-400 text-center">
                    Enter the 6-digit code sent to your email
                  </p>
                  <div className="flex gap-2 justify-center">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <input
                        key={i}
                        type="text"
                        maxLength={1}
                        className="w-11 h-12 text-center text-xl font-bold bg-[#0d1117] border border-border text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    ))}
                  </div>
                  <button className="w-full btn-primary py-3">Verify OTP</button>
                  <button
                    onClick={() => setOtpSent(false)}
                    className="w-full text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Resend OTP
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-gray-500">or continue with</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Google button */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-2.5 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Register link */}
          <p className="text-center text-sm text-gray-400 mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">Create one</Link>
          </p>
        </div>

        {/* Demo notice */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-400 text-center">
            🚀 <strong>Demo Mode:</strong> Use any email + password (min 6 chars) to explore
          </p>
        </div>
      </motion.div>
    </div>
  )
}
