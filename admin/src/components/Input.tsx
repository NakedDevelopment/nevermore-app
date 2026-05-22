import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || 'field'}`;

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-white text-sm font-normal mb-2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full h-[56px] px-4 bg-[#131313] border ${
          error ? 'border-red-500' : 'border-[rgba(255,255,255,0.25)]'
        } rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};

