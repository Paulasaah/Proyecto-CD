"""
Configuración centralizada de la aplicación.
Principio: Single Responsibility - Solo maneja configuración.
"""
import os
from typing import List
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Configuración de la aplicación cargada desde variables de entorno."""
    
    # Entorno
    ENV: str = os.getenv("ENV", "development")
    
    # API
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    
    # CORS
    CORS_ORIGINS: List[str] = os.getenv(
        "CORS_ORIGINS", 
        "http://localhost:5173,http://localhost:19006"
    ).split(",")
    
    # Modelo
    MODEL_PATH: str = os.getenv("MODEL_PATH", "models/model.weights.h5")
    LABELS_PATH: str = os.getenv("LABELS_PATH", "models/label_map.json")
    
    # Rate limiting
    RATE_LIMIT: int = int(os.getenv("RATE_LIMIT", "100"))
    
    @property
    def is_production(self) -> bool:
        """Verifica si está en producción."""
        return self.ENV == "production"


settings = Settings()
