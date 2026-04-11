/**
 * @file TranscriptionRender.tsx
 * @description Render component for the Transcription block
 */
import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import type { PluginElementRenderProps } from '@yoopta/editor';
import { useYooptaEditor, useYooptaReadOnly } from '@yoopta/editor';
import { 
  Mic, Square, Loader2, Copy, Check, AlertCircle, Clock,
  ChevronDown, ChevronRight, Wand2, Download, Settings,
} from 'lucide-react';
import { cn } from '@/lib/design-system';
import { useWhisperTranscription } from '@/hooks/useWhisperTranscription';
import { useWhisperStore, WHISPER_MODELS, type WhisperModelId } from '@/stores/whisperStore';
import { useUIStore } from '@/stores/uiStore';
import type { TranscriptionProps, TranscriptionChunk } from './types';

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

/** Audio waveform visualization during recording */
const WaveformVisualizer = memo(({ 
  isActive,
  analyserRef,
}: { 
  isActive: boolean;
  analyserRef?: React.RefObject<AnalyserNode | null>;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!isActive || !analyserRef?.current || !canvasRef.current) {
      // Show static bars when not active
      return;
    }
    
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      const width = canvas.width;
      const height = canvas.height;
      const barCount = 32;
      const barWidth = width / barCount - 1;
      
      // Focus on voice frequencies (85-255 Hz range)
      // Sample from 10% to 40% of frequency spectrum for better voice visualization
      const startIndex = Math.floor(bufferLength * 0.1);
      const endIndex = Math.floor(bufferLength * 0.4);
      const voiceRange = endIndex - startIndex;
      const step = Math.floor(voiceRange / barCount);
      
      ctx.clearRect(0, 0, width, height);
      
      for (let i = 0; i < barCount; i++) {
        const index = startIndex + (i * step);
        const value = dataArray[index];
        const barHeight = (value / 255) * height * 0.9;
        const x = i * (barWidth + 1);
        const y = (height - barHeight) / 2;
        
        // Gradient from blue to purple
        const hue = 220 + (i / barCount) * 30;
        ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.9)`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, analyserRef]);
  
  if (!isActive) return null;
  
  return (
    <canvas 
      ref={canvasRef}
      width={200}
      height={32}
      className="w-full max-w-[200px] h-8"
    />
  );
});
WaveformVisualizer.displayName = 'WaveformVisualizer';

/**
 * Model selector dropdown - only shows installed models as selectable
 */
const ModelSelector = memo(({ 
  selectedModel, 
  installedModels,
  onSelect,
  onManageModels,
  isDisabled,
}: { 
  selectedModel: WhisperModelId;
  installedModels: WhisperModelId[];
  onSelect: (model: WhisperModelId) => void;
  onManageModels: () => void;
  isDisabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const currentModel = WHISPER_MODELS.find(m => m.id === selectedModel);
  
  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);
  
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
          'text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-surface-overlay)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        <Wand2 className="w-3 h-3" />
        <span>{currentModel?.name || 'Tiny'}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
      </button>
      
      {isOpen && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setIsOpen(false)} 
          />
          <div 
            className={cn(
              'fixed z-[9999]',
              'w-52 p-1 rounded-lg shadow-lg',
              'bg-[var(--color-surface-primary)]',
              'border border-[var(--color-border-default)]'
            )}
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
            }}
          >
            {WHISPER_MODELS.map((model) => {
              const isInstalled = installedModels.includes(model.id);
              return (
                <button
                  key={model.id}
                  onClick={() => {
                    if (isInstalled) {
                      onSelect(model.id);
                      setIsOpen(false);
                    }
                  }}
                  disabled={!isInstalled}
                  className={cn(
                    'w-full flex items-start gap-2 p-2 rounded-md text-left',
                    isInstalled 
                      ? 'hover:bg-[var(--color-surface-hover)] cursor-pointer'
                      : 'opacity-50 cursor-not-allowed',
                    selectedModel === model.id && 'bg-[var(--color-interactive-bg)]'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'text-sm font-medium',
                        isInstalled 
                          ? 'text-[var(--color-text-primary)]'
                          : 'text-[var(--color-text-tertiary)]'
                      )}>
                        {model.name}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {model.size}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">
                      {model.description}
                    </p>
                  </div>
                  {isInstalled ? (
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Download className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
            <button
              onClick={() => {
                setIsOpen(false);
                onManageModels();
              }}
              className={cn(
                'w-full flex items-center gap-2 p-2 rounded-md text-left',
                'text-sm text-[var(--color-interactive-text-strong)]',
                'hover:bg-[var(--color-surface-hover)]',
                'border-t border-[var(--color-border-default)] mt-1'
              )}
            >
              <Settings className="w-4 h-4" />
              Manage models...
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
});
ModelSelector.displayName = 'ModelSelector';

/**
 * Transcript chunk with timestamp
 */
const TranscriptChunkItem = memo(({ 
  chunk,
  onCopy,
}: { 
  chunk: TranscriptionChunk;
  onCopy: (text: string) => void;
}) => {
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div 
      className={cn(
        'group flex gap-3 p-2 -mx-2 rounded-md',
        'hover:bg-[var(--color-surface-overlay)]',
        'cursor-pointer transition-colors'
      )}
      onClick={() => onCopy(chunk.text)}
    >
      <span className="text-xs text-[var(--color-text-tertiary)] font-mono w-10 flex-shrink-0 pt-0.5">
        {formatTimestamp(chunk.timestamp[0])}
      </span>
      <p className="flex-1 text-sm text-[var(--color-text-primary)] leading-relaxed">
        {chunk.text.trim()}
      </p>
      <Copy className="w-4 h-4 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </div>
  );
});
TranscriptChunkItem.displayName = 'TranscriptChunkItem';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface TranscriptionRenderInnerProps {
  blockId: string;
  element: any;
  editor: any;
  readOnly: boolean;
}

const TranscriptionRenderInner: React.FC<TranscriptionRenderInnerProps> = ({
  blockId,
  element,
  editor,
  readOnly,
}) => {
  const props = element.props as TranscriptionProps;

  const [optimisticTranscript, setOptimisticTranscript] = useState<string>('');
  const [optimisticChunks, setOptimisticChunks] = useState<TranscriptionChunk[]>([]);
  const [optimisticCreatedAt, setOptimisticCreatedAt] = useState<string>('');
  const [optimisticDuration, setOptimisticDuration] = useState<number | undefined>(undefined);

  const effectiveTranscript = optimisticTranscript || props.transcript || '';
  const effectiveChunks = optimisticChunks.length > 0 ? optimisticChunks : (props.chunks || []);
  const effectiveCreatedAt = optimisticCreatedAt || props.createdAt;
  const effectiveDuration = optimisticDuration ?? props.duration;
  const hasTranscript = effectiveTranscript.length > 0;
  
  // Store state - minimal subscriptions
  const selectedModel = useWhisperStore(s => s.selectedModel);
  const installedModels = useWhisperStore(s => s.installedModels);
  const setSelectedModel = useWhisperStore(s => s.setSelectedModel);
  const downloadProgress = useWhisperStore(s => s.downloadProgress);
  const openSettingsModal = useUIStore(s => s.openSettingsModal);
  
  // Local state
  const [copied, setCopied] = useState(false);
  const [showChunks, setShowChunks] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Transcription hook - model only loads on record click
  const {
    isRecording,
    isTranscribing,
    isModelLoading,
    isModelReady,
    transcriptionProgress,
    error,
    analyserRef,
    startRecording,
    stopRecording,
    loadModel,
  } = useWhisperTranscription({
    onTranscriptionComplete: (result) => {
      if (editor && blockId && result.text) {
        try {
          const createdAt = new Date().toISOString();

          // Optimistic UI update so transcript appears immediately.
          setOptimisticTranscript(result.text);
          setOptimisticChunks(result.chunks || []);
          setOptimisticDuration(recordingDuration);
          setOptimisticCreatedAt(createdAt);

          const block = editor.getBlock({ id: blockId });
          if (!block) return;

          const nextProps = {
            transcript: result.text,
            chunks: result.chunks,
            duration: recordingDuration,
            createdAt,
          };

          let updated = false;
          const updateNode = (node: any): any => {
            if (!node || typeof node !== 'object') return node;

            if (node.type === 'transcription') {
              updated = true;
              return {
                ...node,
                props: {
                  ...(node.props || {}),
                  ...nextProps,
                },
              };
            }

            if (Array.isArray(node.children)) {
              return {
                ...node,
                children: node.children.map(updateNode),
              };
            }

            return node;
          };

          const nextValue = (block.value || []).map(updateNode);
          if (!updated) {
            console.warn('[TranscriptionRender] No transcription element found in block value', { blockId });
            return;
          }

          editor.updateBlock(blockId, {
            value: nextValue,
          });
        } catch (err) {
          console.error('[TranscriptionRender] Failed to save transcript:', err);
        }
      }
    },
  });
  
  // Recording timer
  useEffect(() => {
    if (!isRecording) return;
    setRecordingDuration(0);
    const interval = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);
  
  // Format duration helper
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle record button click - loads model on first click
  const handleRecordClick = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
    } else if (isModelLoading) {
      return; // Already loading
    } else {
      // Load model if not ready (lazy load on first record)
      if (!isModelReady) {
        try {
          await loadModel();
        } catch {
          return; // Error handled by hook
        }
      }
      await startRecording();
    }
  }, [isRecording, isModelReady, isModelLoading, startRecording, stopRecording, loadModel]);
  
  // Copy handlers
  const handleCopyAll = useCallback(() => {
    navigator.clipboard.writeText(effectiveTranscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [effectiveTranscript]);
  
  const handleCopyChunk = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  
  // Calculate download progress
  const totalProgress = downloadProgress.length > 0
    ? Math.round(downloadProgress.reduce((sum, p) => sum + p.progress, 0) / downloadProgress.length)
    : 0;
  
  // ============================================================================
  // RECORDING UI (No transcript yet) - Compact layout
  // ============================================================================
  if (!hasTranscript && !readOnly) {
    return (
      <div 
        className={cn(
          'yoopta-plugin-card yoopta-transcription-card rounded-xl overflow-hidden',
          'border border-[var(--color-border-default)]'
        )}
        contentEditable={false}
      >
        {/* Compact single-row layout */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Record button - smaller */}
          <button
            onClick={handleRecordClick}
            disabled={isModelLoading || isTranscribing || installedModels.length === 0}
            className={cn(
              'relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 flex-shrink-0',
              isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[var(--color-interactive-bg-strong)] hover:brightness-110',
              (isModelLoading || isTranscribing || installedModels.length === 0) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isRecording ? (
              <Square className="w-4 h-4 text-white fill-white" />
            ) : isTranscribing ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : isModelLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Mic className="w-4 h-4 text-white" />
            )}
            {isRecording && (
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
            )}
          </button>
          
          {/* Center content area */}
          <div className="flex-1 min-w-0">
            {isRecording ? (
              <div className="flex items-center gap-3">
                <WaveformVisualizer isActive={true} analyserRef={analyserRef} />
                <span className="text-sm font-medium text-red-600 dark:text-red-400 flex-shrink-0">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
            ) : isTranscribing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-[var(--color-interactive-text-strong)] animate-spin flex-shrink-0" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Transcribing... {transcriptionProgress > 0 && `${transcriptionProgress}%`}
                </span>
              </div>
            ) : isModelLoading ? (
              <span className="text-sm text-[var(--color-text-secondary)]">
                Loading model... {totalProgress > 0 && `${totalProgress}%`}
              </span>
            ) : installedModels.length === 0 ? (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                No models installed
              </span>
            ) : (
              <span className="text-sm text-[var(--color-text-tertiary)]">
                Click to record
              </span>
            )}
            
            {/* Error inline */}
            {error && (
              <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 mt-0.5">
                <AlertCircle className="w-3 h-3" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </div>
          
          {/* Model selector */}
          <ModelSelector
            selectedModel={selectedModel}
            installedModels={installedModels}
            onSelect={setSelectedModel}
            onManageModels={() => openSettingsModal('ai-models')}
            isDisabled={isRecording || isTranscribing || isModelLoading}
          />
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // TRANSCRIPT DISPLAY
  // ============================================================================
  return (
    <div 
      className={cn(
        'yoopta-plugin-card yoopta-transcription-card rounded-xl overflow-hidden',
        'border border-[var(--color-border-default)]'
      )}
      contentEditable={false}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        'border-b border-[var(--color-border-default)]',
        'bg-[var(--color-surface-secondary)]'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-interactive-bg)] flex items-center justify-center">
            <Mic className="w-4 h-4 text-[var(--color-interactive-text-strong)]" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
              Voice Transcription
            </h4>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              {effectiveDuration && (
                <>
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(effectiveDuration)}</span>
                  <span className="text-[var(--color-border-default)]">•</span>
                </>
              )}
              <span>{effectiveCreatedAt ? new Date(effectiveCreatedAt).toLocaleDateString() : 'Unknown date'}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleCopyAll}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs',
            'text-[var(--color-text-secondary)]',
            'hover:bg-[var(--color-surface-overlay)]',
            'transition-colors'
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy all</span>
            </>
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Full transcript */}
        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
          {effectiveTranscript}
        </p>
        
        {/* Chunked transcript with timestamps */}
        {effectiveChunks && effectiveChunks.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowChunks(!showChunks)}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                'text-[var(--color-text-secondary)]',
                'hover:text-[var(--color-text-primary)]',
                'transition-colors'
              )}
            >
              {showChunks ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Show with timestamps ({effectiveChunks.length} segments)</span>
            </button>
            
            {showChunks && (
              <div className="mt-2 pt-2 border-t border-[var(--color-border-default)]">
                {effectiveChunks.map((chunk, index) => (
                  <TranscriptChunkItem key={index} chunk={chunk} onCopy={handleCopyChunk} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// EXPORT
// ============================================================================

export const TranscriptionRender = (props: PluginElementRenderProps) => {
  const { element, attributes, children, blockId } = props;
  const editor = useYooptaEditor();
  const readOnly = useYooptaReadOnly();
  
  return (
    <div {...attributes} className="yoopta-transcription mt-0 mb-2">
      <TranscriptionRenderInner
        blockId={blockId}
        element={element}
        editor={editor}
        readOnly={readOnly}
      />
      {/* Hidden children for Slate compatibility */}
      <span style={{ display: 'none' }}>{children}</span>
    </div>
  );
};
