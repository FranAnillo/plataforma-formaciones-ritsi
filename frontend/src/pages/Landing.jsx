import { BookOpen, GraduationCap, Users, Award } from 'lucide-react';
import { Button } from '../components/ui/button';

const REDIRECT_URL = window.location.origin + '/dashboard';
const AUTH_URL = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(REDIRECT_URL)}`;

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="container mx-auto px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Plataforma Formativa</h1>
          </div>
          <Button 
            data-testid="login-button"
            onClick={() => window.location.href = AUTH_URL}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-full font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Iniciar Sesión
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            Formación Universitaria<br />
            <span className="text-indigo-600">Organizada y Efectiva</span>
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed">
            Una plataforma completa para gestionar contenidos formativos, cuestionarios y seguimiento del progreso de los representantes universitarios.
          </p>
          <Button 
            data-testid="hero-cta-button"
            onClick={() => window.location.href = AUTH_URL}
            size="lg"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 rounded-full text-lg font-semibold shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
          >
            Comenzar Ahora
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<BookOpen className="w-10 h-10 text-indigo-600" />}
            title="Contenido Multimedia"
            description="Vídeos, PDFs e imágenes alojados en Google Drive con acceso controlado."
          />
          <FeatureCard
            icon={<Users className="w-10 h-10 text-indigo-600" />}
            title="Múltiples Roles"
            description="Sistema de permisos para representantes, universidades, junta directiva y escuela de formación."
          />
          <FeatureCard
            icon={<Award className="w-10 h-10 text-indigo-600" />}
            title="Cuestionarios"
            description="Evaluaciones con mínimo 70% para aprobar. V/F y opción múltiple."
          />
          <FeatureCard
            icon={<GraduationCap className="w-10 h-10 text-indigo-600" />}
            title="Seguimiento"
            description="Control del progreso y completitud de cada unidad formativa."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 mt-20 border-t border-gray-200">
        <p className="text-center text-gray-600">
          © 2025 Plataforma Formativa. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-indigo-200">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-800 mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}