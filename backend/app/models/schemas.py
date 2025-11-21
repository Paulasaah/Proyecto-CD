"""
Esquemas Pydantic para validación de datos.
Principio: Interface Segregation - Interfaces específicas para cada caso.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List


class TopPrediction(BaseModel):
    """Predicción individual con etiqueta y confianza."""
    label: str = Field(..., description="Etiqueta de la seña predicha")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Nivel de confianza (0-1)")


class PredictionResponse(BaseModel):
    """Respuesta de predicción con top 3 resultados."""
    prediction: str = Field(..., description="Predicción principal")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confianza de la predicción principal")
    top_3: List[TopPrediction] = Field(..., description="Top 3 predicciones")
    
    class Config:
        json_schema_extra = {
            "example": {
                "prediction": "hola",
                "confidence": 0.95,
                "top_3": [
                    {"label": "hola", "confidence": 0.95},
                    {"label": "buenos_dias", "confidence": 0.03},
                    {"label": "gracias", "confidence": 0.01}
                ]
            }
        }


class LandmarksRequest(BaseModel):
    """Request con landmarks de MediaPipe."""
    landmarks: List[List[float]] = Field(
        ..., 
        description="Array de landmarks (shape: [frames, features])"
    )
    
    @field_validator('landmarks')
    @classmethod
    def validate_landmarks_shape(cls, v):
        """Valida que los landmarks tengan la forma correcta."""
        if not v:
            raise ValueError("landmarks no puede estar vacío")
        
        # Verificar que todas las filas tengan la misma longitud
        first_len = len(v[0]) if v else 0
        if not all(len(row) == first_len for row in v):
            raise ValueError("Todas las filas de landmarks deben tener la misma longitud")
        
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "landmarks": [[0.1, 0.2, 0.3] * 75] * 40  # Ejemplo simplificado
            }
        }


class HealthResponse(BaseModel):
    """Respuesta del endpoint de health check."""
    status: str
    model_loaded: bool = False


class GlosaTranslateRequest(BaseModel):
    """Request para traducir una frase de glosas a español."""
    glosas: List[str]


class GlosaTranslateResponse(BaseModel):
    """Respuesta con glosas originales y frase en español."""
    glosas: List[str]
    spanish: str
