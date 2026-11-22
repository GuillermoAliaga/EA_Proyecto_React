import { useState } from 'react';
import type { ChangeEvent, SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useForm } from '../hooks/useForm';
import { Field } from './Field';
import { errorMessage } from '../utils/api-error';

const INITIAL = { name: '', email: '', password: '', confirmPassword: '' };
type Values = typeof INITIAL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v: Values) {
  const e: Partial<Record<keyof Values, string>> = {};
  if (v.name.trim().length < 2) e.name = 'El nombre debe tener al menos 2 caracteres';
  if (!v.email.trim()) e.email = 'El email es obligatorio';
  else if (!EMAIL_RE.test(v.email.trim())) e.email = 'El email no es válido';
  if (v.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres';
  if (!v.confirmPassword) e.confirmPassword = 'Repite la contraseña';
  else if (v.confirmPassword !== v.password) e.confirmPassword = 'Las contraseñas no coinciden';
  return e;
}

export function Register() {
  const navigate = useNavigate();

  const { values, isValid, handleChange, handleBlur, touchAll, error } =
    useForm<Values>(INITIAL, validate);

  // La casilla no es texto, así que va fuera de useForm
  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onTermsChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAccepted(e.target.checked);
    if (e.target.checked) setTermsError(null);
  };

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;

    touchAll();
    if (!accepted) setTermsError('Debes aceptar los términos de servicio');
    if (!isValid || !accepted) return;

    setSaving(true);
    setSubmitError(null);
    try {
      // confirmPassword y la casilla solo se comprueban aquí, no se envían
      await authService.register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      // El registro no inicia sesión: se va al login con un aviso
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      setSubmitError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <section>
      <h1>Crear cuenta</h1>

      <form onSubmit={onSubmit} noValidate>
        <Field label="Nombre" name="name" error={error('name')}>
          <input id="name" name="name" autoComplete="name"
            value={values.name} onChange={handleChange} onBlur={handleBlur} />
        </Field>

        <Field label="Email" name="email" error={error('email')}>
          <input id="email" name="email" type="email" autoComplete="email"
            value={values.email} onChange={handleChange} onBlur={handleBlur} />
        </Field>

        <Field label="Contraseña" name="password" error={error('password')}>
          <input id="password" name="password" type="password" autoComplete="new-password"
            value={values.password} onChange={handleChange} onBlur={handleBlur} />
        </Field>

        <Field label="Repite la contraseña" name="confirmPassword" error={error('confirmPassword')}>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password"
            value={values.confirmPassword} onChange={handleChange} onBlur={handleBlur} />
        </Field>

        <div className="field">
          <label htmlFor="terms">
            <input id="terms" type="checkbox" checked={accepted} onChange={onTermsChange} />
            {' '}Acepto los términos de servicio
          </label>
          {termsError && <small role="alert">{termsError}</small>}
        </div>

        {submitError && <p role="alert">{submitError}</p>}

        <button type="submit" disabled={saving}>
          {saving ? 'Creando cuenta…' : 'Registrarme'}
        </button>
      </form>

      <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </section>
  );
}