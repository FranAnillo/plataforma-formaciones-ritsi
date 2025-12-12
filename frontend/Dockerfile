# frontend/Dockerfile
FROM node:18-alpine

# Directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json (si existe)
COPY package*.json /app/

# Instalar dependencias
RUN npm install

# Copiar el resto del código del frontend
COPY . /app

# Variable para apuntar al backend (se sobreescribe en docker-compose)
ENV REACT_APP_BACKEND_URL=http://localhost:8000

# Exponer el puerto de desarrollo de React
EXPOSE 3000

# Ejecutar la app en modo desarrollo
CMD ["npm", "start"]
