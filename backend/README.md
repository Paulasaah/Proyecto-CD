# LSC Sign Language API 🤟

API REST para reconocimiento de Lenguaje de Señas Colombiano (LSC) usando TensorFlow y FastAPI.

## Requisitos

- Python 3.11.8
- TensorFlow 2.16.1
- FastAPI 0.121.2

## Instalación

### 1. Configurar entorno virtual

```bash
# Crear entorno virtual con Python 3.11
python -m venv venv

# Activar entorno virtual
# En Linux/Mac:
source venv/bin/activate
# En Windows:
venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

Copia el archivo `.env` y ajusta las variables según tu entorno:

```bash
# Las variables ya están configuradas en .env
# Verifica que las rutas del modelo sean correctas
```

## Ejecución

### Modo desarrollo

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Modo producción

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Documentación API

Una vez iniciado el servidor, accede a:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🔌 Endpoints

### `POST /api/v1/predict`

Predice la seña a partir de landmarks de MediaPipe.

**Request:**
```json
{
  "landmarks": [[0.1, 0.2, ...], ...]
}
```

**Response:**
```json
{
  "prediction": "hola",
  "confidence": 0.95,
  "top_3": [
    {"label": "hola", "confidence": 0.95},
    {"label": "buenos_dias", "confidence": 0.03},
    {"label": "gracias", "confidence": 0.01}
  ]
}
```

### `GET /api/v1/health`

Verifica el estado del servicio y del modelo.

**Response:**
```json
{
  "status": "ok",
  "model_loaded": true
}
```

## Estructura del Proyecto

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Aplicación FastAPI
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── routes.py    # Endpoints de la API
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py        # Configuración
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py       # Modelos Pydantic
│   └── services/
│       ├── __init__.py
│       └── predictor.py     # Servicio de predicción
├── models/                   # Modelo TensorFlow
│   ├── model.weights.h5
│   ├── label_map.json
│   ├── config.json
│   └── metadata.json
├── scripts/                  # Scripts de deployment (en .gitignore)
│   ├── deploy.sh            # Deployment automático
│   ├── start.sh             # Script de inicio
│   ├── systemd.service      # Configuración systemd
│   └── README.md
├── .env                      # Variables de entorno
├── .gitignore
├── requirements.txt
├── README.md
├── DEPLOYMENT.md            # Guía de deployment
└── CHECKLIST.md             # Checklist de verificación
```

## Arquitectura

El proyecto sigue principios **SOLID** y arquitectura en capas:

- **Presentation Layer** (`api/`): Endpoints HTTP
- **Business Layer** (`services/`): Lógica de negocio
- **Data Layer** (`models/`): Esquemas y validación

### Patrones implementados:

- **Singleton**: `PredictorService` carga el modelo una sola vez
- **Dependency Injection**: Configuración inyectada desde `settings`
- **Repository Pattern**: Separación de lógica de datos

## 🔧 Configuración

Variables de entorno disponibles en `.env`:

| Variable | Descripción | Default |
|----------|-------------|---------|
| `ENV` | Entorno (development/production) | `development` |
| `API_PORT` | Puerto del servidor | `8000` |
| `CORS_ORIGINS` | Orígenes permitidos para CORS | `http://localhost:5173,...` |
| `MODEL_PATH` | Ruta al modelo TensorFlow | `models/model.weights.h5` |
| `LABELS_PATH` | Ruta al mapa de etiquetas | `models/label_map.json` |
| `RATE_LIMIT` | Límite de requests por minuto | `100` |

## Testing

```bash
# Instalar dependencias de testing
pip install pytest pytest-asyncio httpx

# Ejecutar tests
pytest
```

## Docker (Opcional)

```bash
# Construir imagen
docker build -t lsc-api .

# Ejecutar contenedor
docker run -p 8000:8000 lsc-api
```

## Integración con Frontend

### React (Web)

```typescript
const predictSign = async (landmarks: number[][]) => {
  const response = await fetch('http://localhost:8000/api/v1/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ landmarks })
  });
  return await response.json();
};
```

### React Native (Expo)

```typescript
import axios from 'axios';

const predictSign = async (landmarks: number[][]) => {
  const { data } = await axios.post(
    'http://localhost:8000/api/v1/predict',
    { landmarks }
  );
  return data;
};
```

