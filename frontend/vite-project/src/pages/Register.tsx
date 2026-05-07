// src/pages/Register.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, UserPlus, ShieldCheck, KeyRound, Crown } from 'lucide-react';
import api from '../api/client';

type Step = 'details' | 'otp' | 'success';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'Customer' | 'Admin'>('Customer');
  const [step, setStep] = useState<Step>('details');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await api.post('/auth/register/send-otp', { 
        name, 
        email, 
        password,
        role: selectedRole.toLowerCase() === 'admin' ? 'admin' : 'user'
      });
      setSuccess(res.data?.message || 'OTP sent to your email.');
      setDevOtp(String(res.data?.devOtp || ''));
      setStep('otp');
    } catch (err) {
      const message = (err as any)?.response?.data?.message || 'Failed to send OTP';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await api.post('/auth/register/verify-otp', { email, otp });
      setSuccess(res.data?.message || 'Email verified successfully!');
      
      // Complete registration after OTP verification
      const registerRes = await api.post('/auth/register/complete', { 
        name, 
        email, 
        password, 
        role: selectedRole.toLowerCase() === 'admin' ? 'admin' : 'user' 
      });
      
      // Store token and user data
      if (registerRes.data.token) {
        localStorage.setItem('token', registerRes.data.token);
        // Update auth context if needed
      }
      
      setStep('success');
      setTimeout(() => {
        const redirectPath = selectedRole.toLowerCase() === 'admin' ? '/admin' : '/user';
        navigate(redirectPath);
      }, 2000);
    } catch (err) {
      const message = (err as any)?.response?.data?.message || 'Invalid OTP or registration failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
            >
              <ShieldCheck className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Created!</h1>
            <p className="text-sm text-slate-500">Redirecting to your dashboard...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4"
            >
              <UserPlus className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
            <p className="text-sm text-slate-500 mt-1">
              {step === 'details' ? 'Join Queue System today' : 'Verify your email address'}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
            >
              {error}
            </motion.div>
          )}
          
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm"
            >
              {success}
            </motion.div>
          )}
          
          {devOtp && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm"
            >
              Dev OTP: <span className="font-semibold tracking-[0.25em]">{devOtp}</span>
            </motion.div>
          )}

          {step === 'details' && (
            <form onSubmit={submitDetails} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Account Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('Customer')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedRole === 'Customer'
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <User className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Customer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('Admin')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedRole === 'Admin'
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <Crown className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-sm font-medium">Admin</span>
                  </button>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-lg font-semibold hover:from-brand-700 hover:to-brand-800 transition-all shadow-md disabled:opacity-70"
              >
                {loading ? 'Sending OTP...' : 'Send Verification OTP'}
              </motion.button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={submitOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">6-digit OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 tracking-[0.3em]"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-lg font-semibold hover:from-brand-700 hover:to-brand-800 transition-all shadow-md disabled:opacity-70"
              >
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </motion.button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign in
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}