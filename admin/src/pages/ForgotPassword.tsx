import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authBg from '../assets/images/auth-bg.png';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { createPasswordRecovery } from '../lib/auth';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await createPasswordRecovery(normalizedEmail);
      // Navigate to link sent page with email in state (normalized so resend matches the first request)
      navigate('/link-sent', { state: { email: normalizedEmail } });
    } catch (error: unknown) {
      // Get error message directly from Appwrite error
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message
        : (typeof error === 'string')
        ? error
        : 'Failed to send recovery email. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage: `url(${authBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Form Container */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-[rgba(255, 255, 255, 0.07)] backdrop-blur-lg rounded-2xl shadow-2xl p-8 border-gray-700/50">
          {/* Title */}
          <h1 className="text-2xl font-normal text-white mb-4 tracking-wide">
            Reset Password
          </h1>

          {/* Instructions */}
          <p className="text-sm text-gray-200 mb-6">
            Enter your email address to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Email Field */}
            <Input
              id="email"
              type="email"
              label="Email Address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(''); // Clear error when user types
              }}
              placeholder="Enter email address"
              required
              disabled={isLoading}
            />

            {/* Send Link Button */}
            <Button type="submit" fullWidth disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Link'}
            </Button>
          </form>

          {/* Return to Sign In Link */}
          <div className="mt-6 text-center">
            <Link
              to="/signin"
              className="text-sm transition-colors"
              style={{ color: 'rgba(150, 92, 223, 1)' }}
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

