import { useEffect, useState } from 'react';
import { ArrowRight, Award, BookOpen, GraduationCap, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { BACKEND_URL, api } from '../services/api';

const AUTH_URL = `${BACKEND_URL || ''}/api/auth/google/login`;
const DEV_AUTH_URL = `${BACKEND_URL || ''}/api/auth/dev-login`;

export default function Landing() {
  const [authConfig, setAuthConfig] = useState({ dev_login_enabled: false });

  useEffect(() => {
    api.get('/auth/config')
      .then((response) => setAuthConfig(response.data))
      .catch(() => setAuthConfig({ dev_login_enabled: false }));
  }, []);

  return (
    <div className="app-page min-h-screen overflow-hidden text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      {/* Header */}
      <header className="container mx-auto px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Logo de Gestión de Formaciones RITSI" className="h-10 w-10 flex-shrink-0" />
            <span className="text-lg font-extrabold leading-tight tracking-tight text-gray-950 sm:text-2xl dark:text-white">Formaciones RITSI</span>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <ThemeToggleButton />
            <Button 
              data-testid="login-button"
              onClick={() => window.location.href = AUTH_URL}
              className="bg-[#da2724] px-5 text-white shadow-sm hover:bg-[#b8211e]"
            >
              Iniciar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 md:pt-20">
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-10 h-64 w-64 -translate-x-1/2 opacity-[0.06] sm:h-80 sm:w-80"
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#da2724]">Plataforma formativa</p>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-gray-950 sm:text-5xl lg:text-6xl dark:text-white">
            Gestión de Formaciones RITSI
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-7 text-gray-600 sm:text-xl sm:leading-8 dark:text-gray-400">
            Una plataforma completa para gestionar contenidos formativos, cuestionarios y seguimiento del progreso de los representantes universitarios.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button
              data-testid="hero-cta-button"
              onClick={() => window.location.href = AUTH_URL}
              size="lg"
              className="bg-[#da2724] text-white shadow-md hover:bg-[#b8211e]"
            >
              Comenzar ahora
              <ArrowRight className="h-4 w-4" />
            </Button>
            {authConfig.dev_login_enabled && (
              <Button
                data-testid="dev-login-button"
                onClick={() => window.location.href = DEV_AUTH_URL}
                size="lg"
                variant="outline"
                className="border-gray-300 bg-white/70 text-gray-700 hover:bg-white dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-200 dark:hover:bg-gray-900"
              >
                Entrar en modo desarrollo
              </Button>
            )}
          </div>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 text-left">
            <HeroMetric value="8" label="roles" />
            <HeroMetric value="70%" label="mínimo configurable" />
            <HeroMetric value="24/7" label="acceso formativo" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<BookOpen className="w-10 h-10 text-[#da2724]" />}
            title="Contenido Multimedia"
            description="Vídeos, PDFs y presentaciones alojados en Google Drive con acceso controlado."
          />
          <FeatureCard
            icon={<Users className="w-10 h-10 text-[#da2724]" />}
            title="Múltiples Roles"
            description="Sistema de permisos para representantes, universidades, junta directiva y escuela de formación."
          />
          <FeatureCard
            icon={<Award className="w-10 h-10 text-[#da2724]" />}
            title="Cuestionarios"
            description="Evaluaciones con mínimo 70% para aprobar. V/F y opción múltiple."
          />
          <FeatureCard
            icon={<GraduationCap className="w-10 h-10 text-[#da2724]" />}
            title="Seguimiento"
            description="Control del progreso y completitud de cada unidad formativa."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 sm:px-6 py-8 mt-12 sm:mt-20 border-t border-gray-200 dark:border-gray-800">
        <p className="text-center text-gray-600 dark:text-gray-400">
          © 2026 Gestión de Formaciones <a href="https://ritsi.org" target="_blank" rel="noopener noreferrer" className="text-[#da2724] hover:underline">RITSI</a>.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 p-5 shadow-sm transition-all hover:border-red-200 hover:shadow-md sm:p-6 dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-red-500/40">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}

function HeroMetric({ value, label }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/70 p-3 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
      <p className="text-xl font-extrabold text-gray-950 dark:text-white">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
