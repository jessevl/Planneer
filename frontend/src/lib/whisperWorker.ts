/**
 * Web Worker for Whisper speech-to-text transcription
 * Uses @huggingface/transformers with ONNX backend
 */
import {
  env,
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

const ORT_ASSET_CACHE_NAME = `transformers-ort-assets-v${env.version}`;
const ORT_REMOTE_BASE_URL = `https://unpkg.com/@huggingface/transformers@${env.version}/dist`;
const ORT_REMOTE_MODULE_URL = `${ORT_REMOTE_BASE_URL}/ort-wasm-simd-threaded.jsep.mjs`;
const ORT_REMOTE_BINARY_URL = `${ORT_REMOTE_BASE_URL}/ort-wasm-simd-threaded.jsep.wasm`;

type OrtAssetUrls = {
  mjs: string;
  wasm: string;
};

if (!env.backends.onnx.wasm) {
  throw new Error('ONNX wasm backend is unavailable in the Whisper worker');
}

const onnxWasmEnv = env.backends.onnx.wasm;

onnxWasmEnv.proxy = false;

let ortAssetUrlsPromise: Promise<OrtAssetUrls> | null = null;

async function fetchOrtAssetResponse(assetUrl: string): Promise<Response> {
  const cachedResponse = typeof caches !== 'undefined'
    ? await (await caches.open(ORT_ASSET_CACHE_NAME)).match(assetUrl)
    : undefined;

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(assetUrl, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to download ONNX runtime asset: ${assetUrl}`);
  }

  if (typeof caches !== 'undefined') {
    const cache = await caches.open(ORT_ASSET_CACHE_NAME);
    await cache.put(assetUrl, response.clone());
  }

  return response;
}

async function resolveOrtAssetBlobUrl(assetUrl: string): Promise<string> {
  const response = await fetchOrtAssetResponse(assetUrl);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function resolveOrtAssetUrls(): Promise<OrtAssetUrls> {
  if (!ortAssetUrlsPromise) {
    ortAssetUrlsPromise = (async () => {
      try {
        const [mjs, wasm] = await Promise.all([
          resolveOrtAssetBlobUrl(ORT_REMOTE_MODULE_URL),
          resolveOrtAssetBlobUrl(ORT_REMOTE_BINARY_URL),
        ]);

        return { mjs, wasm };
      } catch {
        return {
          mjs: ORT_REMOTE_MODULE_URL,
          wasm: ORT_REMOTE_BINARY_URL,
        };
      }
    })();
  }

  return ortAssetUrlsPromise;
}

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
    onnxWasmEnv.wasmPaths = await resolveOrtAssetUrls();

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
