"""
Rutas de la API v1.
Principio: Single Responsibility - Solo define endpoints.
"""
import os
import tempfile

from fastapi import APIRouter, HTTPException, status, UploadFile, File
from app.models.schemas import (
    LandmarksRequest,
    PredictionResponse,
    HealthResponse,
    GlosaTranslateRequest,
    GlosaTranslateResponse,
)
from app.services.predictor import PredictorService
from app.services.video_processor import VideoProcessorService
from app.services.glosa_service import GlosaService

router = APIRouter()

# Inicializar servicios (singleton)
predictor = PredictorService.get_instance()
video_processor = VideoProcessorService()
glosa_service = GlosaService()


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


@router.post(
    "/predict-video",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predecir seña desde un video",
    description="Recibe un archivo de video, extrae landmarks con MediaPipe y retorna la predicción de la seña",
)
async def predict_from_video(file: UploadFile = File(...)) -> PredictionResponse:
    try:
        if not file.content_type or not file.content_type.startswith("video/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo debe ser un video válido",
            )

        suffix = os.path.splitext(file.filename or "video")[1] or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            contents = await file.read()
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            landmarks = video_processor.extract_landmarks_from_video(tmp_path)
            result = predictor.predict(landmarks)
            return PredictionResponse(**result)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error procesando el video: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}",
        )


@router.post(
    "/translate-glosas",
    response_model=GlosaTranslateResponse,
    status_code=status.HTTP_200_OK,
    summary="Traducir una frase de glosas a español",
    description="Recibe una lista de glosas y devuelve una frase simple en español.",
)
async def translate_glosas(request: GlosaTranslateRequest) -> GlosaTranslateResponse:
    try:
        sentence = glosa_service.translate(request.glosas)
        return GlosaTranslateResponse(glosas=request.glosas, spanish=sentence)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno del servidor: {str(e)}",
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
