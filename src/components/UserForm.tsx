import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROLES } from '../models';
import type { Role, UserInput } from '../models';
import { userService } from '../services/user.service';
import { useForm } from '../hooks/useForm';
import { Field } from './Field';
import { errorMessage, isAbort } from '../utils/api-error';

const INITIAL = { name: '', email: '', role: 'USER', password: '' };
type Values = typeof INITIAL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const makeValidate = (isEdit: boolean) => (v: Values) => {
  const e: Partial<Record<keyof Values, string>> = {};
  if (v.name.trim().length < 2) e.name = 'El nombre debe tener al menos 2 caracteres';
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'El email no es válido';
  if (!isEdit && v.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres';
  if (isEdit && v.password && v.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres';
  return e;
};

export function UserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { values, isValid, handleChange, handleBlur, touchAll, fill, error } =
    useForm<Values>(INITIAL, makeValidate(isEdit));

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    userService
      .getOne(id, controller.signal)
      .then((u) => fill({ name: u.name, email: u.email, role: u.role }))
      .catch((e) => { if (!isAbort(e)) setSubmitError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    touchAll();
    if (!isValid) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const payload: UserInput = {
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role as Role,
        // Al editar, contraseña vacía = no se envía y se conserva la actual
        ...(values.password ? { password: values.password } : {}),
      };
      if (id) await userService.update(id, payload);
      else await userService.create(payload);
      navigate('/users');
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Cargando… </p>;

  return (
    <section>
      <h1>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</h1>
      <form onSubmit={onSubmit} noValidate>
        <Field label="Nombre" name="name" error={error('name')}>
          <input id="name" name="name" value={values.name} onChange={handleChange} onBlur={handleBlur} />
        </Field>

        <Field label="Email" name="email" error={error('email')}>
          <input id="email" name="email" type="email" value={values.email} onChange={handleChange} onBlur={handleBlur} />
        </Field>

        <Field label="Rol" name="role">
          <select id="role" name="role" value={values.role} onChange={handleChange}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field
          label="Contraseña"
          name="password"
          error={error('password')}
          help={isEdit ? 'Déjala vacía para conservar la actual' : undefined}
        >
          <input id="password" name="password" type="password" autoComplete="new-password"
            value={values.password} onChange={handleChange} onBlur={handleBlur} />
        </Field>

        {submitError && <p role="alert">{submitError}</p>}

        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <Link to="/users">Cancelar</Link>
      </form>
    </section>
  );
}