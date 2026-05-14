import { useState, useEffect } from 'react';
import { GraduationCap, Building2, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { api } from '../services/api';

export default function Register({ user, onComplete }) {
  const [name, setName] = useState(user.name || '');
  const [universityId, setUniversityId] = useState('');
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUniversities();
  }, []);

  const fetchUniversities = async () => {
    try {
      const response = await api.get('/universities');
      setUniversities(response.data);
    } catch (error) {
      toast.error('Error al cargar universidades');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!universityId) {
      toast.error('Por favor selecciona una universidad');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        email: user.email,
        name,
        university_id: universityId
      });
      
      toast.success('Registro completado exitosamente');
      onComplete();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al completar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page flex min-h-screen items-center justify-center p-4 sm:p-6" style={{ fontFamily: 'Exo, sans-serif' }}>
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg sm:p-8 md:p-10 dark:border-gray-800 dark:bg-gray-900">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
            <GraduationCap className="w-10 h-10 text-[#da2724]" />
          </div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-950 sm:text-3xl dark:text-white">Completa tu registro</h1>
          <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">Confirma tu nombre y vincula tu cuenta a una universidad.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="register-form">
          <div>
            <Label htmlFor="name" className="mb-2 flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-200">
              <User className="w-4 h-4" />
              Nombre Completo
            </Label>
            <Input
              id="name"
              data-testid="name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo"
              required
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="university" className="mb-2 flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-200">
              <Building2 className="w-4 h-4" />
              Universidad
            </Label>
            <Select value={universityId} onValueChange={setUniversityId} required>
              <SelectTrigger data-testid="university-select" className="mt-2">
                <SelectValue placeholder="Selecciona tu universidad" />
              </SelectTrigger>
              <SelectContent>
                {universities.map((uni) => (
                  <SelectItem key={uni.id} value={uni.id}>
                    {uni.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            data-testid="submit-register-button"
            type="submit"
            disabled={loading}
            className="w-full bg-[#da2724] py-6 text-base text-white shadow-sm hover:bg-[#b8211e]"
          >
            {loading ? 'Registrando...' : 'Completar registro'}
          </Button>
        </form>
      </div>
    </div>
  );
}
