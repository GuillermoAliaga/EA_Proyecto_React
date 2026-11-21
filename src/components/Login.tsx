import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useForm } from '../hooks/useForm';
import { Field } from '../components/Field';
import { errorMessage } from '../utils/api-error';

const INITIAL = { email: '', password: '' };
type Values = typeof INITIAL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v: Values) {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.email.trim()) e.email = 'El email es obligatorio';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'El email no es válido';
  if (!v.password) e.password = 'La contraseña es obligatoria';
  return e;
}

// Solo se acepta como destino una ruta interna de la aplicación
function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ProtectedRoute guarda aquí la ruta que intentabas abrir
  const from = safeRedirect((location.state as { from?: string } | null)?.from);
  const justRegistered = Boolean((location.state as { registered?: boolean } | null)?.registered);

  const { values, isValid, handleChange, handleBlur, touchAll, error } =
    useForm<Values>(INITIAL, validate);

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return; // evita enviar dos veces
    touchAll();
    if (!isValid) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await login(values.email.trim(), values.password);
      navigate(from, { replace: true });
    } catch (err) {
      setSubmitError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <section>
      <h1>Iniciar sesión</h1>

      {justRegistered && <p role="status">Cuenta creada. Ya puedes iniciar sesión.</p>}

      <form onSubmit={onSubmit} noValidate>
        <Field label="Email" name="email" error={error('email')}>
          <input
            id="email" name="email" type="email" autoComplete="email"
            value={values.email} onChange={handleChange} onBlur={handleBlur}
          />
        </Field>

        <Field label="Contraseña" name="password" error={error('password')}>
          <input
            id="password" name="password" type="password" autoComplete="current-password"
            value={values.password} onChange={handleChange} onBlur={handleBlur}
          />
        </Field>

        {submitError && <p role="alert">{submitError}</p>}

        <button type="submit" disabled={saving}>
          {saving ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p>¿No tienes cuenta? <Link to="/register">Regístrate</Link></p>
    </section>
  );
}