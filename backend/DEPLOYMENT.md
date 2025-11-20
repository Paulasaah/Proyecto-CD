# 🚀 Guía de Deployment en Azure VM (Debian 12)

## 📋 Requisitos Previos

- Azure VM con Debian 12
- Acceso SSH a la VM
- Python 3.11
- Al menos 2GB RAM
- 10GB espacio en disco

## 🔧 Método 1: Deployment Automático

### 1. Conectar a la VM

```bash
ssh usuario@<IP-PUBLICA-VM>
```

### 2. Clonar o copiar el proyecto

```bash
# Opción A: Desde Git
git clone <tu-repositorio> /tmp/lsc-api
cd /tmp/lsc-api/backend

# Opción B: Copiar desde local
scp -r backend/ usuario@<IP-VM>:/tmp/lsc-api
ssh usuario@<IP-VM>
cd /tmp/lsc-api
```

### 3. Ejecutar script de deployment

```bash
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh
```

El script automáticamente:
- ✅ Actualiza el sistema
- ✅ Instala Python 3.11 y dependencias
- ✅ Crea entorno virtual
- ✅ Instala dependencias Python
- ✅ Configura systemd service
- ✅ Configura Nginx como reverse proxy
- ✅ Inicia el servicio

### 4. Verificar deployment

```bash
# Ver estado del servicio
sudo systemctl status lsc-api

# Ver logs
sudo journalctl -u lsc-api -f

# Probar API
curl http://localhost:8000/api/v1/health
```

## 🔧 Método 2: Deployment Manual

### 1. Preparar el sistema

```bash
# Actualizar sistema
sudo apt-get update && sudo apt-get upgrade -y

# Instalar dependencias
sudo apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    nginx \
    build-essential \
    libhdf5-dev \
    pkg-config
```

### 2. Configurar aplicación

```bash
# Crear directorio
sudo mkdir -p /opt/lsc-api
sudo chown -R $USER:$USER /opt/lsc-api

# Copiar archivos
cp -r app models requirements.txt .env /opt/lsc-api/
cd /opt/lsc-api

# Crear entorno virtual
python3.11 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

```bash
# Editar .env
nano /opt/lsc-api/.env
```

Actualizar para producción:
```env
ENV=production
API_PORT=8000
CORS_ORIGINS=https://tu-dominio.com
MODEL_PATH=models/model.weights.h5
LABELS_PATH=models/label_map.json
RATE_LIMIT=100
```

### 4. Configurar systemd

```bash
# Crear service file
sudo nano /etc/systemd/system/lsc-api.service
```

Contenido:
```ini
[Unit]
Description=LSC Sign Language API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/lsc-api
Environment="PATH=/opt/lsc-api/venv/bin"
EnvironmentFile=/opt/lsc-api/.env
ExecStart=/opt/lsc-api/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Habilitar e iniciar servicio
sudo systemctl daemon-reload
sudo systemctl enable lsc-api
sudo systemctl start lsc-api
sudo systemctl status lsc-api
```

### 5. Configurar Nginx

```bash
# Crear configuración
sudo nano /etc/nginx/sites-available/lsc-api
```

Contenido:
```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (si es necesario)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Activar configuración
sudo ln -s /etc/nginx/sites-available/lsc-api /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Opcional
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Configurar Firewall

```bash
# Permitir HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 🐳 Método 3: Deployment con Docker

### 1. Instalar Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Build y run

```bash
# Build imagen
docker build -t lsc-api .

# Run contenedor
docker run -d \
    --name lsc-api \
    -p 8000:8000 \
    --restart unless-stopped \
    lsc-api

# O usar docker-compose
docker-compose up -d
```

## 🔒 Configuración SSL (Opcional)

### Con Certbot (Let's Encrypt)

```bash
# Instalar Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com

# Renovación automática
sudo systemctl enable certbot.timer
```

## 📊 Monitoreo

### Ver logs

```bash
# Logs del servicio
sudo journalctl -u lsc-api -f

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Métricas

```bash
# CPU y memoria
htop

# Requests
sudo tail -f /var/log/nginx/access.log | grep "POST /api/v1/predict"
```

## 🔄 Actualización

```bash
# Detener servicio
sudo systemctl stop lsc-api

# Actualizar código
cd /opt/lsc-api
git pull  # o copiar nuevos archivos

# Actualizar dependencias
source venv/bin/activate
pip install -r requirements.txt

# Reiniciar servicio
sudo systemctl start lsc-api
```

## 🐛 Troubleshooting

### Servicio no inicia

```bash
# Ver logs detallados
sudo journalctl -u lsc-api -n 100 --no-pager

# Verificar permisos
ls -la /opt/lsc-api

# Probar manualmente
cd /opt/lsc-api
source venv/bin/activate
python -m app.main
```

### Error de modelo

```bash
# Verificar archivos del modelo
ls -lh /opt/lsc-api/models/

# Verificar rutas en .env
cat /opt/lsc-api/.env
```

### Nginx error

```bash
# Verificar configuración
sudo nginx -t

# Ver logs
sudo tail -f /var/log/nginx/error.log
```

## 📈 Optimización para Producción

### 1. Aumentar workers

Editar `/etc/systemd/system/lsc-api.service`:
```ini
ExecStart=/opt/lsc-api/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 8
```

### 2. Configurar cache

Agregar a Nginx:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g;

location /api/v1/predict {
    proxy_cache api_cache;
    proxy_cache_valid 200 1m;
    # ...
}
```

### 3. Rate limiting

Agregar a Nginx:
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/v1/predict {
    limit_req zone=api_limit burst=20 nodelay;
    # ...
}
```

## 🎯 Checklist de Deployment

- [ ] VM creada en Azure
- [ ] Python 3.11 instalado
- [ ] Dependencias del sistema instaladas
- [ ] Código copiado a `/opt/lsc-api`
- [ ] Entorno virtual creado
- [ ] Dependencias Python instaladas
- [ ] Variables de entorno configuradas
- [ ] Systemd service configurado
- [ ] Nginx configurado
- [ ] Firewall configurado
- [ ] SSL configurado (opcional)
- [ ] Health check funcionando
- [ ] Logs monitoreados

## 📞 Soporte

Para problemas o preguntas, revisar:
- Logs del servicio: `sudo journalctl -u lsc-api -f`
- Documentación API: `http://<IP-VM>/docs`
- Health check: `http://<IP-VM>/api/v1/health`
