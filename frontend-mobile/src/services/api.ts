/**
 * Cliente API para comunicación con el backend FastAPI
 */
import axios from 'axios';
import { PredictionResponse, LandmarksRequest } from '../types';

// URL del backend - cambiar según el entorno
// Para web, usa la IP de tu máquina local (no localhost)
const API_BASE_URL = __DEV__ 
  ? 'http://192.168.1.38:8000/api/v1'  // Desarrollo local (tu IP local)
  : 'http://20.246.73.238:8000/api/v1';  // Producción Azure

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Verifica el estado del backend
 */
export const checkHealth = async (): Promise<{ status: string; model_loaded: boolean }> => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Error checking health:', error);
    throw error;
  }
};

/**
 * Envía landmarks al backend para obtener predicción
 */
export const predictSign = async (landmarks: number[][]): Promise<PredictionResponse> => {
  try {
    const payload: LandmarksRequest = { landmarks };
    const response = await api.post<PredictionResponse>('/predict', payload);
    return response.data;
  } catch (error) {
    console.error('Error predicting sign:', error);
    throw error;
  }
};

export default api;
