/**
 * Pantalla principal - Captura de cámara y predicción
 */
import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { Button, Text, Card, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { usePredictionStore } from '../src/store/predictionStore';
import { checkHealth, predictSign, predictSignFromVideo } from '../src/services/api';
import { useMediaPipe } from '../src/hooks/useMediaPipe';

const LOW_CONFIDENCE_THRESHOLD = 0.6;

export default function HomeScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const cameraRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { currentPrediction, isLoading, setPrediction, addToHistory, setLoading, setError } = usePredictionStore();
  const { captureFrames, processVideoFile, isProcessing, isReady: mediaPipeReady, error: mediaPipeError } = useMediaPipe();

  const isWeb = Platform.OS === 'web';

  const isLowConfidence = currentPrediction
    ? currentPrediction.confidence < LOW_CONFIDENCE_THRESHOLD
    : false;

  const confidenceValue = currentPrediction?.confidence ?? null;
  const confidenceLevel = confidenceValue === null
    ? null
    : confidenceValue >= 0.8
      ? 'high'
      : confidenceValue >= LOW_CONFIDENCE_THRESHOLD
        ? 'medium'
        : 'low';

  useEffect(() => {
    // Verificar estado del backend al iniciar
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const health = await checkHealth();
      setBackendStatus(health.model_loaded ? 'online' : 'offline');
    } catch (error) {
      setBackendStatus('offline');
      console.error('Backend offline:', error);
    }
  };

  const handleCapture = async () => {
    if (backendStatus !== 'online') {
      Alert.alert('Error', 'El backend no está disponible');
      return;
    }
    // Flujo web: usar MediaPipe en el navegador
    if (isWeb) {
      if (!mediaPipeReady) {
        Alert.alert(
          'MediaPipe',
          'MediaPipe todavía se está inicializando. Intenta de nuevo en unos segundos.'
        );
        return;
      }

      try {
        setLoading(true);
        if (!cameraEnabled) {
          setCameraEnabled(true);
        }
        // Obtener el elemento de video (en web)
        const videoElement = document.querySelector('video') as HTMLVideoElement;
        if (!videoElement) {
          throw new Error('No se encontró el elemento de video');
        }

        // Capturar 40 frames con landmarks
        console.log('🎬 Capturando seña (web)...');
        const landmarks = await captureFrames(videoElement);
        
        // Enviar al backend
        console.log('📤 Enviando al backend...');
        const prediction = await predictSign(landmarks);
        
        // Actualizar estado
        setPrediction(prediction);
        addToHistory(prediction);
        
        console.log('✅ Predicción:', prediction.prediction, `(${(prediction.confidence * 100).toFixed(1)}%)`);
        
      } catch (error) {
        console.error('❌ Error en captura (web):', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        setError(errorMessage);
        Alert.alert('Error', `No se pudo procesar la seña: ${errorMessage}`);
      } finally {
        setLoading(false);
      }

      return;
    }

    // Flujo móvil nativo: grabar un video corto y enviarlo al backend
    try {
      if (!cameraRef.current) {
        throw new Error('La cámara no está lista');
      }

      setLoading(true);
      console.log('🎬 Grabando video de la seña (móvil)...');

      const recording = await cameraRef.current.recordAsync({
        maxDuration: 3,
        quality: '480p',
      });

      if (!recording?.uri) {
        throw new Error('No se pudo obtener el video grabado');
      }

      console.log('📤 Enviando video al backend...');
      const prediction = await predictSignFromVideo(recording.uri);

      setPrediction(prediction);
      addToHistory(prediction);

      console.log('✅ Predicción desde video (móvil):', prediction.prediction, `(${(prediction.confidence * 100).toFixed(1)}%)`);
    } catch (error) {
      console.error('❌ Error en captura (móvil):', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al grabar o enviar el video';
      setError(errorMessage);
      Alert.alert('Error', `No se pudo procesar la seña: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Disponible solo en web', 'La carga de videos se encuentra disponible en la versión web del demo.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCameraEnabled(false);
      setLoading(true);
      console.log('🎥 Procesando video subido:', file.name);
      const landmarks = await processVideoFile(file);
      const prediction = await predictSign(landmarks);
      setPrediction(prediction);
      addToHistory(prediction);
      console.log('✅ Predicción desde video:', prediction.prediction);
    } catch (error) {
      console.error('❌ Error procesando video:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido procesando video';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setCameraEnabled(true);
      event.target.value = '';
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Necesitamos acceso a la cámara para reconocer señas
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.button}>
          Permitir Cámara
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Estado del Sistema */}
      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.statusRow}>
            <Text variant="bodyMedium">Backend:</Text>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: backendStatus === 'online' ? '#4caf50' : '#f44336' }
            ]} />
            <Text variant="bodyMedium">
              {backendStatus === 'checking' ? 'Verificando...' : 
               backendStatus === 'online' ? 'Conectado' : 'Desconectado'}
            </Text>
          </View>
          <View style={[styles.statusRow, { marginTop: 8 }]}>
            <Text variant="bodyMedium">MediaPipe:</Text>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor: isWeb
                    ? (mediaPipeReady ? '#4caf50' : '#ff9800')
                    : '#9e9e9e',
                },
              ]}
            />
            <Text variant="bodyMedium">
              {isWeb
                ? (mediaPipeReady ? 'Listo' : 'Cargando...')
                : 'No disponible en móvil (demo web)'}
            </Text>
          </View>
          {mediaPipeError && (
            <Text variant="bodySmall" style={styles.mediaPipeErrorText}>
              {mediaPipeError}
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Vista de Cámara */}
      <View style={styles.cameraContainer}>
        {cameraEnabled ? (
          <CameraView 
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          >
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>
                {isLoading || isProcessing 
                  ? '⏳ Procesando...' 
                  : 'Coloca tu mano frente a la cámara'}
              </Text>
            </View>
          </CameraView>
        ) : (
          <View style={styles.cameraPaused}>
            <Text style={styles.pauseTitle}>Modo video activo</Text>
            <Text style={styles.pauseSubtitle}>
              La cámara se reanudará automáticamente al terminar el procesamiento del video.
            </Text>
          </View>
        )}
      </View>

      {/* Resultado de Predicción */}
      {currentPrediction && (
        <Card style={styles.predictionCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.predictionText}>
              {currentPrediction.prediction}
            </Text>
            <Text variant="bodyMedium" style={styles.confidenceText}>
              Confianza: {(currentPrediction.confidence * 100).toFixed(1)}%
            </Text>

            {confidenceLevel && (
              <View
                style={[
                  styles.confidenceBadge,
                  confidenceLevel === 'high' && styles.confidenceHigh,
                  confidenceLevel === 'medium' && styles.confidenceMedium,
                  confidenceLevel === 'low' && styles.confidenceLow,
                ]}
              >
                <Text style={styles.confidenceBadgeText}>
                  {confidenceLevel === 'high'
                    ? 'Confianza alta'
                    : confidenceLevel === 'medium'
                      ? 'Confianza media'
                      : 'Confianza baja'}
                </Text>
              </View>
            )}

            {isLowConfidence && (
              <Text variant="bodySmall" style={styles.lowConfidenceText}>
                Confianza baja (&lt;{(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}%), el modelo está inseguro.
                Intenta repetir la seña más clara o acercar la mano.
              </Text>
            )}

            <View style={styles.top3Container}>
              <Text variant="bodySmall" style={styles.top3Title}>
                Top 3 predicciones
              </Text>
              {currentPrediction.top_3.map((item, idx) => (
                <Text
                  key={`${item.label}-${idx}`}
                  variant="bodySmall"
                  style={styles.top3Item}
                >
                  {idx + 1}. {item.label} ({(item.confidence * 100).toFixed(1)}%)
                </Text>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}

      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleVideoUpload}
        />
      )}

      {/* Botones de Acción */}
      <View style={styles.buttonContainer}>
        <Button 
          mode="contained" 
          onPress={handleCapture}
          loading={isLoading || isProcessing}
          disabled={
            isLoading ||
            isProcessing ||
            backendStatus !== 'online' ||
            (isWeb && (!mediaPipeReady || !cameraEnabled))
          }
          style={styles.captureButton}
          icon="camera"
        >
          {isLoading || isProcessing ? 'Procesando...' : 
           !mediaPipeReady ? 'Cargando MediaPipe...' : 'Capturar Seña'}
        </Button>
        
        <Button
          mode="outlined"
          icon="upload"
          onPress={handleUploadClick}
          disabled={isLoading || isProcessing || backendStatus !== 'online' || !mediaPipeReady}
          style={styles.uploadButton}
        >
          Subir Video
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={() => router.push('/history')}
          style={styles.historyButton}
        >
          Ver Historial
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  message: {
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  button: {
    marginHorizontal: 20,
  },
  statusCard: {
    margin: 16,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  cameraContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
  },
  camera: {
    flex: 1,
  },
  cameraPaused: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  pauseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  pauseSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  predictionCard: {
    margin: 16,
    backgroundColor: '#6200ee',
    elevation: 4,
  },
  predictionText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  confidenceText: {
    color: 'white',
    textAlign: 'center',
    marginTop: 4,
  },
  confidenceBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  confidenceBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  confidenceHigh: {
    backgroundColor: '#2e7d32',
  },
  confidenceMedium: {
    backgroundColor: '#f9a825',
  },
  confidenceLow: {
    backgroundColor: '#c62828',
  },
  lowConfidenceText: {
    color: '#ffeb3b',
    textAlign: 'center',
    marginTop: 8,
  },
  top3Container: {
    marginTop: 12,
  },
  top3Title: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  top3Item: {
    color: 'white',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  captureButton: {
    paddingVertical: 8,
  },
  uploadButton: {
    borderColor: '#2196f3',
  },
  historyButton: {
    borderColor: '#6200ee',
  },
  mediaPipeErrorText: {
    marginTop: 4,
    marginHorizontal: 16,
    color: '#f44336',
    fontSize: 12,
  },
});
