/**
 * @file useWhisperTranscription.ts
 * @description Hook for managing Whisper transcription with Web Workers
 * 
 * Key optimization: Worker is created lazily on first use, not on mount.
 */
import { useState, useCallback, useRef } from 'react';
import { useWhisperStore, getModelById, type WhisperModelId, type TranscriptChunk } from '@/stores/whisperStore';

const SAMPLING_RATE = 16000;

export interface TranscriptionResult {
  text: string;
  chunks: TranscriptChunk[];
}

export interface UseWhisperTranscriptionOptions {
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onError?: (error: string) => void;
}

export interface UseWhisperTranscriptionReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  isModelLoading: boolean;
  isModelReady: boolean;
  transcriptionProgress: number;
  error: string | null;
  analyserRef: React.RefObject<AnalyserNode | null>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  loadModel: (modelId?: WhisperModelId) => Promise<void>;
  unloadModel: () => void;
  selectedModel: WhisperModelId;
}

export function useWhisperTranscription(
  options: UseWhisperTranscriptionOptions = {}
): UseWhisperTranscriptionReturn {
  const { onTranscriptionComplete, onError } = options;
  
  // Store
  const selectedModel = useWhisperStore(s => s.selectedModel);
  const addInstalledModel = useWhisperStore(s => s.addInstalledModel);
  const setIsDownloading = useWhisperStore(s => s.setIsDownloading);
  const updateDownloadProgress = useWhisperStore(s => s.updateDownloadProgress);
  const clearDownloadProgress = useWhisperStore(s => s.clearDownloadProgress);
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);
  const rejectRef = useRef<((err: string) => void) | null>(null);
  const callbacksRef = useRef({ onTranscriptionComplete, onError });
  callbacksRef.current = { onTranscriptionComplete, onError };
  
  // Store actions ref
  const storeRef = useRef({ addInstalledModel, setIsDownloading, updateDownloadProgress, clearDownloadProgress });
  storeRef.current = { addInstalledModel, setIsDownloading, updateDownloadProgress, clearDownloadProgress };
  
  // Lazily create worker - only when first needed
  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    
    const worker = new Worker(
      new URL('../lib/whisperWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = (event) => {
      const msg = event.data;
      
      switch (msg.type) {
        case 'loading':
          setIsModelLoading(true);
          break;
        case 'download-progress':
          storeRef.current.updateDownloadProgress({
            modelId: msg.modelId,
            file: msg.file || 'model',
            progress: msg.progress || 0,
          });
          break;
        case 'ready':
          setIsModelLoading(false);
          setIsModelReady(true);
          storeRef.current.setIsDownloading(false);
          storeRef.current.clearDownloadProgress();
          storeRef.current.addInstalledModel(msg.modelId as WhisperModelId);
          resolveRef.current?.();
          resolveRef.current = null;
          rejectRef.current = null;
          break;
        case 'progress':
          if (typeof msg.progress === 'number') {
            setTranscriptionProgress(Math.round(msg.progress));
          }
          break;
        case 'result':
          setIsTranscribing(false);
          setTranscriptionProgress(100);
          callbacksRef.current.onTranscriptionComplete?.({ text: msg.text, chunks: msg.chunks || [] });
          worker.postMessage({ type: 'unload' });
          break;
        case 'error':
          setIsModelLoading(false);
          setIsTranscribing(false);
          setError(msg.error);
          callbacksRef.current.onError?.(msg.error);
          rejectRef.current?.(msg.error);
          resolveRef.current = null;
          rejectRef.current = null;
          break;
        case 'unloaded':
          setIsModelReady(false);
          break;
      }
    };
    
    worker.onerror = () => {
      setError('Transcription worker error');
      callbacksRef.current.onError?.('Transcription worker error');
    };
    
    workerRef.current = worker;
    return worker;
  }, []);
  
  // Load model
  const loadModel = useCallback((modelId?: WhisperModelId): Promise<void> => {
    return new Promise((resolve, reject) => {
      const model = getModelById(modelId || selectedModel);
      if (!model) {
        setError('Invalid model ID');
        reject('Invalid model ID');
        return;
      }
      
      resolveRef.current = resolve;
      rejectRef.current = reject;
      
      setIsModelLoading(true);
      setIsModelReady(false);
      setError(null);
      setIsDownloading(true);
      
      getWorker().postMessage({ type: 'load', modelId: model.id });
    });
  }, [selectedModel, setIsDownloading, getWorker]);
  
  const unloadModel = useCallback(() => {
    workerRef.current?.postMessage({ type: 'unload' });
  }, []);
  
  // Process audio
  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size === 0) return;
    
    setIsTranscribing(true);
    
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: SAMPLING_RATE });
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      if (audioBuffer.duration < 0.5) {
        setIsTranscribing(false);
        setError('Recording too short');
        await audioContext.close();
        return;
      }
      
      let audioData: Float32Array;
      if (audioBuffer.numberOfChannels === 2) {
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        audioData = new Float32Array(left.length);
        for (let i = 0; i < left.length; i++) audioData[i] = (left[i] + right[i]) / 2;
      } else {
        audioData = audioBuffer.getChannelData(0);
      }
      
      await audioContext.close();
      getWorker().postMessage({ type: 'transcribe', audio: audioData });
    } catch (err) {
      setIsTranscribing(false);
      setError(err instanceof Error ? err.message : 'Audio processing failed');
    }
  }, [getWorker]);
  
  // Start recording
  const startRecording = useCallback(async () => {
    setError(null);
    setTranscriptionProgress(0);
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: SAMPLING_RATE, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(msg);
      callbacksRef.current.onError?.(msg);
    }
  }, []);
  
  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    setIsRecording(false);
    
    return new Promise<void>((resolve) => {
      const mediaRecorder = mediaRecorderRef.current!;
      
      mediaRecorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          setError('No audio recorded');
          resolve();
          return;
        }
        
        await processAudio(audioBlob);
        resolve();
      };
      
      mediaRecorder.stop();
    });
  }, [isRecording, processAudio]);
  
  return {
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
    unloadModel,
    selectedModel,
  };
}
