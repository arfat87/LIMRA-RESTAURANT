import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/authStore';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
type LoginForm = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const { data: res } = await authApi.login(data);
      const d = res.data!;
      login(d.user, d.accessToken, d.refreshToken);
      toast.success(`Welcome back, ${d.user.name.split(' ')[0]}! 👋`);
      navigate(d.user.role === 'ADMIN' ? ROUTES.ADMIN : ROUTES.HOME);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Login failed. Check your credentials.');
    }
  };

  return (
    <>
      <Helmet><title>Sign In | DSLR WORLD</title></Helmet>
      <div className="min-h-screen bg-gradient-midnight flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-midnight px-8 py-8 text-center">
              <div className="w-14 h-14 bg-gradient-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-accent">
                <Camera size={28} className="text-white" />
              </div>
              <h1 className="font-poppins font-bold text-2xl text-white mb-1">Welcome Back</h1>
              <p className="text-gray-400 text-sm">Sign in to your DSLR WORLD account</p>
            </div>

            {/* Form */}
            <div className="px-8 py-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  error={errors.password?.message}
                  rightIcon={
                    <button type="button" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  {...register('password')}
                />
                <div className="flex justify-end">
                  <Link to={ROUTES.FORGOT_PASSWORD} className="text-accent text-sm hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" fullWidth size="lg" loading={isSubmitting} rightIcon={<ArrowRight size={16} />}>
                  Sign In
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-500 text-sm">
                  Don't have an account?{' '}
                  <Link to={ROUTES.REGISTER} className="text-accent font-semibold hover:underline">
                    Create one
                  </Link>
                </p>
              </div>

              <div className="mt-4 bg-gray-50 rounded-xl p-3 text-xs text-gray-400 text-center">
                Admin demo: <span className="font-mono">admin@dslrworld.in</span> / <span className="font-mono">Admin@123</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Login;
