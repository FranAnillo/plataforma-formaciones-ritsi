import { useEffect, useState } from 'react';
import { Award, CheckCircle2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

export default function VerifyCertificate() {
  const { code } = useParams();
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get(`/certificates/verify/${encodeURIComponent(code)}`).then(({ data }) => setCertificate(data)).catch(() => setError('El certificado no existe, ha sido revocado o el código no es válido.'));
  }, [code]);
  return <main className="certificate-page">{certificate ? <article className="certificate-sheet"><Award aria-hidden="true" /><span className="eyebrow">Plataforma Formativa RITSI</span><h1>Certificado de finalización</h1><p>Se certifica que</p><h2>{certificate.user_name}</h2><p>ha completado satisfactoriamente</p><h3>{certificate.content_title}</h3><div className="certificate-valid"><CheckCircle2 /> Certificado válido</div><small>Emitido el {new Date(certificate.issued_at).toLocaleDateString('es-ES')} · Código {certificate.verification_code}</small><div className="certificate-actions"><button className="primary-button" onClick={() => window.print()}>Imprimir o guardar en PDF</button><Link className="secondary-button" to="/">Ir a Formación RITSI</Link></div></article> : error ? <section className="panel empty-state" role="alert"><Award /><h1>Certificado no válido</h1><p>{error}</p><Link className="secondary-button" to="/">Volver</Link></section> : <section className="panel empty-state"><span className="loader" /><p>Verificando certificado…</p></section>}</main>;
}
