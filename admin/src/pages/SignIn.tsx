import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import authBg from '../assets/images/auth-bg.png';
import { Input } from '../components/Input';
import { PasswordInput } from '../components/PasswordInput';
import { Button } from '../components/Button';
import { useStore } from '../store';
import { getAppwriteErrorMessage } from '../lib/errorHandler';

export const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  const { signIn, isLoading, error, clearError } = useStore();

  // Get success message from location state (e.g., after password reset)
  useEffect(() => {
    const state = location.state as { message?: string } | null;
    if (state?.message) {
      setSuccessMessage(state.message);
      // Clear the location state to prevent showing message on subsequent navigations
      window.history.replaceState({}, document.title);
      // Clear success message after 5 seconds
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  // Clear errors and success message when user types (types or focuses)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    // Clear errors and success message when user starts typing
    if (localError) {
      setLocalError('');
    }
    if (error) {
      clearError();
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear errors and success message when user starts typing
    if (localError) {
      setLocalError('');
    }
    if (error) {
      clearError();
    }
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMessage(''); // Clear success message when form is submitted
    
    // Basic validation
    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      await signIn(email, password);
      // Redirect to the original destination if available, otherwise to content-management
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/content-management';
      navigate(from, { replace: true });
    } catch (error: unknown) {
      // Use the error handler utility to extract the message
      let errorMessage = getAppwriteErrorMessage(error);
      
      // If it's an invalid credentials error after password reset, provide helpful message
      if (successMessage && errorMessage.toLowerCase().includes('invalid credentials')) {
        errorMessage = 'Invalid credentials. If you just reset your password, please make sure you\'re using the NEW password you just created, not your old one.';
      }
      
      // Set local error to display in the form
      setLocalError(errorMessage);
      // Clear success message when sign-in fails
      setSuccessMessage('');
    }
  };

  // Get the error to display (prioritize local error, then store error)
  const displayError = localError || error;

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
        <div className="bg-[rgba(255, 255, 255, 0.75)] backdrop-blur-lg rounded-2xl shadow-2xl p-8 border-gray-700/50">
          {/* Title */}
          <h1 className="text-3xl font-normal text-white mb-8 tracking-wide">
            Sign In
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3">
                <p className="text-green-400 text-sm">{successMessage}</p>
              </div>
            )}

            {/* Error Message */}
            {displayError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{displayError}</p>
              </div>
            )}

            {/* Email Field */}
            <Input
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />

            {/* Password Field */}
            <PasswordInput
              id="password"
              label="Password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter your password!"
              required
              disabled={isLoading}
            />

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm hover:opacity-80 transition-opacity"
                style={{ color: 'rgba(150, 92, 223, 1)' }}
              >
                Forgot Password?
              </Link>
            </div>

            {/* Sign In Button */}
            <Button type="submit" fullWidth disabled={isLoading} variant="primary" >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

