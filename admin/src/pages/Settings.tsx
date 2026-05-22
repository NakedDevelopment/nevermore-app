import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EditIcon from '../assets/icons/edit';
import { ChangeEmailModal } from '../components/ChangeEmailModal';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { ChangePhoneNumberModal } from '../components/ChangePhoneNumberModal';
import { updateEmail, updatePassword, updatePhone, getCurrentUserProfile } from '../lib/auth';
import { showSuccess } from '../lib/notifications';
import type { Models } from 'appwrite';
import { useStore } from '../store';

// Helper function to format phone number for display
const formatPhoneNumber = (phone: string | undefined): string => {
  if (!phone) return '';
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Return as-is if not standard format
  return phone;
};

// Helper function to format date
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

export const Settings = () => {
  const navigate = useNavigate();
  const { appwriteUser: storeAppwriteUser, checkAuth } = useStore();
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [userProfile, setUserProfile] = useState<{ phone?: string; [key: string]: unknown } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Use store's appwriteUser data (already fetched by App.tsx)
  useEffect(() => {
    const loadUserData = async () => {
      if (storeAppwriteUser) {
        setUser(storeAppwriteUser);
        // Fetch user profile to get phone number from user_profiles table
        const profile = await getCurrentUserProfile();
        setUserProfile(profile);
      }
      setIsLoading(false);
    };
    loadUserData();
  }, [storeAppwriteUser]);

  const handleEmailEdit = () => {
    setIsEmailModalOpen(true);
  };

  const handlePhoneEdit = () => {
    setIsPhoneModalOpen(true);
  };

  const handlePasswordEdit = () => {
    setIsPasswordModalOpen(true);
  };

  const handleEmailSave = async (newEmail: string, currentPassword: string) => {
    setIsSavingEmail(true);
    try {
      const updatedUser = await updateEmail(newEmail, currentPassword);
      setUser(updatedUser);
      // Refresh auth state in store
      await checkAuth();
      showSuccess('Email updated successfully');
      setIsEmailModalOpen(false);
    } catch {
      // Error is already handled by updateEmail function
      // Don't close modal on error so user can retry
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handlePasswordSave = async (currentPassword: string, newPassword: string) => {
    setIsSavingPassword(true);
    try {
      await updatePassword(newPassword, currentPassword);
      showSuccess('Password updated successfully');
      setIsPasswordModalOpen(false);
    } catch {
      // Error is already handled by updatePassword function
      // Don't close modal on error so user can retry
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handlePhoneSave = async (newPhoneNumber: string, password: string) => {
    setIsSavingPhone(true);
    try {
      const updatedUser = await updatePhone(newPhoneNumber, password);
      setUser(updatedUser);
      // Refresh user profile to get updated phone number
      const profile = await getCurrentUserProfile();
      setUserProfile(profile);
      // Refresh auth state in store
      await checkAuth();
      showSuccess('Phone number updated successfully');
      setIsPhoneModalOpen(false);
    } catch {
      // Error is already handled by updatePhone function
      // Don't close modal on error so user can retry
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  if (isLoading) {
    return (
      <div className="bg-neutral-950 min-h-screen flex items-center justify-center p-4 sm:p-8">
        <p className="text-white text-[16px]">Loading...</p>
      </div>
    );
  }

  const displayName = user?.name || user?.email || 'User';
  const displayEmail = user?.email || '';
  // Get phone number from user_profiles table, not from auth user
  const displayPhone = formatPhoneNumber(userProfile?.phone as string | undefined);
  const accountCreatedDate = formatDate(user?.$createdAt);
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || displayName[0]?.toUpperCase() || 'U';

  return (
    <div className="bg-neutral-950 min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Page Title */}
      <h1 
        className="mb-6 text-white text-[20px] leading-tight sm:mb-8 sm:text-[24px] sm:leading-[normal]"
        style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
      >
        My Account
      </h1>

      {/* Profile Card */}
      <div className="mx-auto flex w-full max-w-[536px] flex-col items-center gap-10 rounded-[16px] backdrop-blur-[10px] bg-[rgba(255,255,255,0.07)] p-4 sm:gap-16 sm:rounded-[24px] sm:p-8">
        {/* Profile Section */}
        <div className="flex flex-col items-center gap-2">
          {/* Avatar with Online Status */}
          <div className="relative">
            <div className="w-[120px] h-[120px] rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-4xl text-gray-400">
                {initials}
              </span>
            </div>
            {/* Online Status Indicator */}
            <div className="absolute bottom-2 right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-[#131313]"></div>
          </div>
          
          {/* Name */}
          <p 
            className="text-white text-[16px] leading-[24px] font-medium"
            style={{ fontFamily: 'Roboto, sans-serif', fontWeight: 500 }}
          >
            {displayName}
          </p>
          
          {/* Account Created Date */}
          {accountCreatedDate && (
            <p 
              className="text-[#8f8f8f] text-[12px] leading-[16px]"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              Account Created: {accountCreatedDate}
            </p>
          )}
        </div>

        {/* Account Information Section */}
        <div className="w-full flex flex-col gap-4">
          {/* Section Title */}
          <h2 
            className="text-white text-[16px] leading-[24px]"
            style={{ fontFamily: 'Cinzel, serif', fontWeight: 550 }}
          >
            Account Information
          </h2>

          {/* Form Fields */}
          <div className="flex flex-col gap-6">
            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label 
                htmlFor="email"
                className="text-white text-[14px] leading-[20px]"
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                Email
              </label>
              <div className="relative">
                <div className="relative flex h-[56px] w-full min-w-0 items-center rounded-[16px] border border-[rgba(255,255,255,0.25)] bg-[#131313] px-4 pr-12">
                  <p className="min-w-0 flex-1 truncate font-lato text-[16px] leading-[24px] text-white" title={displayEmail || undefined}>
                    {displayEmail || 'No email set'}
                  </p>
                  <button
                    onClick={handleEmailEdit}
                    className="absolute right-4 p-1 hover:opacity-70 transition cursor-pointer"
                    aria-label="Edit email"
                    disabled={isSavingEmail}
                  >
                    <EditIcon width={24} height={24} color="#fff" />
                  </button>
                </div>
              </div>
            </div>

            {/* Phone Number Field */}
            <div className="flex flex-col gap-2">
              <label 
                htmlFor="phone"
                className="text-white text-[14px] leading-[20px]"
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                Phone Number (Optional)
              </label>
              <div className="relative">
                <div className="relative flex h-[56px] w-full min-w-0 items-center rounded-[16px] border border-[rgba(255,255,255,0.25)] bg-[#131313] px-4 pr-12">
                  <p className="min-w-0 flex-1 truncate font-lato text-[16px] leading-[24px] text-white">
                    {displayPhone || 'No phone number set'}
                  </p>
                  <button
                    onClick={handlePhoneEdit}
                    className="absolute right-4 p-1 hover:opacity-70 transition cursor-pointer"
                    aria-label="Edit phone number"
                    disabled={isSavingPhone}
                  >
                    <EditIcon width={20} height={20} color="#fff" />
                  </button>
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-2">
              <label 
                htmlFor="password"
                className="text-white text-[14px] leading-[20px]"
                style={{ fontFamily: 'Roboto, sans-serif' }}
              >
                Password
              </label>
              <div className="relative">
                <div className="w-full h-[56px] px-4 pr-12 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] flex items-center relative">
                  <p className="flex-1 text-white font-lato text-[16px] leading-[24px]">
                    • • • • • • • •
                  </p>
                  <button
                    onClick={handlePasswordEdit}
                    className="absolute right-4 p-1 hover:opacity-70 transition cursor-pointer"
                    aria-label="Edit password"
                    disabled={isSavingPassword}
                  >
                    <EditIcon width={24} height={24} color="#fff" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ChangeEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        currentEmail={displayEmail}
        onSave={handleEmailSave}
        isLoading={isSavingEmail}
      />

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSave={handlePasswordSave}
        onForgotPassword={handleForgotPassword}
        isLoading={isSavingPassword}
      />

      <ChangePhoneNumberModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        currentPhoneNumber={displayPhone}
        onSave={handlePhoneSave}
        isLoading={isSavingPhone}
      />
    </div>
  );
};

