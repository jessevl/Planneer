/**
 * Web Worker for Whisper speech-to-text transcription
 * Uses @huggingface/transformers with ONNX backend
 */
import {
  pipeline,
  AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers';

// Model repositories
const MODEL_REPOS: Record<string, string> = {
  'tiny-en': 'Xenova/whisper-tiny.en',
  'small-en': 'Xenova/whisper-small.en',
  'tiny': 'Xenova/whisper-tiny',
  'small': 'Xenova/whisper-small',
};

// State
let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
let currentModelId: string | null = null;
let isLoading = false;

/**
 * Load a Whisper model
 */
async function loadModel(modelId: string): Promise<void> {
  if (transcriber && currentModelId === modelId) {
    self.postMessage({ type: 'ready', modelId });
    return;
  }
  if (isLoading) throw new Error('Model is already loading');
  isLoading = true;

  try {
    if (transcriber) await unloadModel();
    self.postMessage({ type: 'loading', modelId });

    const modelRepo = MODEL_REPOS[modelId] || `Xenova/whisper-${modelId}`;
    
    transcriber = await (pipeline as (
      task: 'automatic-speech-recognition',
      model: string,
      options: Record<string, unknown>
    ) => Promise<AutomaticSpeechRecognitionPipeline>)(
      'automatic-speech-recognition',
      modelRepo,
      {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
          if (progress.status === 'progress' && progress.progress !== undefined) {
            self.postMessage({
              type: 'download-progress',
              modelId,
              progress: progress.progress,
              file: progress.file || '',
            });
          }
        },
      }
    );

    currentModelId = modelId;
    self.postMessage({ type: 'ready', modelId });
  } finally {
    isLoading = false;
  }
}

/**
 * Unload current model to free RAM
 */
async function unloadModel(): Promise<void> {
  if (transcriber) {
    try { await transcriber.dispose(); } catch { /* ignore */ }
    transcriber = null;
    currentModelId = null;
  }
  self.postMessage({ type: 'unloaded' });
}

/**
 * Transcribe audio data
 */
async function transcribe(audio: Float32Array, language?: string): Promise<void> {
  if (!transcriber) throw new Error('Model not loaded');

  const isEnglishOnly = currentModelId?.endsWith('-en');
  const options: Record<string, unknown> = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  };
  
  if (!isEnglishOnly && language) {
    options.language = language;
    options.task = 'transcribe';
  }
  
  self.postMessage({ type: 'progress', progress: 0 });

  const progressInterval = setInterval(() => {
    self.postMessage({ type: 'progress', progress: Math.min(90, Math.random() * 20 + 70) });
  }, 500);
  
  const result = await transcriber(audio, options);
  clearInterval(progressInterval);
  self.postMessage({ type: 'progress', progress: 95 });

  let text = '';
  let chunks: Array<{ text: string; timestamp: [number, number | null] }> = [];
  
  if (typeof result === 'string') {
    text = result;
  } else if (result && typeof result === 'object') {
    const asrResult = result as AutomaticSpeechRecognitionOutput;
    text = asrResult.text || '';
    if (asrResult.chunks && Array.isArray(asrResult.chunks)) {
      chunks = asrResult.chunks.map((c: { text?: string; timestamp?: [number, number | null] }) => ({
        text: c.text || '',
        timestamp: c.timestamp || [0, null],
      }));
    }
  }

  self.postMessage({ type: 'result', text: text.trim(), chunks });
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = async (event: MessageEvent) => {
  const { type, modelId, audio, language } = event.data;
  try {
    if (type === 'load') await loadModel(modelId);
    else if (type === 'transcribe') await transcribe(audio, language);
    else if (type === 'unload') await unloadModel();
  } catch (error) {
    self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
  }
};

self.postMessage({ type: 'worker-ready' });
