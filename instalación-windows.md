# 🚀 Guía Completa de Instalación en Windows

Plataforma de Formaciones RITSI

Esta guía describe todos los pasos necesarios para instalar y ejecutar la plataforma (backend + frontend) en un entorno Windows de forma correcta.

---

## 🧩 Prerrequisitos

Antes de comenzar, instala:

### ✔ Node.js (v18 o superior)

https://nodejs.org/

### ✔ Python (v3.9 o superior)

https://www.python.org/

### ✔ MongoDB Community Server

https://www.mongodb.com/try/download/community

### ✔ Git (opcional, recomendado)

https://git-scm.com/

Puedes comprobar las versiones con:

```powershell
node -v
python --version
mongod --version
```

## 1️⃣ Configuración del Backend (FastAPI)

El backend utiliza **FastAPI** y una base de datos **MongoDB**.

---

### 📌 1. Ir al directorio del backend

<pre class="overflow-visible! px-0!" data-start="1094" data-end="1122"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>cd</span><span> backend
</span></span></code></div></div></pre>

---

### 📌 2. Crear y activar el entorno virtual

<pre class="overflow-visible! px-0!" data-start="1174" data-end="1233"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python </span><span>-m</span><span> venv venv
venv\Scripts\activate
</span></span></code></div></div></pre>

El entorno estará activo cuando veas `(venv)` al inicio de la línea de comandos.

---

### 📌 3. Instalar dependencias

<pre class="overflow-visible! px-0!" data-start="1354" data-end="1403"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>pip install </span><span>-r</span><span> requirements.txt
</span></span></code></div></div></pre>

---

### 📌 4. Crear o Buscar un archivo `.env`

En la carpeta **backend**, crea o busca un archivo llamado `.env` con este contenido:

<pre class="overflow-visible! px-0!" data-start="1520" data-end="1631"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>MONGO_URL</span><span>=mongodb://localhost:</span><span>27017</span><span>
</span><span>DB_NAME</span><span>=plataforma_formativa_ritsi
</span><span>SECRET_KEY</span><span>=tu_clave_secreta_aqui
</span></span></code></div></div></pre>

### 🔐 Cómo generar una SECRET\_KEY segura:

<pre class="overflow-visible! px-0!" data-start="1677" data-end="1751"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python </span><span>-c</span><span> </span><span>"import secrets; print(secrets.token_hex(32))"</span><span>
</span></span></code></div></div></pre>

---

### 📌 5. Iniciar el servidor FastAPI

<pre class="overflow-visible! px-0!" data-start="1796" data-end="1841"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>uvicorn server:app </span><span>--reload</span><span>
</span></span></code></div></div></pre>

El backend estará disponible en:

👉 **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

## 2️⃣ Configuración del Frontend (React + Tailwind)

Como recomendación, abrir una terminal nueva de la usada para el backend

### 📌 1. Ir al directorio del frontend

<pre class="overflow-visible! px-0!" data-start="2010" data-end="2039"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>cd</span><span> frontend
</span></span></code></div></div></pre>

---

### 📌 2. Instalar dependencias

<pre class="overflow-visible! px-0!" data-start="2078" data-end="2107"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>npm install
</span></span></code></div></div></pre>

---

### 📌 3. Crear archivo `.env`

En `frontend/.env` añade:

<pre class="overflow-visible! px-0!" data-start="2172" data-end="2223"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>REACT_APP_BACKEND_URL</span><span>=http://</span><span>127.0</span><span>.</span><span>0.1</span><span>:</span><span>8000</span><span>
</span></span></code></div></div></pre>

---

### 📌 4. Iniciar el frontend

<pre class="overflow-visible! px-0!" data-start="2260" data-end="2287"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>npm </span><span>start</span><span>
</span></span></code></div></div></pre>

La aplicación estará disponible en:

👉 **[http://localhost:3000](http://localhost:3000)**


## 3️⃣ Inicialización de Datos

Estos pasos son necesarios para que la plataforma tenga un administrador inicial y datos básicos. Todos los scripts deben ejecutarse **desde la carpeta scripts** **y con el entorno virtual activado**.

Activa el entorno virtual:

```powershell
cd backend
venv\Scripts\activate
cd ..
cd scripts

```

---

### ✔ Crear un usuario administrador

Ejecuta desde la carpeta scripts.Ten en cuenta que ahora mismo el login se hace a través de SSO de GOOGLE por lo tanto es recomendado usar una cuenta de Google o de Google Workspace:

<pre class="overflow-visible! px-0!" data-start="2570" data-end="2662"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/create_admin.py </span><span>"correo@email.com"</span><span> </span><span>"Administrador Principal"</span><span>
</span></span></code></div></div></pre>

---

### ✔ Inicializar universidades (opcional)

<pre class="overflow-visible! px-0!" data-start="2712" data-end="2765"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/init_universities.py
</span></span></code></div></div></pre>



## 4. Otros Scripts de utilidad

La carpeta `scripts/` incluye herramientas para gestionar usuarios.

---

### 4.1 Crear usuario con rol

<pre class="overflow-visible! px-0!" data-start="2657" data-end="2756"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/create_user.py </span><span>"email@ejemplo.com"</span><span> </span><span>"Nombre Completo"</span><span> administrador
</span></span></code></div></div></pre>

Roles posibles según tu backend:

* administrador
* universidad
* formador
* estudiante (si existe)

---

### 4.2 Listar usuarios

<pre class="overflow-visible! px-0!" data-start="2894" data-end="2940"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/list_users.py
</span></span></code></div></div></pre>

Filtrar por email:

<pre class="overflow-visible! px-0!" data-start="2962" data-end="3037"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/list_users.py </span><span>--email</span><span> </span><span>"correo@ejemplo.com"</span><span>
</span></span></code></div></div></pre>

---

### 4.3 Borrar usuarios

Borrar por email:

<pre class="overflow-visible! px-0!" data-start="3087" data-end="3163"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/delete_user.py </span><span>--email</span><span> </span><span>"correo@ejemplo.com"</span><span>
</span></span></code></div></div></pre>

Borrar por rol:

<pre class="overflow-visible! px-0!" data-start="3182" data-end="3250"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/delete_user.py </span><span>--role</span><span> administrador
</span></span></code></div></div></pre>

Borrar todos los usuarios:

<pre class="overflow-visible! px-0!" data-start="3280" data-end="3341"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-powershell"><span><span>python scripts/delete_user.py </span><span>--all</span><span> </span><span>--force</span></span></code></div></div></pre>
