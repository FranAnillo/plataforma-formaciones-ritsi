# 📘 Guía 1 — Desarrollo: levantar el proyecto tras clonar el repositorio

> 👉 **Para personas que van a seguir desarrollando o modificando el código**
> (backend, frontend o scripts)

---

## 🧩 Requisitos

* Docker y Docker Compose (v2)
* Git
* Acceso al repositorio de GitHub

Comprobar versiones:

<pre class="overflow-visible! px-0!" data-start="448" data-end="513"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker --version
docker compose version
git --version
</span></span></code></div></div></pre>

---

## 1️⃣ Clonar el repositorio

<pre class="overflow-visible! px-0!" data-start="550" data-end="663"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>git </span><span>clone</span><span> https://github.com/USUARIO/plataforma-formaciones-ritsi.git
</span><span>cd</span><span> plataforma-formaciones-ritsi
</span></span></code></div></div></pre>

Estructura esperada:

<pre class="overflow-visible! px-0!" data-start="687" data-end="783"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>plataforma-formaciones-ritsi/
├── backend/
├── frontend/
├── docker-compose.yml
└── .</span><span>env</span><span>
</span></span></code></div></div></pre>

---

## 2️⃣ Crear el archivo `.env`

En la raíz del proyecto:

📄 `.env`

<pre class="overflow-visible! px-0!" data-start="859" data-end="902"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-env"><span>SECRET_KEY=clave-para-desarrollo
</span></code></div></div></pre>

> ⚠️ Este archivo no está en el repositorio y es obligatorio.

---

## 3️⃣ Levantar el entorno de desarrollo con Docker

Este entorno:

* Usa **build local**
* Monta el código
* Permite modificar archivos y ver cambios

<pre class="overflow-visible! px-0!" data-start="1123" data-end="1160"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose up --build
</span></span></code></div></div></pre>

Servicios que se levantan:

* MongoDB → `27017`
* Backend → `8000`
* Frontend → `3000`

---

## 4️⃣ Acceso a la aplicación

* Frontend:
  👉 [http://localhost:3000]()
* Backend:
  👉 [http://localhost:8000](http://localhost:8000)

---

## 5️⃣ Ejecutar scripts de administración (desarrollo)

Los scripts se ejecutan mediante el servicio `scripts`.

### Crear administrador

<pre class="overflow-visible! px-0!" data-start="1511" data-end="1626"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts \
  python scripts/create_admin.py </span><span>"correo@example.com"</span><span> </span><span>"Administrador"</span><span>
</span></span></code></div></div></pre>

### Crear usuario

<pre class="overflow-visible! px-0!" data-start="1647" data-end="1755"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts \
  python scripts/create_user.py </span><span>"correo@example.com"</span><span> </span><span>"Usuario"</span><span>
</span></span></code></div></div></pre>

### Inicializar universidades

<pre class="overflow-visible! px-0!" data-start="1788" data-end="1871"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts \
  python scripts/init_universities.py
</span></span></code></div></div></pre>

---

## 6️⃣ Parar el entorno

<pre class="overflow-visible! px-0!" data-start="1903" data-end="1934"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose down
</span></span></code></div></div></pre>

---

## 📝 Notas para desarrollo

* Los cambios en el código **requieren rebuild**
* MongoDB persiste datos en un volumen Docker
* Ideal para implementar nuevas funcionalidades

---

---

# 📕 Guía 2 — Despliegue: levantar el sistema SIN acceder al repositorio

> 👉 **Para despliegue, demos o producción**
> No requiere Git ni código fuente

---

## 🧩 Requisitos

* Docker y Docker Compose (v2)
* Acceso al servidor o máquina donde desplegar

---

## 1️⃣ Preparar carpeta de despliegue

<pre class="overflow-visible! px-0!" data-start="2427" data-end="2473"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>mkdir</span><span> ritsi-deploy
</span><span>cd</span><span> ritsi-deploy
</span></span></code></div></div></pre>

Estructura:

<pre class="overflow-visible! px-0!" data-start="2488" data-end="2541"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre!"><span><span>ritsi-deploy/
├── docker-compose.yml
└── .</span><span>env</span><span>
</span></span></code></div></div></pre>

---

## 2️⃣ Crear el archivo `.env`

📄 `.env`

<pre class="overflow-visible! px-0!" data-start="2591" data-end="2636"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-env"><span>SECRET_KEY=clave-segura-produccion
</span></code></div></div></pre>

---

## 3️⃣ Crear `docker-compose.yml` (imágenes públicas)

<pre class="overflow-visible! px-0!" data-start="2698" data-end="3517"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-yaml"><span><span>services:</span><span>
  </span><span>mongo:</span><span>
    </span><span>image:</span><span> </span><span>mongo:6</span><span>
    </span><span>volumes:</span><span>
      </span><span>-</span><span> </span><span>mongo_data:/data/db</span><span>

  </span><span>backend:</span><span>
    </span><span>image:</span><span> </span><span>iireenees012/ritsi-backend:1.1</span><span>
    </span><span>env_file:</span><span>
      </span><span>-</span><span> </span><span>.env</span><span>
    </span><span>environment:</span><span>
      </span><span>MONGO_URL:</span><span> </span><span>mongodb://mongo:27017</span><span>
      </span><span>DB_NAME:</span><span> </span><span>plataforma_formativa_ritsi</span><span>
    </span><span>ports:</span><span>
      </span><span>-</span><span> </span><span>"8000:8000"</span><span>
    </span><span>depends_on:</span><span>
      </span><span>-</span><span> </span><span>mongo</span><span>

  </span><span>frontend:</span><span>
    </span><span>image:</span><span> </span><span>iireenees012/ritsi-frontend:1.0</span><span>
    </span><span>environment:</span><span>
      </span><span>REACT_APP_BACKEND_URL:</span><span> </span><span>http://IP_DEL_SERVIDOR:8000</span><span>
    </span><span>ports:</span><span>
      </span><span>-</span><span> </span><span>"3000:3000"</span><span>
    </span><span>depends_on:</span><span>
      </span><span>-</span><span> </span><span>backend</span><span>

  </span><span>scripts:</span><span>
    </span><span>image:</span><span> </span><span>iireenees012/ritsi-backend:1.1</span><span>
    </span><span>env_file:</span><span>
      </span><span>-</span><span> </span><span>.env</span><span>
    </span><span>environment:</span><span>
      </span><span>MONGO_URL:</span><span> </span><span>mongodb://mongo:27017</span><span>
      </span><span>DB_NAME:</span><span> </span><span>plataforma_formativa_ritsi</span><span>
      </span><span>PYTHONPATH:</span><span> </span><span>/app</span><span>
    </span><span>working_dir:</span><span> </span><span>/app</span><span>
    </span><span>depends_on:</span><span>
      </span><span>-</span><span> </span><span>mongo</span><span>
    </span><span>restart:</span><span> </span><span>"no"</span><span>

</span><span>volumes:</span><span>
  </span><span>mongo_data:</span><span>
</span></span></code></div></div></pre>

⚠️ Sustituir `IP_DEL_SERVIDOR` por la IP o dominio real.

---

## 4️⃣ Levantar el sistema

<pre class="overflow-visible! px-0!" data-start="3610" data-end="3662"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose pull
docker compose up -d
</span></span></code></div></div></pre>

---

## 5️⃣ Acceso al sistema

* Frontend:
  👉 http://IP\_DEL\_SERVIDOR:3000
* Backend:
  👉 http://IP\_DEL\_SERVIDOR:8000

---

## 6️⃣ Ejecutar scripts (despliegue)

### Crear administrador inicial

<pre class="overflow-visible! px-0!" data-start="3866" data-end="3991"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts \
  python scripts/create_admin.py </span><span>"correo@example.com"</span><span> </span><span>"Administrador Principal"</span><span>
</span></span></code></div></div></pre>

### Inicializar universidades

<pre class="overflow-visible! px-0!" data-start="4024" data-end="4107"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose run --</span><span>rm</span><span> scripts \
  python scripts/init_universities.py
</span></span></code></div></div></pre>

---

## 7️⃣ Parar el sistema

<pre class="overflow-visible! px-0!" data-start="4139" data-end="4170"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-9"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>docker compose down
</span></span></code></div></div></pre>
