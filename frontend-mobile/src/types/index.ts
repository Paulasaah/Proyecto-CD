/**
 * Tipos TypeScript para la aplicación
 */

// Respuesta de predicción del backend
export interface PredictionResponse {
  prediction: string;
  confidence: number;
  top_3: TopPrediction[];
}

export interface TopPrediction {
  label: string;
  confidence: number;
}

// Request para el backend
export interface LandmarksRequest {
  landmarks: number[][];
}

// Estado de la cámara
export interface CameraState {
  isActive: boolean;
  hasPermission: boolean | null;
  isProcessing: boolean;
}

// Historial de predicciones
export interface PredictionHistory {
  id: string;
  prediction: string;
  confidence: number;
  timestamp: Date;
  top_3: TopPrediction[];
}
