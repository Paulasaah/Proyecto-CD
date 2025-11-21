/**
 * Pantalla principal - Captura de cámara y predicción
 */
import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { Button, Text, Card, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { usePredictionStore } from '../src/store/predictionStore';
import { checkHealth, predictSignFromVideo, predictSignFromVideoFile, translateGlosas } from '../src/services/api';

const LOW_CONFIDENCE_THRESHOLD = 0.6;

export default function HomeScreen() {
  const router = useRouter();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    currentPrediction,
    isLoading,
    glosaPhrase,
    spanishTranslation,
    setPrediction,
    addToHistory,
    addGlosa,
    removeLastGlosa,
    clearGlosaPhrase,
    setLoading,
    setError,
    setSpanishTranslation,
  } = usePredictionStore();

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

  const handleVideoPickMobile = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Disponible solo en móvil', 'En web utiliza el botón de "Subir Video" estándar.');
      return;
    }

    try {
      setLoading(true);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permisos', 'Se requiere acceso a la galería para seleccionar un video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        throw new Error('No se pudo obtener la URI del video seleccionado');
      }

      console.log('🎥 Procesando video seleccionado desde galería:', asset.uri);
      const prediction = await predictSignFromVideo(asset.uri);

      setPrediction(prediction);
      addToHistory(prediction);
      addGlosa(prediction.prediction);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al seleccionar video';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    if (backendStatus !== 'online') {
      Alert.alert('Error', 'El backend no está disponible');
      return;
    }
    // En web, deshabilitar captura directa y usar solo "Subir Video"
    if (isWeb) {
      Alert.alert(
        'Disponible solo en móvil',
        'La captura directa de seña está disponible en la app móvil. En web usa "Subir Video" para enviar un archivo.'
      );
      return;
    }

    // Flujo móvil nativo: usar la cámara del sistema para grabar un video y enviarlo al backend
    try {
      setLoading(true);
      console.log('🎬 Grabando video de la seña (móvil)...');

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permisos', 'Se requiere acceso a la cámara para grabar un video.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        throw new Error('No se pudo obtener la URI del video grabado');
      }

      console.log('📤 Enviando video grabado al backend...');
      const prediction = await predictSignFromVideo(asset.uri);

      setPrediction(prediction);
      addToHistory(prediction);
      addGlosa(prediction.prediction);

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
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    // En móvil, permitir seleccionar un video desde la galería
    handleVideoPickMobile();
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      console.log('🎥 Procesando video subido:', file.name);
      const prediction = await predictSignFromVideoFile(file);
      setPrediction(prediction);
      addToHistory(prediction);
      addGlosa(prediction.prediction);
      console.log('✅ Predicción desde video:', prediction.prediction);
    } catch (error) {
      console.error('❌ Error procesando video:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido procesando video';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleTranslateGlosas = async () => {
    if (glosaPhrase.length === 0) {
      Alert.alert('Sin glosas', 'Primero captura al menos una seña para generar glosas.');
      return;
    }

    try {
      setLoading(true);
      const response = await translateGlosas(glosaPhrase);
      setSpanishTranslation(response.spanish);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido al traducir glosas';
      setError(message);
      Alert.alert('Error', `No se pudo traducir la frase de glosas: ${message}`);
    } finally {
      setLoading(false);
    }
  };

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
            <Text variant="bodyMedium">Procesamiento:</Text>
            <Text variant="bodyMedium">Video → Backend TensorFlow</Text>
          </View>
        </Card.Content>
      </Card>

      {/* Vista de Cámara */}
      <View style={styles.cameraContainer}>
        <View style={styles.cameraPaused}>
          <Text style={styles.pauseTitle}>
            {Platform.OS === 'web'
              ? 'En web, usa "Subir Video" para elegir un archivo de seña desde tu computadora.'
              : 'Usa "Capturar Seña" o "Subir Video" para grabar o seleccionar un video desde tu dispositivo.'}
          </Text>
          <Text style={styles.pauseSubtitle}>
            El procesamiento de la seña se realiza en el backend con TensorFlow.
          </Text>
        </View>
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

      {/* Frase de glosas */}
      {glosaPhrase.length > 0 && (
        <Card style={styles.glosaCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.glosaTitle}>
              Frase de glosas
            </Text>
            <Text variant="bodyMedium" style={styles.glosaText}>
              {glosaPhrase.join(' / ')}
            </Text>
            {spanishTranslation && (
              <>
                <Text variant="titleSmall" style={styles.translationTitle}>
                  Traducción al español
                </Text>
                <Text variant="bodyMedium" style={styles.translationText}>
                  {spanishTranslation}
                </Text>
              </>
            )}

            <View style={styles.glosaButtonRow}>
              <Button
                mode="outlined"
                onPress={removeLastGlosa}
                style={styles.glosaButton}
              >
                Deshacer última glosa
              </Button>
              <Button
                mode="outlined"
                onPress={clearGlosaPhrase}
                style={styles.glosaButton}
              >
                Limpiar frase
              </Button>
              <Button
                mode="contained"
                onPress={handleTranslateGlosas}
                style={styles.glosaButton}
                disabled={isLoading || backendStatus !== 'online'}
              >
                Traducir a español
              </Button>
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
          loading={isLoading}
          disabled={
            isLoading ||
            backendStatus !== 'online'
          }
          style={styles.captureButton}
          icon="camera"
        >
          {isLoading ? 'Procesando...' : 'Capturar Seña'}
        </Button>
        
        <Button
          mode="outlined"
          icon="upload"
          onPress={handleUploadClick}
          disabled={isLoading || backendStatus !== 'online'}
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
  cameraWrapper: {
    flex: 1,
    position: 'relative',
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
    ...StyleSheet.absoluteFillObject,
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
  top3ButtonsContainer: {
    marginTop: 8,
    gap: 4,
  },
  top3Button: {
    alignSelf: 'stretch',
  },
  addGlosaButton: {
    marginTop: 12,
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
  glosaCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  glosaTitle: {
    marginBottom: 4,
  },
  glosaText: {
    fontWeight: 'bold',
  },
  glosaButtonRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  glosaButton: {
    flex: 1,
  },
  translationTitle: {
    marginTop: 8,
  },
  translationText: {
    marginTop: 2,
  },
});
