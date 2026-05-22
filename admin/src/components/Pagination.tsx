import React, { useState, useRef, useEffect } from 'react';
import ChevronLeftIcon from '../assets/icons/chevron-left';
import ChevronDownIcon from '../assets/icons/chevron-down';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
  maxVisiblePages?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
  maxVisiblePages = 5,
}) => {
  const [isItemsPerPageOpen, setIsItemsPerPageOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsItemsPerPageOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= halfVisible + 1) {
        for (let i = 1; i <= maxVisiblePages; i++) {
          pages.push(i);
        }
      } else if (currentPage >= totalPages - halfVisible) {
        for (let i = totalPages - maxVisiblePages + 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        for (let i = currentPage - halfVisible; i <= currentPage + halfVisible; i++) {
          pages.push(i);
        }
      }
    }

    return pages;
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    onItemsPerPageChange?.(newItemsPerPage);
    setIsItemsPerPageOpen(false);
    // Reset to first page when changing items per page
    onPageChange(1);
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      {/* Left side: Show dropdown */}
      <div className="order-3 flex items-center gap-4 sm:order-none">
        <span 
          className="text-[#8f8f8f] text-[14px] leading-[24px]"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Show
        </span>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsItemsPerPageOpen(!isItemsPerPageOpen)}
            className="h-[40px] w-[88px] px-4 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[12px] text-white flex items-center justify-between hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-purple-500"
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            <span className="text-[14px] leading-[24px]">{itemsPerPage}</span>
            <ChevronDownIcon width={24} height={24} color="#fff" />
          </button>
          {isItemsPerPageOpen && (
            <div className="absolute bottom-full mb-1 left-0 bg-[#131313] border border-[rgba(255,255,255,0.25)] rounded-[12px] shadow-lg z-10 min-w-full">
              {itemsPerPageOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleItemsPerPageChange(option)}
                  className={`w-full px-4 py-2 text-left text-white hover:bg-gray-800 transition text-[14px] ${
                    itemsPerPage === option ? 'bg-gray-800' : ''
                  }`}
                  style={{ fontFamily: 'Roboto, sans-serif' }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center: Showing count */}
      <div 
        className="order-1 text-center text-[#8f8f8f] text-[14px] leading-[24px] sm:order-none sm:flex-1 sm:text-left"
        style={{ fontFamily: 'Roboto, sans-serif' }}
      >
        Showing {startItem} - {endItem} of {totalItems}
      </div>

      {/* Right side: Page navigation */}
      <div className="order-2 flex items-center justify-center gap-3 sm:order-none sm:justify-end sm:gap-6">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="text-white hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
          aria-label="Previous page"
        >
          <ChevronLeftIcon width={24} height={24} />
        </button>

        <div className="flex max-w-[100vw] flex-wrap items-center justify-center gap-1 sm:gap-2 px-1">
          {visiblePages.map((page, index) => {
          if (typeof page === 'string') {
            return (
              <span key={`ellipsis-${index}`} className="text-[#8f8f8f] px-2">
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                currentPage === page
                  ? 'bg-[#965cdf] text-white rounded-[12px]'
                  : 'text-[#8f8f8f] hover:text-white hover:bg-gray-800 rounded-[6px]'
              }`}
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              <span className="text-[14px] leading-[24px]">{page}</span>
            </button>
          );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="text-white hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition rotate-180"
          aria-label="Next page"
        >
          <ChevronLeftIcon width={24} height={24} />
        </button>
      </div>
    </div>
  );
};

