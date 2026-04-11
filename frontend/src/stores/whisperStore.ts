/**
 * @file whisperStore.ts
 * @description Zustand store for Whisper AI transcription state management
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ============================================================================
// TYPES
// ============================================================================

export type WhisperModelId = 'tiny-en' | 'small-en' | 'tiny' | 'small';

export interface WhisperModel {
  id: WhisperModelId;
  name: string;
  size: string;
  description: string;
}

export interface ModelDownloadProgress {
  modelId: WhisperModelId;
  file: string;
  progress: number; // 0-100
}

export interface TranscriptChunk {
  text: string;
  timestamp: [number, number | null];
}

interface WhisperState {
  installedModels: WhisperModelId[];
  selectedModel: WhisperModelId;
  isDownloading: boolean;
  downloadProgress: ModelDownloadProgress[];
  
  setSelectedModel: (model: WhisperModelId) => void;
  addInstalledModel: (model: WhisperModelId) => void;
  removeInstalledModel: (model: WhisperModelId) => void;
  setIsDownloading: (isDownloading: boolean) => void;
  updateDownloadProgress: (progress: ModelDownloadProgress) => void;
  clearDownloadProgress: () => void;
}

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export const WHISPER_MODELS: WhisperModel[] = [
  { id: 'tiny-en', name: 'Tiny (EN)', size: '~40 MB', description: '⚡ Fastest, English-only' },
  { id: 'small-en', name: 'Small (EN)', size: '~150 MB', description: '⚡ Better accuracy, English-only' },
  { id: 'tiny', name: 'Tiny', size: '~40 MB', description: 'Fastest, multilingual' },
  { id: 'small', name: 'Small', size: '~150 MB', description: 'Better accuracy, multilingual' },
];

export const getModelById = (id: WhisperModelId): WhisperModel | undefined => 
  WHISPER_MODELS.find(m => m.id === id);

// ============================================================================
// STORE
// ============================================================================

export const useWhisperStore = create<WhisperState>()(
  devtools(
    persist(
      (set) => ({
        installedModels: [],
        selectedModel: 'tiny-en',
        isDownloading: false,
        downloadProgress: [],
        
        setSelectedModel: (model) => set({ selectedModel: model }),
        
        addInstalledModel: (model) => set((state) => ({
          installedModels: state.installedModels.includes(model)
            ? state.installedModels
            : [...state.installedModels, model],
        })),
        
        removeInstalledModel: (model) => set((state) => ({
          installedModels: state.installedModels.filter(m => m !== model),
          selectedModel: state.selectedModel === model ? 'tiny-en' : state.selectedModel,
        })),
        
        setIsDownloading: (isDownloading) => set({ isDownloading }),
        
        updateDownloadProgress: (progress) => set((state) => {
          const idx = state.downloadProgress.findIndex(
            p => p.modelId === progress.modelId && p.file === progress.file
          );
          const updated = [...state.downloadProgress];
          if (idx >= 0) updated[idx] = progress;
          else updated.push(progress);
          return { downloadProgress: updated };
        }),
        
        clearDownloadProgress: () => set({ downloadProgress: [], isDownloading: false }),
      }),
      {
        name: 'planneer-whisper',
        partialize: (state) => ({
          installedModels: state.installedModels,
          selectedModel: state.selectedModel,
        }),
      }
    ),
    { name: 'WhisperStore' }
  )
);
