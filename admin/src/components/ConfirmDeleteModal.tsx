import { useEffect } from 'react';
import CloseIcon from '../assets/icons/close';
import DeleteIcon from '../assets/icons/delete';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemName?: string;
  isLoading?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Delete Content',
  itemName,
  isLoading = false,
}) => {
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={isLoading ? undefined : onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal Content */}
      <div
        className="relative backdrop-blur-[10px] bg-[rgba(255,255,255,0.1)] rounded-[16px] p-8 w-[406px] flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            className="text-white text-[24px] leading-normal"
            style={{ fontFamily: 'Cinzel, serif', fontWeight: 400 }}
          >
            {title}
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

        {/* Warning Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[rgba(150,92,223,0.2)] flex items-center justify-center">
            <DeleteIcon width={32} height={32} color="#965cdf" />
          </div>
        </div>

        {/* Description */}
        <div className="text-center">
          <p
            className="text-white text-[16px] leading-[24px] mb-2"
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            Are you sure you want to delete
            {itemName && (
              <span className="text-[#965cdf] font-medium"> "{itemName}"</span>
            )}
            ?
          </p>
          <p
            className="text-[#8f8f8f] text-[14px] leading-[20px]"
            style={{ fontFamily: 'Roboto, sans-serif' }}
          >
            This action cannot be undone. All associated files will be permanently removed.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onConfirm}
            className="flex-1 h-[56px] rounded-[12px] bg-[#965CDF] text-white hover:bg-[#8549c9] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200 font-medium text-[16px] font-roboto"
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-[56px] rounded-[12px] bg-[#131313] border border-[rgba(255,255,255,0.25)] text-white hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200 font-medium text-[16px] font-roboto"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

