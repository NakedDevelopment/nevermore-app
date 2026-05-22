import { useState, useEffect } from 'react';
import CloseIcon from '../assets/icons/close';
import EyeIcon from '../assets/icons/eye';
import EyeClosedIcon from '../assets/icons/eye-closed';
import CheckSmallIcon from '../assets/icons/check-small';

interface ValidationRule {
  id: string;
  label: string;
  validate: (password: string, confirmPassword: string) => boolean;
}

const validationRules: ValidationRule[] = [
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

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (currentPassword: string, newPassword: string) => Promise<void>;
  onForgotPassword?: () => void;
  isLoading?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setError('');
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, isLoading]);

  const getValidationStatus = (rule: ValidationRule) => {
    return rule.validate(newPassword, confirmPassword);
  };

  const allValidationsPass = validationRules.every((rule) =>
    getValidationStatus(rule)
  );

  const handleSave = async () => {
    if (!currentPassword || !newPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!allValidationsPass) {
      setError('Please ensure all password requirements are met');
      return;
    }

    setError('');
    try {
      await onSave?.(currentPassword, newPassword);
      // Modal will be closed by parent component on success
    } catch (error) {
      // Error is handled by parent component, but we can show it here too
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to update password. Please try again.';
      setError(errorMessage);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
      onClick={isLoading ? undefined : onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal Content */}
      <div
        className="relative my-auto flex w-full max-w-[406px] max-h-[min(90vh,calc(100dvh-2rem))] flex-col gap-6 overflow-y-auto rounded-[16px] backdrop-blur-[10px] bg-[rgba(255,255,255,0.1)] p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h2
            className="min-w-0 flex-1 text-white text-[20px] leading-tight sm:text-[24px] sm:leading-normal"
            style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
          >
            Change Password
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:opacity-70 transition"
            aria-label="Close modal"
            disabled={isLoading}
          >
            <CloseIcon width={24} height={24} color="#fff" />
          </button>
        </div>

        {/* Description */}
        <p
          className="text-white text-[14px] leading-[24px]"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          To change your password please enter your current password for verification.
        </p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Form Fields */}
        <div className="flex flex-col gap-6">
          {/* Current Password Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="current-password"
              className="text-white text-[14px] leading-[20px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Current Password
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-[56px] px-4 pr-12 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] text-white font-lato text-[16px] leading-[24px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                style={currentPassword.length > 0 && !showNewPassword ? { letterSpacing: '0.2em' } : {}}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition text-white"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? (
                  <EyeIcon className="w-6 h-6" />
                ) : (
                  <EyeClosedIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="new-password"
              className="text-white text-[14px] leading-[20px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Choose password"
                className="w-full h-[56px] px-4 pr-12 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] text-white font-lato text-[16px] leading-[24px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                style={newPassword.length > 0 && !showNewPassword ? { letterSpacing: '0.2em' } : {}}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition text-white"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? (
                  <EyeIcon className="w-6 h-6" />
                ) : (
                  <EyeClosedIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Re-enter Password Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirm-password"
              className="text-white text-[14px] leading-[20px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Re-enter Password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className={`w-full h-[56px] px-4 pr-12 bg-[#131313] border rounded-[16px] text-white font-lato text-[16px] leading-[24px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  confirmPassword && !getValidationStatus(validationRules[3])
                    ? 'border-[#965cdf]'
                    : 'border-[rgba(255,255,255,0.25)]'
                }`}
                style={confirmPassword.length > 0 && !showNewPassword ? { letterSpacing: '0.2em' } : {}}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition text-white"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? (
                  <EyeIcon className="w-6 h-6" />
                ) : (
                  <EyeClosedIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="px-4 py-0 flex flex-col gap-1">
            {validationRules.map((rule) => {
              const isValid = getValidationStatus(rule);
              return (
                <div key={rule.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                    {isValid ? (
                      <CheckSmallIcon
                        width={16}
                        height={16}
                        color="#965cdf"
                      />
                    ): <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#8f8f8f]"></div>}
                  </div>
                  <p
                    className="text-[14px] leading-[24px]"
                    style={{ fontFamily: 'Roboto, sans-serif', color: isValid ? '#fff' : '#8f8f8f' }}
                  >
                    {rule.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
          <button
            onClick={handleSave}
            className="h-[56px] w-full flex-1 rounded-[12px] bg-[#965CDF] font-roboto text-[16px] font-medium text-white transition-colors duration-200 hover:bg-[#8549c9] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!currentPassword || !newPassword || !allValidationsPass || isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="h-[56px] w-full flex-1 rounded-[12px] border border-[#965cdf] bg-[#131313] font-roboto text-[16px] font-medium text-white transition-colors duration-200 hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

