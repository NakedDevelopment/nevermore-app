import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseStyles = 'h-[56px] rounded-[12px] transition-colors duration-200 font-medium text-[16px]';
  
  const variantStyles = {
    primary: disabled 
      ? 'bg-[#8549c9] text-white cursor-not-allowed font-roboto opacity-50' 
      : 'bg-[#8549c9] text-white cursor-pointer font-roboto',
    secondary: disabled
      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
      : 'bg-gray-700 hover:bg-gray-600 text-white cursor-pointer',
    ghost: disabled
      ? 'bg-transparent text-gray-500 border border-gray-600 cursor-not-allowed'
      : 'bg-transparent hover:bg-gray-800/50 text-gray-200 border border-gray-700 cursor-pointer',
    outline: disabled
      ? 'bg-transparent text-white border border-[#965CDF] cursor-not-allowed'
      : 'bg-transparent hover:bg-gray-800/50 text-white border border-[#965CDF] cursor-pointer',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${widthStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

