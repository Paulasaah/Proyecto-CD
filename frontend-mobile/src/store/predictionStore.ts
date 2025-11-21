/**
 * Store global con Zustand para gestionar el estado de predicciones
 */
import { create } from 'zustand';
import { PredictionResponse, PredictionHistory } from '../types';

interface PredictionStore {
  // Estado
  currentPrediction: PredictionResponse | null;
  history: PredictionHistory[];
  isLoading: boolean;
  error: string | null;
  glosaPhrase: string[];
  spanishTranslation: string | null;
  
  // Acciones
  setPrediction: (prediction: PredictionResponse) => void;
  addToHistory: (prediction: PredictionResponse) => void;
  clearHistory: () => void;
  addGlosa: (label: string) => void;
  removeLastGlosa: () => void;
  clearGlosaPhrase: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSpanishTranslation: (text: string | null) => void;
}

export const usePredictionStore = create<PredictionStore>((set) => ({
  // Estado inicial
  currentPrediction: null,
  history: [],
  isLoading: false,
  error: null,
  glosaPhrase: [],
  spanishTranslation: null,
  
  // Acciones
  setPrediction: (prediction) => 
    set({ currentPrediction: prediction, error: null }),
  
  addToHistory: (prediction) =>
    set((state) => ({
      history: [
        {
          id: Date.now().toString(),
          prediction: prediction.prediction,
          confidence: prediction.confidence,
          timestamp: new Date(),
          top_3: prediction.top_3,
        },
        ...state.history,
      ].slice(0, 50), // Mantener solo las últimas 50
    })),
  
  clearHistory: () => set({ history: [] }),
  
  addGlosa: (label) =>
    set((state) => ({
      glosaPhrase: [...state.glosaPhrase, label.toUpperCase()],
    })),

  removeLastGlosa: () =>
    set((state) => ({
      glosaPhrase: state.glosaPhrase.slice(0, -1),
    })),

  clearGlosaPhrase: () => set({ glosaPhrase: [] }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error, isLoading: false }),

  setSpanishTranslation: (text) => set({ spanishTranslation: text }),
}));
