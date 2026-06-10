import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Eye, EyeOff, ArrowRight, User } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[0-9]/, 'Must include a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
type RegisterForm = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      await authApi.register({ name: data.name, email: data.email, phone: data.phone, password: data.password });
      toast.success('Account created! Please sign in.');
      navigate(ROUTES.LOGIN);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Registration failed. Please try again.');
    }
  };

  return (
    <>
      <Helmet><title>Create Account | DSLR WORLD</title></Helmet>
      <div className="min-h-screen bg-gradient-midnight flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-midnight px-8 py-8 text-center">
              <div className="w-14 h-14 bg-gradient-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-accent">
                <User size={28} className="text-white" />
              </div>
              <h1 className="font-poppins font-bold text-2xl text-white mb-1">Create Account</h1>
              <p className="text-gray-400 text-sm">Join DSLR WORLD — India's best camera store</p>
            </div>
            <div className="px-8 py-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input label="Full Name" placeholder="Rahul Sharma" error={errors.name?.message} required {...register('name')} />
                <Input label="Email Address" type="email" placeholder="you@example.com" error={errors.email?.message} required {...register('email')} />
                <Input label="Mobile Number" type="tel" placeholder="9876543210" error={errors.phone?.message} required {...register('phone')} />
                <Input label="Password" type={showPassword ? 'text' : 'password'} placeholder="Min 8 chars, 1 uppercase, 1 number" error={errors.password?.message} required
                  rightIcon={<button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
                  {...register('password')} />
                <Input label="Confirm Password" type="password" placeholder="Repeat your password" error={errors.confirmPassword?.message} required {...register('confirmPassword')} />
                <Button type="submit" fullWidth size="lg" loading={isSubmitting} rightIcon={<ArrowRight size={16} />}>Create Account</Button>
              </form>
              <p className="text-center text-gray-500 text-sm mt-6">
                Already have an account?{' '}
                <Link to={ROUTES.LOGIN} className="text-accent font-semibold hover:underline">Sign In</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Register;
