import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { Select } from '../components/Select';
import type { SelectOption } from '../components/Select';
import { Button } from '../components/Button';
import { getSetting, saveSetting } from '../lib/settings';
import { showAppwriteError } from '../lib/notifications';

const settingTypeOptions: SelectOption[] = [
  { value: 'terms', label: 'Terms and Conditions' },
  { value: 'privacy', label: 'Privacy Policy' },
];

export const TermsAndPrivacy = () => {
  const [selectedType, setSelectedType] = useState<'terms' | 'privacy'>('terms');
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load content when type changes
  useEffect(() => {
    const loadContent = async () => {
      setIsLoading(true);
      try {
        const setting = await getSetting(selectedType);
        setContent(setting?.value || '');
      } catch (error) {
        console.error('Error loading setting:', error);
        showAppwriteError(error);
        setContent('');
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [selectedType]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveSetting(selectedType, content);
    } catch (error) {
      console.error('Error saving setting:', error);
      // Error is already handled by saveSetting
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-neutral-950 min-h-screen p-8">
      {/* Page Title */}
      <h1 
        className="text-white text-[16px] leading-[24px] mb-8"
        style={{ fontFamily: 'Cinzel, serif', fontWeight: 550 }}
      >
        Terms and Privacy Policy
      </h1>

      {/* Type Selector */}
      <div className="mb-6">
        <div className="w-[300px]">
          <Select
            options={settingTypeOptions}
            value={selectedType}
            onChange={(value) => setSelectedType(value as 'terms' | 'privacy')}
            placeholder="Select Type"
          />
        </div>
      </div>

      {/* Markdown Editor */}
      <div className="mb-6" data-color-mode="dark">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-white text-[16px]" style={{ fontFamily: 'Roboto, sans-serif' }}>
              Loading...
            </p>
          </div>
        ) : (
          <div className="w-full">
            <MDEditor
              value={content}
              onChange={(value) => setContent(value || '')}
              preview="edit"
              hideToolbar={false}
              visibleDragbar={false}
              height={600}
              data-color-mode="dark"
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-start">
        <Button 
          className="w-[208px]" 
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || isLoading}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
};

