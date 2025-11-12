import { useState, useEffect } from 'react';
import { GraduationCap, Building2, User } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
      const response = await axios.get(`${API}/universities`);
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
      await axios.post(`${API}/auth/register`, {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>Completa tu Registro</h1>
          <p className="text-gray-600">Asóciate a tu universidad</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="register-form">
          <div>
            <Label htmlFor="name" className="text-gray-700 font-medium mb-2 flex items-center gap-2">
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
            <Label htmlFor="university" className="text-gray-700 font-medium mb-2 flex items-center gap-2">
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
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? 'Registrando...' : 'Completar Registro'}
          </Button>
        </form>
      </div>
    </div>
  );
}