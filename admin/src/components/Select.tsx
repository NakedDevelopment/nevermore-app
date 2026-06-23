import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ChevronDownIcon from '../assets/icons/chevron-down';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const selectRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the select trigger and the dropdown portal
      const isOutsideSelect = selectRef.current && !selectRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      if (isOutsideSelect && isOutsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportPadding = 16;
      const gap = 4;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
      const availableAbove = rect.top - viewportPadding;
      const maxHeight = Math.max(
        180,
        Math.min(360, Math.max(availableBelow, availableAbove))
      );
      const shouldOpenAbove = availableBelow < 220 && availableAbove > availableBelow;

      setDropdownStyle({
        position: 'fixed',
        top: shouldOpenAbove ? undefined : rect.bottom + gap,
        bottom: shouldOpenAbove ? window.innerHeight - rect.top + gap : undefined,
        left: rect.left,
        width: rect.width,
        maxHeight,
      });
    }
  }, [isOpen]);

  const selectedOption = value && value !== '' ? options.find((opt) => opt.value === value) : null;

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-[56px] px-4 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] flex items-center justify-between gap-3 hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-purple-500"
      >
        <span className={`font-lato text-[16px] leading-[24px] truncate flex-1 text-left ${selectedOption ? 'text-white' : 'text-[#616161]'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon
          width={24}
          height={24}
          color="#fff"
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={dropdownStyle}
          className="z-[9999] bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[16px] shadow-lg overflow-y-auto overflow-x-hidden custom-scrollbar"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-3 text-left text-white hover:bg-gray-800 transition font-lato text-[16px] ${
                value === option.value ? 'bg-gray-800' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

