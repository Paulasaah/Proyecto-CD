"""
Aplicación principal FastAPI.
Principio: Open/Closed - Extensible mediante routers sin modificar el core.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.routes import router as api_router
from app.core.config import settings

# Crear aplicación
app = FastAPI(
    title="LSC Sign Language API",
    description="API para reconocimiento de Lenguaje de Señas Colombiano usando TensorFlow",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(api_router, prefix="/api/v1", tags=["Predictions"])


@app.get("/", tags=["Root"])
async def root():
    """Endpoint raíz con información de la API."""
    return {
        "message": "LSC Sign Language API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health"
    }


@app.on_event("startup")
async def startup_event():
    """Evento de inicio de la aplicación."""
    print("🚀 Iniciando LSC Sign Language API...")
    print(f"📍 Entorno: {settings.ENV}")
    print(f"🔧 CORS habilitado para: {settings.CORS_ORIGINS}")


@app.on_event("shutdown")
async def shutdown_event():
    """Evento de cierre de la aplicación."""
    print("👋 Cerrando LSC Sign Language API...")
