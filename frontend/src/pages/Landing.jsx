import { BookOpen, GraduationCap, Users, Award } from 'lucide-react';
import { Button } from '../components/ui/button';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from '../components/ThemeToggleButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const AUTH_URL = `${BACKEND_URL}/api/auth/google/login`;

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-red-100 dark:from-gray-900 dark:via-black dark:to-black text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Plataforma Formativa Logo" className="w-10 h-10" />
            <h1 className="text-2xl font-bold">Plataforma Formativa</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <Button 
              data-testid="login-button"
              onClick={() => window.location.href = AUTH_URL}
              className="bg-[#da2724] hover:bg-[#b8211e] text-white px-6 py-2 rounded-full font-medium shadow-lg hover:shadow-xl transition-all"
            >
              Iniciar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Formación de RITSI para RITSI<br />
            <span className="text-[#da2724]">Organizada y Efectiva</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-10 leading-relaxed">
            Una plataforma completa para gestionar contenidos formativos, cuestionarios y seguimiento del progreso de los representantes universitarios.
          </p>
          <Button 
            data-testid="hero-cta-button"
            onClick={() => window.location.href = AUTH_URL}
            size="lg"
            className="bg-[#da2724] hover:bg-[#b8211e] text-white px-8 py-6 rounded-full text-lg font-semibold shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
          >
            Comenzar Ahora
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<BookOpen className="w-10 h-10 text-[#da2724]" />}
            title="Contenido Multimedia"
            description="Vídeos y PDFs alojados en Google Drive con acceso controlado."
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
      <footer className="container mx-auto px-6 py-8 mt-20 border-t border-gray-200 dark:border-gray-800">
        <p className="text-center text-gray-600 dark:text-gray-400">
          © 2025 Plataforma Formativa de <a href="https://ritsi.org" target="_blank" rel="noopener noreferrer" className="text-[#da2724] hover:underline">RITSI</a>.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white/60 dark:bg-gray-800/40 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100 dark:border-gray-800 hover:border-red-200 dark:hover:border-red-500/30">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
    </div>
  );
}