import { useState, useEffect } from 'react';
import CloseIcon from '../assets/icons/close';
import EyeIcon from '../assets/icons/eye';
import EyeClosedIcon from '../assets/icons/eye-closed';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail?: string;
  onSave?: (newEmail: string, currentPassword: string) => Promise<void>;
  isLoading?: boolean;
}

export const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({
  isOpen,
  onClose,
  currentEmail = '',
  onSave,
  isLoading = false,
}) => {
  const [newEmail, setNewEmail] = useState(currentEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewEmail(currentEmail);
      setCurrentPassword('');
      setShowPassword(false);
      setError('');
    }
  }, [isOpen, currentEmail]);

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

  const handleSave = async () => {
    if (!newEmail || !currentPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newEmail === currentEmail) {
      setError('New email must be different from current email');
      return;
    }

    setError('');
    try {
      await onSave?.(newEmail, currentPassword);
      // Modal will be closed by parent component on success
    } catch (error) {
      // Error is handled by parent component, but we can show it here too
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to update email. Please try again.';
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
            Change Email
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
          To change your email please enter your current password for verification.
        </p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Form Fields */}
        <div className="flex flex-col gap-6">
          {/* Email Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="new-email"
              className="text-white text-[14px] leading-[20px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Email
            </label>
            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="newusername@companyemail.com"
              className="w-full h-[56px] px-4 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] text-white font-lato text-[16px] leading-[24px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Current Password Field */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="current-password-email"
              className="text-white text-[14px] leading-[20px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Current Password
            </label>
            <div className="relative">
              <input
                id="current-password-email"
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-[56px] px-4 pr-12 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] text-white font-lato text-[16px] leading-[24px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:opacity-70 transition text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeIcon className="w-6 h-6" />
                ) : (
                  <EyeClosedIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
          <button
            onClick={handleSave}
            className="h-[56px] w-full flex-1 rounded-[12px] bg-[#965CDF] font-roboto text-[16px] font-medium text-white transition-colors duration-200 hover:bg-[#8549c9] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!newEmail || !currentPassword || isLoading}
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

