/**
 * @file WhisperModelsSettings.tsx
 * @description Settings panel for managing Whisper AI models
 * 
 * Features:
 * - View available models
 * - Download/delete models
 * - Download progress
 * - Storage usage
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Download, 
  Trash2, 
  Check, 
  Loader2, 
  HardDrive,
  Mic,
  Wand2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/design-system';
import { 
  useWhisperStore, 
  WHISPER_MODELS, 
  getModelById,
  type WhisperModelId 
} from '@/stores/whisperStore';

// ============================================================================
// TYPES
// ============================================================================

interface ModelCardProps {
  model: typeof WHISPER_MODELS[0];
  isInstalled: boolean;
  isSelected: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  onDownload: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

// ============================================================================
// MODEL CARD
// ============================================================================

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isInstalled,
  isSelected,
  isDownloading,
  downloadProgress,
  onDownload,
  onDelete,
  onSelect,
}) => {
  return (
    <div 
      className={cn(
        'p-4 rounded-xl border transition-all',
        isSelected 
          ? 'border-[var(--color-interactive-border)] bg-[var(--color-interactive-bg)]' 
          : 'border-[var(--color-border-default)] bg-[var(--color-surface-base)]',
        'hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Model icon */}
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          isInstalled 
            ? 'bg-green-100 dark:bg-green-900/30' 
            : 'bg-[var(--color-surface-secondary)]'
        )}>
          <Wand2 className={cn(
            'w-5 h-5',
            isInstalled 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-[var(--color-text-secondary)]'
          )} />
        </div>
        
        {/* Model info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {model.name}
            </h4>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {model.size}
            </span>
            {isInstalled && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3 h-3" />
                Installed
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {model.description}
          </p>
          
          {/* Download progress */}
          {isDownloading && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                <span>Downloading...</span>
                <span>{Math.round(downloadProgress)}%</span>
              </div>
              <div className="h-1.5 bg-[var(--color-surface-secondary)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[var(--color-interactive-bg-strong)] rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isInstalled ? (
            <>
              {/* Select button */}
              <button
                onClick={onSelect}
                disabled={isSelected}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  isSelected
                    ? 'bg-[var(--color-interactive-bg-strong)] text-white cursor-default'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)]'
                )}
              >
                {isSelected ? 'Selected' : 'Use'}
              </button>
              
              {/* Delete button */}
              <button
                onClick={onDelete}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  'text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-red-50',
                  'dark:hover:text-red-400 dark:hover:bg-red-900/20'
                )}
                title="Delete model"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                'bg-[var(--color-interactive-bg-strong)] text-white hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const WhisperModelsSettings: React.FC = () => {
  const installedModels = useWhisperStore(s => s.installedModels);
  const selectedModel = useWhisperStore(s => s.selectedModel);
  const isDownloading = useWhisperStore(s => s.isDownloading);
  const downloadProgress = useWhisperStore(s => s.downloadProgress);
  const setSelectedModel = useWhisperStore(s => s.setSelectedModel);
  const addInstalledModel = useWhisperStore(s => s.addInstalledModel);
  const removeInstalledModel = useWhisperStore(s => s.removeInstalledModel);
  const setIsDownloading = useWhisperStore(s => s.setIsDownloading);
  const updateDownloadProgress = useWhisperStore(s => s.updateDownloadProgress);
  const clearDownloadProgress = useWhisperStore(s => s.clearDownloadProgress);
  
  const [downloadingModelId, setDownloadingModelId] = useState<WhisperModelId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workerRef, setWorkerRef] = useState<Worker | null>(null);
  
  // Calculate total download progress for current model
  const currentProgress = useMemo(() => {
    if (!downloadingModelId || downloadProgress.length === 0) return 0;
    const relevantProgress = downloadProgress.filter(p => p.modelId === downloadingModelId);
    if (relevantProgress.length === 0) return 0;
    return relevantProgress.reduce((sum, p) => sum + p.progress, 0) / relevantProgress.length;
  }, [downloadingModelId, downloadProgress]);
  
  // Initialize worker for model downloads
  useEffect(() => {
    const worker = new Worker(
      new URL('@/lib/whisperWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = (event) => {
      const message = event.data;
      
      switch (message.type) {
        case 'download-progress':
          updateDownloadProgress({
            modelId: message.modelId,
            file: message.file || 'model',
            progress: message.progress || 0,
          });
          break;
          
        case 'ready':
          setDownloadingModelId(null);
          setIsDownloading(false);
          clearDownloadProgress();
          addInstalledModel(message.modelId as WhisperModelId);
          break;
          
        case 'error':
          setDownloadingModelId(null);
          setIsDownloading(false);
          clearDownloadProgress();
          setError(message.error);
          break;
      }
    };
    
    setWorkerRef(worker);
    
    return () => {
      worker.postMessage({ type: 'unload' });
      worker.terminate();
    };
  }, [addInstalledModel, clearDownloadProgress, setIsDownloading, updateDownloadProgress]);
  
  // Handle model download
  const handleDownload = useCallback((modelId: WhisperModelId) => {
    const model = getModelById(modelId);
    if (!model || !workerRef) return;
    
    setError(null);
    setDownloadingModelId(modelId);
    setIsDownloading(true);
    
    workerRef.postMessage({
      type: 'load',
      modelId: model.id,
    });
  }, [workerRef, setIsDownloading]);
  
  // Handle model deletion
  const handleDelete = useCallback((modelId: WhisperModelId) => {
    removeInstalledModel(modelId);
    // Note: The actual model cache is managed by the browser's Cache API
    // through transformers.js. We just track which models are "installed"
    // in our store. The browser may keep the cached files.
  }, [removeInstalledModel]);
  
  // Handle model selection
  const handleSelect = useCallback((modelId: WhisperModelId) => {
    setSelectedModel(modelId);
  }, [setSelectedModel]);
  
  // Calculate total storage (approximate based on model sizes)
  const MODEL_SIZES: Record<WhisperModelId, number> = {
    'tiny-en': 40 * 1024 * 1024,
    'small-en': 150 * 1024 * 1024,
    'tiny': 40 * 1024 * 1024,
    'small': 150 * 1024 * 1024,
  };
  
  const totalStorage = useMemo(() => {
    return installedModels.reduce((total, modelId) => total + (MODEL_SIZES[modelId] || 0), 0);
  }, [installedModels]);
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          AI Voice Transcription
        </h3>
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Manage Whisper AI models for voice-to-text transcription. Models run entirely in your browser.
        </p>
      </div>
      
      {/* Info banner */}
      <div className={cn(
        'flex items-start gap-3 p-4 rounded-xl',
        'bg-[var(--color-info-bg)]',
        'border border-[var(--color-info-border)]'
      )}>
        <Mic className="w-5 h-5 text-[var(--color-info-fg)] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-[var(--color-info-fg)]">
          <p className="font-medium mb-1">Local AI Processing</p>
          <p className="text-[var(--color-info-fg)]/80">
            All transcription happens locally in your browser using Whisper AI. 
            Your voice data never leaves your device.
          </p>
        </div>
      </div>
      
      {/* Storage usage */}
      <div className={cn(
        'flex items-center gap-3 p-3 rounded-lg',
        'bg-[var(--color-surface-secondary)]'
      )}>
        <HardDrive className="w-5 h-5 text-[var(--color-text-secondary)]" />
        <div className="flex-1">
          <div className="text-sm font-medium text-[var(--color-text-primary)]">
            Storage Used
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {installedModels.length} model{installedModels.length !== 1 ? 's' : ''} installed
          </div>
        </div>
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
          {formatBytes(totalStorage)}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className={cn(
          'flex items-center gap-2 p-3 rounded-lg',
          'bg-red-50 dark:bg-red-900/20',
          'border border-red-200 dark:border-red-800/50',
          'text-sm text-red-700 dark:text-red-300'
        )}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {/* Models list */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
          Available Models
        </h4>
        
        {WHISPER_MODELS.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isInstalled={installedModels.includes(model.id)}
            isSelected={selectedModel === model.id}
            isDownloading={downloadingModelId === model.id}
            downloadProgress={currentProgress}
            onDownload={() => handleDownload(model.id)}
            onDelete={() => handleDelete(model.id)}
            onSelect={() => handleSelect(model.id)}
          />
        ))}
      </div>
      
      {/* Help text */}
      <div className="pt-2 border-t border-[var(--color-border-default)]">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          <strong>Tiny</strong> is recommended for quick notes. Use <strong>Small</strong> or <strong>Medium</strong> for better accuracy with longer recordings.
          Models are cached in your browser and persist across sessions.
        </p>
      </div>
    </div>
  );
};

export default WhisperModelsSettings;
