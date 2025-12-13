# 🚀 Guía de Inicio Rápido con Docker

## 1. Requisitos previos

* **Docker** y **Docker Compose** instalados.
* Estar en la **raíz del proyecto `plataforma-formaciones-ritsi`** (donde está el archivo `docker-compose.yml`).
* Puedes cambiar la SECRET_KEY en el docker-compose, y poner la tuya propia, ten en cuenta que luego no puedes subirla a GitHub. Para generarla puedes usar:

<pre class="overflow-visible! px-0!" data-start="1677" data-end="1751"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python </span><span>-c</span><span> </span><span>"import secrets; print(secrets.token_hex(32))"</span><span>
</span></span></code></div></div></pre>

---

## 2. Construir y levantar los servicios

<pre class="overflow-visible! px-0!" data-start="378" data-end="418"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose up -d --build
</span></span></code></div></div></pre>

Esto arranca:

* **mongo** en el puerto **27017**
* **backend** en el puerto **8000**
* **frontend** en el puerto **3000**

### 🔍 Comprobaciones rápidas

* Backend → [http://localhost:8000](http://localhost:8000)
* Frontend → [http://localhost:3000](http://localhost:3000)

### 📜 Ver logs

<pre class="overflow-visible! px-0!" data-start="670" data-end="744"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose logs -f backend
docker compose logs -f frontend
</span></span></code></div></div></pre>

### ⛔ Parar los contenedores

<pre class="overflow-visible! px-0!" data-start="776" data-end="807"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose down
</span></span></code></div></div></pre>

---

## 3. Volúmenes y persistencia

MongoDB usa el volumen **`mongo_data`**, declarado en `docker-compose.yml`, para **persistir los datos entre reinicios de contenedores**.

---

# 🐍 Uso de scripts con Docker

El servicio **`scripts`** está definido para reutilizar la **misma imagen del backend** y ejecutar scripts Python dentro del contenedor, con el código montado en `/app`.

### 📁 Estructura relevante

<pre class="overflow-visible! px-0!" data-start="1222" data-end="1347"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>backend/server.py
backend/scripts/create_admin.py
backend/scripts/create_user.py
backend/scripts/init_universities.py
</span></span></code></div></div></pre>

En `docker-compose.yml`, el servicio `scripts` tiene:

<pre class="overflow-visible! px-0!" data-start="1404" data-end="1489"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>volumes:
  - ./backend:/app
working_dir: /app
environment:
  PYTHONPATH: /app
</span></span></code></div></div></pre>

Esto permite usar imports como:

<pre class="overflow-visible! px-0!" data-start="1524" data-end="1565"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-python"><span><span>from</span><span> server </span><span>import</span><span> UserType
</span></span></code></div></div></pre>

---

## 1️⃣ Ejecutar el script de creación de admin

<pre class="overflow-visible! px-0!" data-start="1620" data-end="1741"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts python scripts/create_admin.py </span><span>"correo@example.com"</span><span> </span><span>"Administrador Principal"</span><span>
</span></span></code></div></div></pre>

---

## 2️⃣ Ejecutar el script de creación de usuario

<pre class="overflow-visible! px-0!" data-start="1798" data-end="1909"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts python scripts/create_user.py </span><span>"correo@example.com"</span><span> </span><span>"Nombre Usuario"</span><span>
</span></span></code></div></div></pre>

---

## 3️⃣ Ejecutar el script de inicialización de universidades

<pre class="overflow-visible! px-0!" data-start="1978" data-end="2057"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts python scripts/init_universities.py
</span></span></code></div></div></pre>

---

## 📝 Notas importantes

El comando siempre sigue el patrón:

<pre class="overflow-visible! px-0!" data-start="2126" data-end="2208"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts python RUTA_DEL_SCRIPT [argumentos...]
</span></span></code></div></div></pre>

* `--rm` elimina el contenedor temporal después de ejecutar el script.
* **Todos los comandos deben ejecutarse desde la raíz del proyecto `plataforma-formaciones-ritsi`.**
