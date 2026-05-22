import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { Select } from '../components/Select';
import type { SelectOption } from '../components/Select';
import { DataTable } from '../components/DataTable';
import type { Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { Button } from '../components/Button';
import { fetchContent, type ContentDocument } from '../lib/content';
import { getCategoryName, type Category } from '../lib/categories';
import { showAppwriteError } from '../lib/notifications';
import { useCategoriesStore } from '../store/categoriesStore';

interface ContentItem extends Record<string, unknown> {
  id: string;
  title: string;
  category: string; // Display name or empty string
  type: string; // Display: '40 Temptations' or '40 Day Journey'
  // Journey-specific fields
  tasks?: string[];
  hasAudio?: boolean;
  day?: number;
}

/**
 * Map Appwrite content document to ContentItem for display
 */
function mapContentToItem(
  doc: ContentDocument,
  categories: Category[]
): ContentItem {
  // Get category name from ID
  let categoryName = '';
  if (doc.category) {
    const category = categories.find((cat) => cat.$id === doc.category);
    categoryName = category ? getCategoryName(category) : '';
  }

  // Map database type to display type
  const typeDisplay =
    doc.type === 'forty_day_journey'
      ? '40 Day Journey'
      : doc.type === 'forty_temptations'
      ? '40 Temptations'
      : doc.type;

  return {
    id: doc.$id,
    title: doc.title,
    category: categoryName,
    type: typeDisplay,
    tasks: doc.tasks,
    hasAudio:
      (doc.files && doc.files.length > 0) ||
      (doc.recoveryQuestionFiles && doc.recoveryQuestionFiles.length > 0) ||
      (doc.supportQuestionFiles && doc.supportQuestionFiles.length > 0),
    day: doc.day,
  };
}


const typeOptions: SelectOption[] = [
  { value: '', label: 'Types' },
  { value: '40-temptations', label: '40 Temptations' },
  { value: '40-day-journey', label: '40 Day Journey' },
];

export const ContentManagement = () => {
  const navigate = useNavigate();
  const { categories, loadCategories } = useCategoriesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories on mount (only once, centrally managed)
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Debounce search query (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch content when filters, search, or pagination changes
  useEffect(() => {
    const loadContent = async () => {
      // Wait for categories to be loaded before fetching content
      // This ensures category names can be resolved properly
      if (categories.length === 0) {
        return;
      }
      
      setIsLoading(true);
      setError(null);

      try {
        // Calculate offset for pagination
        const offset = (currentPage - 1) * itemsPerPage;

        // Map filter values to database values
        const filters: {
          category?: string;
          type?: string;
        } = {};

        // Category filter - use category ID directly
        if (selectedCategory) {
          // selectedCategory is already the category ID from the dropdown
          filters.category = selectedCategory;
        }

        // Type filter
        if (selectedType) {
          filters.type = selectedType;
        }

        // Fetch content from Appwrite
        const result = await fetchContent(
          itemsPerPage,
          offset,
          debouncedSearchQuery || undefined,
          Object.keys(filters).length > 0 ? filters : undefined
        );
        
        // Map documents to display items
        const mappedItems = result.documents.map((doc) =>
          mapContentToItem(doc, categories)
        );

        setContentItems(mappedItems);
        setTotalItems(result.total);
      } catch (err) {
        console.error('Error loading content:', err);
        setError('Failed to load content. Please try again.');
        showAppwriteError(err);
        setContentItems([]);
        setTotalItems(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [
    currentPage,
    itemsPerPage,
    debouncedSearchQuery,
    selectedCategory,
    selectedType,
    categories, // Added: re-map content when categories are loaded
  ]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isUploadModalOpen) {
        setIsUploadModalOpen(false);
      }
    };

    if (isUploadModalOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isUploadModalOpen]);

  // Update category options when categories are loaded
  const categoryOptions: SelectOption[] = useMemo(() => [
    { value: '', label: 'Categories' },
    ...categories.map((cat) => ({
      value: cat.$id,
      label: getCategoryName(cat),
    })),
  ], [categories]);

  const formatJourneyListTitle = (row: ContentItem): string => {
    if (row.type !== '40 Day Journey' || row.day == null || !Number.isFinite(row.day)) {
      return row.title;
    }
    const raw = row.title?.trim() ?? '';
    return raw === '' || raw.toLowerCase() === 'day'
      ? `Day ${row.day}`
      : `${raw} (Day ${row.day})`;
  };

  const columns: Column<ContentItem>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (_value, row) => formatJourneyListTitle(row),
    },
    { key: 'category', label: 'Category' },
    { key: 'type', label: 'Type' },
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleRowClick = (row: ContentItem) => {
    // Navigate based on the item type and pass data via state
    if (row.type === '40 Day Journey') {
      navigate(`/content-management/journey-40-day/${row.id}`, {
        state: { journeyData: row },
      });
    } else if (row.type === '40 Temptations') {
      navigate(`/content-management/temptation-details`, {
        state: { temptationData: row },
      });
    }
  };

  return (
    <div className="bg-neutral-950 min-h-screen p-4 sm:p-6 lg:p-8">
      {/* Page Title */}
      <h1 
        className="text-white text-[16px] leading-[24px] mb-6 sm:mb-8"
        style={{ fontFamily: 'Cinzel, serif', fontWeight: 550 }}
      >
        Content Management
      </h1>

      {/* Header Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search Bar */}
        <div className="w-full sm:flex-1 sm:min-w-[200px]">
          <SearchBar
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="w-full sm:w-[200px] sm:shrink-0">
          <Select
            options={categoryOptions}
            value={selectedCategory}
            onChange={(value) => {
              setSelectedCategory(value);
              setCurrentPage(1);
            }}
            placeholder="Category"
          />
        </div>

        <div className="w-full sm:w-[160px] sm:shrink-0">
          <Select
            options={typeOptions}
            value={selectedType}
            onChange={(value) => {
              setSelectedType(value);
              setCurrentPage(1);
            }}
            placeholder="Type"
          />
        </div>

        {/* Upload Button */}
        <Button className="w-full sm:w-[208px] sm:shrink-0 text-white bg-[#965cdf]" variant="primary" onClick={() => setIsUploadModalOpen(true)}>
          Upload New Content
        </Button>
      </div>

      {/* Data Table */}
      <div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white text-[16px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
              Loading content...
            </p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-red-400 text-[16px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
              {error}
            </p>
          </div>
        ) : contentItems.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white text-[16px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
              No content found. Try adjusting your filters or create new content.
            </p>
          </div>
        ) : (
          <DataTable<ContentItem> 
            columns={columns} 
            data={contentItems} 
            onRowClick={handleRowClick}
          />
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setIsUploadModalOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          
          {/* Modal Content */}
          <div
            className="relative mx-4 w-full max-w-[406px] backdrop-blur-[20px] bg-[rgba(255,255,255,0.1)] rounded-[16px] px-6 py-8 sm:px-[32px] sm:py-[40px] flex flex-col gap-6 sm:gap-[32px] items-start"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <p
              className="font-normal text-[24px] text-center text-white w-full whitespace-pre-wrap"
              style={{ fontFamily: 'Cinzel, serif' }}
            >
              What type of content are you trying to upload.
            </p>

            {/* Button Container */}
            <div className="flex flex-col gap-[16px] w-full">
              <Button
                className="h-[48px] w-full"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  navigate('/content-management/create-40-temptations');
                }}
              >
                40 Temptations
              </Button>
              <Button
                className="h-[48px] w-full"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  navigate('/content-management/create-journey-40-day');
                }}
              >
                40 Day Journey
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

