import React from 'react';
import SearchIcon from '../assets/icons/search';

export interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onSearch?: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search',
  className = '',
  onSearch,
  onChange,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onSearch?.(e.target.value);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
        <SearchIcon width={24} height={24} color="#616161" />
      </div>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full h-[56px] pl-12 pr-4 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] text-white font-lato text-[16px] leading-[24px] placeholder:text-[#616161] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
        onChange={handleChange}
        {...props}
      />
    </div>
  );
};

