/**
 * @file CoverPickerModal.tsx
 * @description Modal for choosing a page cover (Unsplash, upload, gradient)
 * @app SHARED - Used by PageHero and PageMetaPanel
 *
 * Surfaces three tabs:
 * - Unsplash search (via backend proxy, requires UNSPLASH_CONFIG)
 * - Upload (direct file picker)
 * - Color (curated gradients)
 *
 * Cover mutation is delegated to the supplied callbacks; see
 * usePageCoverActions for the standard wiring.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ImageIcon, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/design-system';
import { pb } from '@/lib/pocketbase';
import { UNSPLASH_CONFIG } from '@/lib/config';
import { useConfigStore } from '@/stores/configStore';
import { Modal } from '@/components/ui';

export const COVER_GRADIENTS = [
  { id: 'gradient-1', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', name: 'Ocean', isDark: true },
  { id: 'gradient-2', value: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', name: 'Forest', isDark: false },
  { id: 'gradient-3', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', name: 'Sunset', isDark: false },
  { id: 'gradient-4', value: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)', name: 'Fire', isDark: false },
  { id: 'gradient-5', value: 'linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)', name: 'Teal', isDark: false },
  { id: 'gradient-6', value: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)', name: 'Rose', isDark: false },
  { id: 'gradient-7', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', name: 'Midnight', isDark: true },
  { id: 'gradient-8', value: 'linear-gradient(135deg, #FAD961 0%, #F76B1C 100%)', name: 'Warm', isDark: false },
  { id: 'gradient-9', value: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', name: 'Cool', isDark: false },
  { id: 'gradient-10', value: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)', name: 'Steel', isDark: true },
];

interface CoverPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isUploading: boolean;
  onSelectGradient: (value: string) => void;
  onSelectImage: (url: string, attribution: string, downloadLocation?: string) => void;
  onUploadImage: (file: File) => void;
}

const CoverPickerModal: React.FC<CoverPickerModalProps> = ({
  isOpen,
  onClose,
  isUploading,
  onSelectGradient,
  onSelectImage,
  onUploadImage,
}) => {
  const { config } = useConfigStore();
  const [tab, setTab] = useState<'upload' | 'gradient' | 'unsplash'>('unsplash');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    urls: { regular: string; small: string };
    alt_description: string;
    user: { name: string; links: { html: string } };
    links: { download_location: string };
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (tab !== 'unsplash' || !searchQuery.trim() || !config.hasUnsplashConfig) {
      if (!searchQuery.trim()) setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `${pb.baseURL}${UNSPLASH_CONFIG.apiUrl}/search?query=${encodeURIComponent(searchQuery)}&page=${searchPage}&per_page=${UNSPLASH_CONFIG.perPage}&orientation=${UNSPLASH_CONFIG.orientation}`,
          { headers: { 'Authorization': pb.authStore.token } },
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(prev => (searchPage === 1 ? data.results : [...prev, ...data.results]));
          setHasMoreResults(data.total_pages > searchPage);
        }
      } catch (error) {
        console.error('Unsplash search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, searchPage, tab, config.hasUnsplashConfig, isOpen]);

  useEffect(() => { setSearchPage(1); }, [searchQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUploadImage(file);
  };

  const tabs = [
    { id: 'unsplash', label: 'Unsplash' },
    { id: 'upload', label: 'Upload' },
    { id: 'gradient', label: 'Color' },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose cover" size="lg">
      <div className="space-y-4">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                tab === t.id
                  ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-medium'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {tab === 'unsplash' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Unsplash..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-ring)]"
                />
              </div>

              {isSearching && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[var(--color-text-tertiary)]" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {searchResults.map((img) => (
                    <button
                      key={img.id}
                      className="aspect-[16/9] rounded-lg overflow-hidden hover:ring-2 ring-[var(--color-interactive-ring)] transition-all"
                      onClick={() => {
                        const utmParams = 'utm_source=planneer&utm_medium=referral';
                        const userLink = img.user.links.html.includes('?')
                          ? `${img.user.links.html}&${utmParams}`
                          : `${img.user.links.html}?${utmParams}`;
                        onSelectImage(
                          img.urls.regular,
                          JSON.stringify({ name: img.user.name, link: userLink }),
                          img.links.download_location,
                        );
                      }}
                    >
                      <img src={img.urls.small} alt={img.alt_description || ''} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : searchQuery ? (
                <p className="text-center text-[var(--color-text-secondary)] py-8 text-sm">
                  {isSearching ? 'Searching...' : 'No results found'}
                </p>
              ) : (
                <p className="text-center text-[var(--color-text-secondary)] py-8 text-sm">
                  Search for images on Unsplash
                </p>
              )}

              {hasMoreResults && searchResults.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setSearchPage(prev => prev + 1)}
                    disabled={isSearching}
                    className="px-4 py-2 text-sm text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] rounded-lg transition-colors"
                  >
                    {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Load more'}
                  </button>
                </div>
              )}

              <p className="text-xs text-[var(--color-text-tertiary)] text-center">Images from Unsplash</p>
            </div>
          )}

          {tab === 'upload' && (
            <div className="flex flex-col items-center justify-center py-8">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-[var(--color-border-default)] rounded-xl hover:border-[var(--color-interactive-border)] hover:bg-[var(--color-interactive-bg)]/50 transition-colors eink-dropzone"
              >
                {isUploading ? (
                  <Loader2 size={32} className="animate-spin text-[var(--color-interactive-text-strong)]" />
                ) : (
                  <ImageIcon size={32} className="text-[var(--color-text-tertiary)]" />
                )}
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {isUploading ? 'Uploading...' : 'Click to upload'}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">PNG, JPG, GIF up to 10MB</p>
                </div>
              </button>
            </div>
          )}

          {tab === 'gradient' && (
            <div className="grid grid-cols-5 gap-2">
              {COVER_GRADIENTS.map((g) => (
                <button
                  key={g.id}
                  className="aspect-[16/9] rounded-lg hover:ring-2 ring-[var(--color-interactive-ring)] transition-all"
                  style={{ background: g.value }}
                  onClick={() => onSelectGradient(g.value)}
                  title={g.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CoverPickerModal;
