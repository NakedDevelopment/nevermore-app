import React from 'react';

interface UserProfileProps {
  name?: string;
  avatar?: string;
  isOnline?: boolean;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  name = 'Admin',
  avatar,
  isOnline = true,
}) => {
  return (
    <div className="flex flex-col items-center relative">
      {/* Profile Picture with Online Status */}
      <div className="relative mb-4">
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            className="w-[60px] h-[60px] rounded-full object-cover"
          />
        ) : (
          <div className="w-[60px] h-[60px] rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-2xl text-gray-400">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full"></div>
        )}
      </div>
      
      {/* Welcome Text */}
      <p 
        className="text-[#8f8f8f] text-[12px] leading-[16px] mb-1"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        Welcome Back,
      </p>
      
      {/* Username */}
      <p 
        className="text-white font-medium text-[16px] leading-[24px]"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        {name}
      </p>
    </div>
  );
};

