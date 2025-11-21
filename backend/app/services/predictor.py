"""
Servicio de predicción con modelo TensorFlow.
Principios: Single Responsibility, Dependency Injection.
Patrón: Singleton para cargar el modelo una sola vez.
"""
import json
import numpy as np
import tensorflow as tf
from typing import Dict, List
from pathlib import Path

from app.core.config import settings


class PredictorService:
    """
    Servicio singleton para predicciones de lenguaje de señas.
    Carga el modelo una vez y lo reutiliza para todas las predicciones.
    """
    _instance = None
    _model = None
    _labels = None

    MODEL_DIR = Path("models/model (2)")

    def __new__(cls):
        """Implementación del patrón Singleton."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Inicializa el servicio cargando el modelo si no está cargado."""
        if self._model is None:
            self._load_model()

    def _build_model_architecture(self) -> tf.keras.Model:
        """
        Construye la arquitectura del modelo manualmente.
        Basado en config.json: Bidirectional LSTM + Attention + LSTM + Dense
        """
        # Input: (batch, 40 frames, 95 features)
        inputs = tf.keras.layers.Input(shape=(40, 95), name='input_layer')
        
        # Layer Normalization
        x = tf.keras.layers.LayerNormalization(name='layer_normalization')(inputs)
        
        # Bidirectional LSTM
        x = tf.keras.layers.Bidirectional(
            tf.keras.layers.LSTM(128, return_sequences=True, name='forward_lstm'),
            name='bidirectional'
        )(x)
        
        # Dropout
        x = tf.keras.layers.Dropout(0.3, name='dropout')(x)
        
        # Multi-Head Attention
        x = tf.keras.layers.MultiHeadAttention(
            num_heads=4,
            key_dim=64,
            value_dim=64,
            name='multi_head_attention'
        )(x, x)
        
        # Dropout
        x = tf.keras.layers.Dropout(0.3, name='dropout_2')(x)
        
        # LSTM
        x = tf.keras.layers.LSTM(128, name='lstm_1')(x)
        
        # Dense + ReLU
        x = tf.keras.layers.Dense(128, activation='relu', name='dense')(x)
        
        # Dropout
        x = tf.keras.layers.Dropout(0.3, name='dropout_3')(x)
        
        # Output: 41 classes with softmax
        outputs = tf.keras.layers.Dense(41, activation='softmax', name='dense_1')(x)
        
        return tf.keras.Model(inputs=inputs, outputs=outputs, name='functional')

    def _load_model(self) -> None:
        """
        Carga el modelo construyendo la arquitectura manualmente y cargando pesos.
        Evita problemas con loss_fn personalizada en config.json.
        """
        try:
            print("🔄 Cargando modelo desde carpeta best_advanced_lsc")

            weights_path = self.MODEL_DIR / "model.weights.h5"
            labels_path = Path(settings.LABELS_PATH)

            # Validaciones
            if not weights_path.exists():
                raise FileNotFoundError(f"No existe model.weights.h5 en: {weights_path}")

            if not labels_path.exists():
                raise FileNotFoundError(f"No existe label_map.json en: {labels_path}")

            # Construir arquitectura manualmente (evita problemas con loss_fn)
            print("📐 Construyendo arquitectura del modelo...")
            self._model = self._build_model_architecture()

            # Cargar pesos
            print("⚖️  Cargando pesos desde model.weights.h5...")
            self._model.load_weights(str(weights_path))

            print("✅ Modelo cargado correctamente")

            # Cargar labels
            with open(labels_path, "r", encoding="utf-8") as f:
                self._labels = json.load(f)

            print(f"📌 Etiquetas cargadas: {len(self._labels)} clases")

        except Exception as e:
            print(f"❌ Error cargando modelo: {e}")
            raise

    def predict(self, landmarks: List[List[float]]) -> Dict:
        """
        Realiza predicción sobre landmarks.
        """
        if self._model is None:
            raise ValueError("Modelo no cargado")

        arr = self._preprocess_landmarks(landmarks)

        # Predicción
        predictions = self._model.predict(arr, verbose=0)[0]

        # Top 3
        top3_indices = predictions.argsort()[-3:][::-1]

        return {
            "prediction": self._labels[str(top3_indices[0])],
            "confidence": float(predictions[top3_indices[0]]),
            "top_3": [
                {
                    "label": self._labels[str(idx)],
                    "confidence": float(predictions[idx])
                }
                for idx in top3_indices
            ]
        }

    def _preprocess_landmarks(self, landmarks: List[List[float]]) -> np.ndarray:
        """Convierte la lista de landmarks a tensor (1, frames, features) y
        aplica la misma normalización por muestra que en el entrenamiento.

        En el entrenamiento se usó:

            mean = X.mean(axis=(1, 2), keepdims=True)
            std  = X.std(axis=(1, 2), keepdims=True) + 1e-6
            X = (X - mean) / std

        Aquí replicamos exactamente ese comportamiento para cada secuencia
        recibida en inferencia.
        """
        arr = np.array(landmarks, dtype=np.float32)

        # Asegurar dimensión batch: (1, frames, features)
        if len(arr.shape) == 2:
            arr = np.expand_dims(arr, axis=0)

        # Normalización por muestra (video)
        mean = arr.mean(axis=(1, 2), keepdims=True)
        std = arr.std(axis=(1, 2), keepdims=True) + 1e-6
        arr = (arr - mean) / std

        return arr

    @property
    def is_loaded(self) -> bool:
        return self._model is not None and self._labels is not None

    @classmethod
    def get_instance(cls) -> "PredictorService":
        return cls()
