"""
Rutas de la API v1.
Principio: Single Responsibility - Solo define endpoints.
"""
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import LandmarksRequest, PredictionResponse, HealthResponse
from app.services.predictor import PredictorService

router = APIRouter()

# Inicializar servicio (singleton)
predictor = PredictorService.get_instance()


@router.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predecir seña desde landmarks",
    description="Recibe landmarks de MediaPipe y retorna la predicción de la seña"
)
async def predict(request: LandmarksRequest) -> PredictionResponse:
    """
    Endpoint de predicción.
    
    Args:
        request: Landmarks de la seña capturada
        
    Returns:
        PredictionResponse con la predicción y confianza
        
    Raises:
        HTTPException: Si hay error en la predicción
    """
    try:
        result = predictor.predict(request.landmarks)
        return PredictionResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error en los datos de entrada: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}"
        )


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check del servicio",
    description="Verifica que el servicio y el modelo estén funcionando"
)
async def health_check() -> HealthResponse:
    """
    Endpoint de health check.
    
    Returns:
        HealthResponse con estado del servicio
    """
    return HealthResponse(
        status="ok" if predictor.is_loaded else "error",
        model_loaded=predictor.is_loaded
    )
