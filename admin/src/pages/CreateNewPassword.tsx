import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import authBg from '../assets/images/auth-bg.png';
import { PasswordInput } from '../components/PasswordInput';
import { Button } from '../components/Button';
import CheckSmallIcon from '../assets/icons/check-small';
import { updatePasswordRecovery } from '../lib/auth';

interface ValidationRule {
  id: string;
  label: string;
  validate: (password: string, confirmPassword: string) => boolean;
}

const validationRules: ValidationRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    validate: (password) => password.length >= 8,
  },
  {
    id: 'capital',
    label: 'At least 1 capital letter',
    validate: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least 1 numerical value',
    validate: (password) => /[0-9]/.test(password),
  },
  {
    id: 'special',
    label: 'At least 1 special character',
    validate: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
  },
  {
    id: 'match',
    label: 'Passwords match',
    validate: (password, confirmPassword) => password === confirmPassword && password.length > 0,
  },
];

export const CreateNewPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract userId and secret from URL query parameters
  const userId = searchParams.get('userId');
  const secret = searchParams.get('secret');

  // Check if required parameters are present
  useEffect(() => {
    if (!userId || !secret) {
      setError('Invalid or expired recovery link. Please request a new password reset.');
    }
  }, [userId, secret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Check if all validations pass
    const allValid = validationRules.every((rule) =>
      rule.validate(newPassword, confirmPassword)
    );

    if (!allValid) {
      setError('Please ensure all password requirements are met.');
      return;
    }

    if (!userId || !secret) {
      setError('Invalid or expired recovery link. Please request a new password reset.');
      return;
    }

    setIsLoading(true);
    try {
      await updatePasswordRecovery(userId, secret, newPassword);
      // Navigate to sign in page after successful password reset
      navigate('/signin', { 
        state: { 
          message: 'Password reset successful. Please sign in with your NEW password (not your old one).' 
        },
        replace: true // Replace history to prevent going back to reset page
      });
    } catch (error: unknown) {
      // Get error message directly from Appwrite error
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message
        : (typeof error === 'string')
        ? error
        : 'Failed to update password. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getValidationStatus = (rule: ValidationRule) => {
    return rule.validate(newPassword, confirmPassword);
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
      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-[rgba(255, 255, 255, 0.07)] backdrop-blur-[10px] rounded-2xl shadow-2xl p-8 border border-gray-700/30">
          <div className="flex flex-col gap-8">
            {/* Title */}
            <h1 className="text-2xl font-normal text-white tracking-wide">
              Create new password
            </h1>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* New Password Field */}
              <div className="flex flex-col gap-2">
                <PasswordInput
                  id="new-password"
                  label="New Password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setError(''); // Clear error when user types
                  }}
                  placeholder="Enter new password"
                  required
                  disabled={isLoading || !userId || !secret}
                />
              </div>

              {/* Re-enter Password Field */}
              <div className="flex flex-col gap-2">
                <PasswordInput
                  id="confirm-password"
                  label="Re-enter Password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(''); // Clear error when user types
                  }}
                  placeholder="Re-enter password"
                  required
                  disabled={isLoading || !userId || !secret}
                />
              </div>

              {/* Validation Checklist */}
              <div className="flex flex-col gap-1 px-4 py-0">
                {validationRules.map((rule) => {
                  const isValid = getValidationStatus(rule);
                  return (
                    <div key={rule.id} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        {isValid ? (
                          <CheckSmallIcon
                            width={16}
                            height={12}
                            color="#965cdf"
                          />
                        ): <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#8f8f8f]"></div>}
                      </div>
                      <p
                        className={`text-sm font-normal ${
                          isValid ? 'text-white' : 'text-gray-400'
                        }`}
                      >
                        {rule.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <Button type="submit" fullWidth disabled={isLoading || !userId || !secret || confirmPassword !== newPassword || !confirmPassword}>
                {isLoading ? 'Updating Password...' : 'Submit'}
              </Button>
            </form>

            {/* Link to request new recovery if invalid */}
            {(!userId || !secret) && (
              <div className="mt-4 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
                >
                  Request a new password reset link
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

