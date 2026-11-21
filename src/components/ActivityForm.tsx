import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, SUBCATEGORIES, MODALITIES, ACTIVITY_STATUSES } from '../models';
import type { ActivityInput, Category, Subcategory, Modality, ActivityStatus } from '../models';
import { activityService } from '../services/activity.service';
import { useForm } from '../hooks/useForm';
import { Field } from '../components/Field';
import { errorMessage, isAbort } from '../utils/api-error';
import { toIso, toLocalInput } from '../utils/dates';

const INITIAL = {
  title: '', description: '',
  category: CATEGORIES[0], subcategory: SUBCATEGORIES[0],
  modality: MODALITIES[0], status: ACTIVITY_STATUSES[0],
  address: '', latitude: '', longitude: '',
  startTime: '', endTime: '',
  minParticipants: '', maxParticipants: '',
  price: '0', prize: '',
};
type Values = Record<keyof typeof INITIAL, string>;

const isNum = (s: string) => s.trim() !== '' && !Number.isNaN(Number(s));

function validate(v: Values) {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.title.trim()) e.title = 'El título es obligatorio';
  if (!v.description.trim()) e.description = 'La descripción es obligatoria';
  if (!v.address.trim()) e.address = 'La dirección es obligatoria';

  if (!isNum(v.latitude) || Math.abs(Number(v.latitude)) > 90) e.latitude = 'La latitud debe estar entre -90 y 90';
  if (!isNum(v.longitude) || Math.abs(Number(v.longitude)) > 180) e.longitude = 'La longitud debe estar entre -180 y 180';

  if (!v.startTime) e.startTime = 'La hora de inicio es obligatoria';
  if (!v.endTime) e.endTime = 'La hora de fin es obligatoria';
  else if (v.startTime && new Date(v.endTime) <= new Date(v.startTime)) {
    e.endTime = 'La hora de fin debe ser posterior a la de inicio';
  }

  if (!isNum(v.minParticipants) || Number(v.minParticipants) < 1) e.minParticipants = 'El aforo mínimo debe ser al menos 1';
  if (!isNum(v.maxParticipants) || Number(v.maxParticipants) < Number(v.minParticipants)) {
    e.maxParticipants = 'El aforo máximo no puede ser menor que el mínimo';
  }
  if (!isNum(v.price) || Number(v.price) < 0) e.price = 'El precio no puede ser negativo';
  return e;
}

export function ActivityForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { values, isValid, handleChange, handleBlur, touchAll, fill, error } =
    useForm<Values>(INITIAL, validate);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    activityService
      .getOne(id, controller.signal)
      .then((a) =>
        fill({
          title: a.title,
          description: a.description,
          category: a.category,
          subcategory: a.subcategory,
          modality: a.modality,
          status: a.status,
          address: a.address,
          // GeoJSON es [longitude, latitude]
          longitude: String(a.location.coordinates[0]),
          latitude: String(a.location.coordinates[1]),
          startTime: toLocalInput(a.startTime),
          endTime: toLocalInput(a.endTime),
          minParticipants: String(a.minParticipants),
          maxParticipants: String(a.maxParticipants),
          price: String(a.price),
          prize: a.prize ?? '',
        }),
      )
      .catch((e) => { if (!isAbort(e)) setSubmitError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    touchAll();
    if (!isValid) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const payload: ActivityInput = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category as Category,
        subcategory: values.subcategory as Subcategory,
        modality: values.modality as Modality,
        status: values.status as ActivityStatus,
        address: values.address.trim(),
        location: {
          type: 'Point',
          coordinates: [Number(values.longitude), Number(values.latitude)],
        },
        startTime: toIso(values.startTime),
        endTime: toIso(values.endTime),
        minParticipants: Number(values.minParticipants),
        maxParticipants: Number(values.maxParticipants),
        price: Number(values.price),
        ...(values.prize.trim() ? { prize: values.prize.trim() } : {}),
      };
      if (id) await activityService.update(id, payload);
      else await activityService.create(payload);
      navigate('/activities');
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Cargando…</p>;

  const input = (name: keyof Values, type = 'text') => (
    <input id={name} name={name} type={type} value={values[name]} onChange={handleChange} onBlur={handleBlur} />
  );
  const select = (name: keyof Values, options: readonly string[]) => (
    <select id={name} name={name} value={values[name]} onChange={handleChange}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <section>
      <h1>{isEdit ? 'Editar actividad' : 'Nueva actividad'}</h1>
      <form onSubmit={onSubmit} noValidate>
        <Field label="Título" name="title" error={error('title')}>{input('title')}</Field>

        <Field label="Descripción" name="description" error={error('description')}>
          <textarea id="description" name="description" value={values.description}
            onChange={handleChange} onBlur={handleBlur} />
        </Field>

        <Field label="Categoría" name="category">{select('category', CATEGORIES)}</Field>
        <Field label="Subcategoría" name="subcategory">{select('subcategory', SUBCATEGORIES)}</Field>
        <Field label="Modalidad" name="modality">{select('modality', MODALITIES)}</Field>
        <Field label="Estado" name="status">{select('status', ACTIVITY_STATUSES)}</Field>

        <Field label="Dirección" name="address" error={error('address')}>{input('address')}</Field>
        <Field label="Latitud" name="latitude" error={error('latitude')}>{input('latitude')}</Field>
        <Field label="Longitud" name="longitude" error={error('longitude')}>{input('longitude')}</Field>

        <Field label="Inicio" name="startTime" error={error('startTime')}>{input('startTime', 'datetime-local')}</Field>
        <Field label="Fin" name="endTime" error={error('endTime')}>{input('endTime', 'datetime-local')}</Field>

        <Field label="Aforo mínimo" name="minParticipants" error={error('minParticipants')}>{input('minParticipants', 'number')}</Field>
        <Field label="Aforo máximo" name="maxParticipants" error={error('maxParticipants')}>{input('maxParticipants', 'number')}</Field>
        <Field label="Precio (€)" name="price" error={error('price')}>{input('price', 'number')}</Field>
        <Field label="Premio" name="prize" help="Opcional">{input('prize')}</Field>

        {submitError && <p role="alert">{submitError}</p>}

        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <Link to="/activities">Cancelar</Link>
      </form>
    </section>
  );
}