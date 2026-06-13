import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth.api';
import { ROUTES } from '../constants/routes';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (!token) { toast.error('Invalid reset link'); return; }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password, confirmPassword);
      setDone(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const strength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 8 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'];

  return (
    <>
      <Helmet>
        <title>Reset Password | DSLR WORLD</title>
      </Helmet>

      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {!done ? (
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-5">
                <Lock size={26} className="text-accent" />
              </div>
              <h1 className="font-poppins font-bold text-2xl text-midnight mb-1">Set New Password</h1>
              <p className="text-gray-500 text-sm mb-7">
                Choose a strong password for your DSLR WORLD account.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="New Password"
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock size={15} />}
                  rightIcon={
                    <button type="button" onClick={() => setShowPass(!showPass)} className="p-0.5">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                />

                {/* Password strength */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                          i <= strength ? strengthColor[strength] : 'bg-gray-200'
                        }`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${
                      strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-amber-500' : strength === 3 ? 'text-blue-500' : 'text-emerald-600'
                    }`}>
                      {strengthLabel[strength]}
                    </p>
                  </div>
                )}

                <Input
                  label="Confirm New Password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock size={15} />}
                  rightIcon={
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="p-0.5">
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  }
                  error={confirmPassword.length > 0 && password !== confirmPassword ? 'Passwords do not match' : undefined}
                />

                <Button type="submit" fullWidth size="lg" loading={loading}>
                  Reset Password
                </Button>
              </form>
            </div>
          ) : (
            // Success state
            <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={30} className="text-emerald-600" />
              </div>
              <h1 className="font-poppins font-bold text-2xl text-midnight mb-2">Password Reset!</h1>
              <p className="text-gray-500 text-sm mb-7">
                Your password has been reset successfully. You can now log in with your new password.
              </p>
              <Button fullWidth size="lg" onClick={() => navigate(ROUTES.LOGIN)}>
                Go to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
