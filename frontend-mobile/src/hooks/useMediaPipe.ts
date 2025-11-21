/**
 * Hook para procesar video con MediaPipe Hands
 * Extrae landmarks de las manos en tiempo real
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { mediaPipeService } from '../services/mediapipe';

interface UseMediaPipeResult {
  isProcessing: boolean;
  captureFrames: (videoElement: HTMLVideoElement) => Promise<number[][]>;
  processVideoFile: (file: File) => Promise<number[][]>;
  error: string | null;
  isReady: boolean;
}

export const useMediaPipe = (): UseMediaPipeResult => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const framesCollected = useRef<number[][]>([]);

  // Inicializar MediaPipe al montar el componente
  useEffect(() => {
    if (Platform.OS !== 'web') {
      setIsReady(false);
      setError('MediaPipe solo está disponible en la versión web');
      return;
    }

    const init = async () => {
      try {
        console.log('🔄 Inicializando MediaPipe Hands...');
        await mediaPipeService.initialize();
        setIsReady(true);
        console.log('✅ MediaPipe listo');
      } catch (err) {
        console.error('❌ Error inicializando MediaPipe:', err);
        setError('No se pudo inicializar MediaPipe');
      }
    };

    init();

    return () => {
      mediaPipeService.dispose();
    };
  }, []);

  /**
   * Captura 40 frames con landmarks reales de MediaPipe
   */
  const captureFrames = useCallback(async (videoElement: HTMLVideoElement): Promise<number[][]> => {
    if (!isReady) {
      throw new Error('MediaPipe no está listo');
    }

    setIsProcessing(true);
    setError(null);
    framesCollected.current = [];

    try {
      console.log('📹 Iniciando captura de 40 frames con MediaPipe (rellenando con ceros si no hay mano)...');

      const targetFrames = 40;
      const zeroFrame = new Array<number>(95).fill(0);

      for (let i = 0; i < targetFrames; i++) {
        // Esperar un frame (~33ms para 30fps)
        await new Promise((resolve) => setTimeout(resolve, 33));

        // Procesar frame con MediaPipe
        const landmarks = await mediaPipeService.processFrame(videoElement);

        if (landmarks && landmarks.length === 95) {
          framesCollected.current.push(landmarks);
          console.log(`✓ Frame ${i + 1}/${targetFrames}: mano detectada`);
        } else {
          framesCollected.current.push([...zeroFrame]);
          console.log(`✗ Frame ${i + 1}/${targetFrames}: sin mano, usando vector de ceros`);
        }
      }

      console.log('✅ Captura completada:', framesCollected.current.length, 'frames');
      setIsProcessing(false);
      return framesCollected.current;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      setIsProcessing(false);
      throw err;
    }
  }, [isReady]);

  const processVideoFile = useCallback(async (file: File): Promise<number[][]> => {
    if (!isReady) {
      throw new Error('MediaPipe no está listo');
    }

    setIsProcessing(true);
    setError(null);

    const videoElement = document.createElement('video');
    videoElement.src = URL.createObjectURL(file);
    videoElement.crossOrigin = 'anonymous';
    videoElement.playsInline = true;
    videoElement.muted = true;

    try {
      await waitForVideoReady(videoElement);
      const duration = videoElement.duration;
      if (!isFinite(duration) || duration === 0) {
        throw new Error('El video no tiene duración válida');
      }

      const targetFrames = 40;
      const collected: number[][] = [];
      const zeroFrame = new Array<number>(95).fill(0);

      for (let i = 0; i < targetFrames; i++) {
        const targetTime = (duration / targetFrames) * i;
        await seekVideo(videoElement, targetTime);
        const landmarks = await mediaPipeService.processFrame(videoElement);

        if (landmarks && landmarks.length === 95) {
          collected.push(landmarks);
          console.log(`✓ Frame video ${i + 1}/${targetFrames}: mano detectada`);
        } else {
          collected.push([...zeroFrame]);
          console.log(`✗ Frame video ${i + 1}/${targetFrames}: sin mano, usando vector de ceros`);
        }
      }

      return collected;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido procesando video';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
      URL.revokeObjectURL(videoElement.src);
    }
  }, [isReady]);

  return {
    isProcessing,
    captureFrames,
    processVideoFile,
    error,
    isReady,
  };
};

const waitForVideoReady = (video: HTMLVideoElement): Promise<void> => {
  return new Promise((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('No se pudo cargar el video'));
    };

    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('error', onError);
  });
};

const seekVideo = (video: HTMLVideoElement, time: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error('Error posicionando el video'));
    };

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    video.currentTime = Math.min(Math.max(time, 0), video.duration || 0);
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
};
