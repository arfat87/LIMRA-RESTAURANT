import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { ROUTES } from '../constants/routes';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('Please enter a valid email'); return; }
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Forgot Password | DSLR WORLD</title>
        <meta name="description" content="Reset your DSLR WORLD account password" />
      </Helmet>

      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {!sent ? (
            <div className="bg-white rounded-3xl shadow-xl p-8">
              {/* Back */}
              <Link to={ROUTES.LOGIN} className="inline-flex items-center gap-1.5 text-gray-500 hover:text-midnight text-sm mb-6 transition-colors">
                <ArrowLeft size={15} /> Back to Login
              </Link>

              {/* Icon */}
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-5">
                <Mail size={26} className="text-accent" />
              </div>

              <h1 className="font-poppins font-bold text-2xl text-midnight mb-1">Forgot Password?</h1>
              <p className="text-gray-500 text-sm mb-7">
                No worries! Enter your registered email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail size={15} />}
                />
                <Button type="submit" fullWidth size="lg" loading={loading}>
                  Send Reset Link
                </Button>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Remember your password?{' '}
                <Link to={ROUTES.LOGIN} className="text-accent font-semibold hover:underline">Login</Link>
              </p>
            </div>
          ) : (
            // Success state
            <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={30} className="text-emerald-600" />
              </div>
              <h1 className="font-poppins font-bold text-2xl text-midnight mb-2">Check Your Email</h1>
              <p className="text-gray-500 text-sm mb-2">
                We've sent a password reset link to:
              </p>
              <p className="font-semibold text-midnight mb-6">{email}</p>
              <p className="text-gray-400 text-xs mb-6">
                Didn't receive it? Check your spam folder or wait a minute and try again.
              </p>
              <Button
                variant="outline"
                fullWidth
                onClick={() => setSent(false)}
              >
                Try a Different Email
              </Button>
              <Link to={ROUTES.LOGIN}>
                <Button variant="ghost" fullWidth className="mt-2">
                  Back to Login
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
