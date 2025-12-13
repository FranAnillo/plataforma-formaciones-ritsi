# backend/Dockerfile
FROM python:3.12-slim

# Evitar archivos .pyc y buffering
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Crear directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema (por si algunas libs lo requieren)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalarlos
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del backend
COPY . /app

# Variables de entorno por defecto (se pueden sobreescribir en docker-compose)
ENV MONGO_URL=mongodb://mongo:27017 \
    DB_NAME=plataforma_formativa_ritsi \
    SECRET_KEY=change_me_in_compose

# Exponer el puerto del backend
EXPOSE 8000

# Comando por defecto: levantar FastAPI con uvicorn
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
