import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserProfile } from './UserProfile';
import ContentManagementIcon from '../assets/icons/content-management';
import SettingsIcon from '../assets/icons/settings';
import SignOutIcon from '../assets/icons/sign-out';
import { useStore } from '../store';
import { showSuccess } from '../lib/notifications';

const navigationItems = [
  {
    path: '/content-management',
    name: 'Content Management',
    icon: ContentManagementIcon,
  },
  {
    path: '/settings',
    name: 'Settings',
    icon: SettingsIcon,
  },
];

interface SidebarProps {
  /** Called after navigation actions so a mobile drawer can close */
  onNavigate?: () => void;
  className?: string;
}

export const Sidebar = ({ onNavigate, className = '' }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isLoading, user } = useStore();

  const handleSignOut = async () => {
    onNavigate?.();
    try {
      await signOut();
      showSuccess('Signed out successfully');
      navigate('/signin', { replace: true });
    } catch {
      // Error is already handled in the store and shown via notifications
      // Still navigate to signin even if sign out fails
      navigate('/signin', { replace: true });
    }
  };

  return (
    <div
      className={`backdrop-blur-[10px] bg-[rgba(255,255,255,0.07)] text-white min-h-screen w-full md:w-[248px] flex flex-col px-6 py-8 ${className}`}
    >
      {/* User Profile Section */}
      <div className="mb-20">
        <UserProfile name={user?.name || user?.email || 'Admin'} />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 flex flex-col gap-2">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.path;
          const IconComponent = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => onNavigate?.()}
              className={`flex items-center gap-3 p-4 rounded-[16px] transition ${
                isActive
                  ? 'backdrop-blur-[25px] bg-[rgba(255,255,255,0.1)] text-white'
                  : 'text-[#8f8f8f] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
              }`}
            >
              <IconComponent
                width={24}
                height={24}
                color={isActive ? '#fff' : '#8f8f8f'}
              />
              <span className="font-teachers font-medium text-[16px] leading-[16px]">
                {item.name}
              </span>
            </Link>
          );
        })}

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          disabled={isLoading}
          className="flex items-center gap-3 p-4 rounded-[16px] transition text-[#8f8f8f] hover:text-white hover:bg-[rgba(255,255,255,0.05)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SignOutIcon
            width={24}
            height={24}
            color="#8f8f8f"
          />
          <span className="font-teachers font-medium text-[16px] leading-[16px]">
            {isLoading ? 'Signing Out...' : 'Sign Out'}
          </span>
        </button>
      </nav>

      {/* Footer Links */}
      <div className="mt-auto pt-4 text-center">
        <Link
          to="/terms"
          onClick={() => onNavigate?.()}
          className="block text-[#8f8f8f] text-[12px] leading-[16px] hover:text-white transition mb-1"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Terms and Conditions
        </Link>
        <Link
          to="/privacy"
          onClick={() => onNavigate?.()}
          className="block text-[#8f8f8f] text-[12px] leading-[16px] hover:text-white transition"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  );
};
