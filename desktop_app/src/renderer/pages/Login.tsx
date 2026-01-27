import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';

export default function Login() {
  const [email, setEmail] = useState('admin@dawacare.local');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 animate-slide-in">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className="w-20 h-20">
              <rect width="256" height="256" fill="#2d8659" rx="20"/>
              <path d="M128 60 L160 80 L160 100 L96 100 L96 80 Z" fill="#ffffff"/>
              <ellipse cx="128" cy="100" rx="32" ry="8" fill="#e8f5e9"/>
              <path d="M96 100 L96 180 Q96 200 128 200 Q160 200 160 180 L160 100 Z" fill="#ffffff"/>
              <ellipse cx="128" cy="180" rx="32" ry="12" fill="#e8f5e9"/>
              <path d="M165 75 L185 65 Q190 62 193 67 L203 85 Q206 90 201 93 L181 103 Z" fill="#a5d6a7"/>
              <rect x="118" y="130" width="20" height="40" fill="#2d8659" rx="2"/>
              <rect x="108" y="140" width="40" height="20" fill="#2d8659" rx="2"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">DawaCare POS</h1>
          <p className="text-gray-600 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-800 border border-red-200 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Default Credentials Hint */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 font-medium mb-2">Default Credentials:</p>
          <p className="text-xs text-blue-700 space-y-1">
            <span className="block">Email: admin@dawacare.local</span>
            <span className="block">Password: admin123</span>
          </p>
          <p className="text-xs text-red-600 mt-2 font-medium">
            ⚠ Change your password after first login!
          </p>
        </div>
      </div>
    </div>
  );
}
