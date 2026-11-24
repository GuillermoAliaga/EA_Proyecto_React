import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES, SUBCATEGORIES, MODALITIES, ACTIVITY_STATUSES } from '../models';
import type { ActivityInput, Modality, ActivityStatus } from '../models';
import { activityService } from '../services/activity.service';
import { categoryService, type CategoryItem } from '../services/category.service';
import { useForm } from '../hooks/useForm';
import { Field } from '../components/Field';
import { errorMessage, isAbort } from '../utils/api-error';
import { toIso, toLocalInput } from '../utils/dates';

interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
}

const DEFAULT_FALLBACK_CATEGORIES: CategoryItem[] = [
  { name: 'SPORT', subcategories: ['BASKETBALL', 'RUNNING'] },
  { name: 'LEISURE', subcategories: ['ARCADE', 'TCG_BOARDGAMES'] },
];

const INITIAL = {
  title: '',
  description: '',
  category: CATEGORIES[0],
  subcategory: SUBCATEGORIES[0],
  modality: MODALITIES[0],
  status: ACTIVITY_STATUSES[0],
  addressName: '',
  latitude: '',
  longitude: '',
  isStoreLocation: 'false',
  startTime: '',
  endTime: '',
  minParticipants: '2',
  maxParticipants: '',
  price: '0',
  prizeInfo: '',
};
type Values = Record<keyof typeof INITIAL, string>;

const isNum = (s: string) => s.trim() !== '' && !Number.isNaN(Number(s));

function validate(v: Values) {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.title.trim()) e.title = 'El título es obligatorio';
  if (!v.description.trim()) e.description = 'La descripción es obligatoria';
  if (!v.category.trim()) e.category = 'La categoría es obligatoria';
  if (!v.subcategory.trim()) e.subcategory = 'La subcategoría es obligatoria';

  if (!v.addressName.trim()) {
    e.addressName = 'La dirección es obligatoria';
  } else if (
    !isNum(v.latitude) ||
    Math.abs(Number(v.latitude)) > 90 ||
    !isNum(v.longitude) ||
    Math.abs(Number(v.longitude)) > 180
  ) {
    e.addressName = 'Selecciona una dirección válida del desplegable para obtener sus coordenadas';
  }

  if (!v.startTime) e.startTime = 'La hora de inicio es obligatoria';
  if (!v.endTime) e.endTime = 'La hora de fin es obligatoria';
  else if (v.startTime && new Date(v.endTime) <= new Date(v.startTime)) {
    e.endTime = 'La hora de fin debe ser posterior a la de inicio';
  }

  if (!isNum(v.minParticipants) || Number(v.minParticipants) < 1) {
    e.minParticipants = 'El aforo mínimo debe ser al menos 1';
  }
  if (!isNum(v.maxParticipants) || Number(v.maxParticipants) < Number(v.minParticipants)) {
    e.maxParticipants = 'El aforo máximo no puede ser menor que el mínimo';
  }
  if (!isNum(v.price) || Number(v.price) < 0) {
    e.price = 'El precio no puede ser negativo';
  }
  return e;
}

function formatPhotonLabel(f: PhotonFeature): string {
  const p = f.properties;
  const streetPart = [p.street, p.housenumber].filter(Boolean).join(' ');
  return [p.name, streetPart, p.postcode, p.city, p.country]
    .filter((v, i, arr) => Boolean(v) && arr.indexOf(v) === i)
    .join(', ');
}

export function ActivityForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { values, isValid, handleChange, handleBlur, touchAll, fill, error } =
    useForm<Values>(INITIAL, validate);

  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(DEFAULT_FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const lastSelectedAddressRef = useRef<string>('');

  // Cargar catálogo dinámico de categorías desde el backend
  useEffect(() => {
    const controller = new AbortController();
    categoryService
      .getAll(controller.signal)
      .then((items) => {
        if (items.length === 0) return;
        setCategoriesList(items);

        // En creación nueva, inicializamos con la primera categoría y subcategoría reales
        if (!id) {
          const firstCat = items[0];
          fill({
            ...values,
            category: firstCat.name,
            subcategory: firstCat.subcategories[0] ?? '',
          });
        }
      })
      .catch((e) => {
        if (!isAbort(e)) console.error('Error cargando categorías:', e);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Cargar datos si es edición
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    activityService
      .getOne(id, controller.signal)
      .then((a) => {
        const addr = a.location?.addressName ?? '';
        lastSelectedAddressRef.current = addr;
        fill({
          title: a.title,
          description: a.description,
          category: a.category,
          subcategory: a.subcategory,
          modality: a.modality,
          status: a.status,
          addressName: addr,
          longitude: a.location?.coordinates ? String(a.location.coordinates[0]) : '',
          latitude: a.location?.coordinates ? String(a.location.coordinates[1]) : '',
          isStoreLocation: String(Boolean(a.location?.isStoreLocation)),
          startTime: toLocalInput(a.schedule.startTime),
          endTime: toLocalInput(a.schedule.endTime),
          minParticipants: String(a.capacity.minParticipants),
          maxParticipants: String(a.capacity.maxParticipants),
          price: String(a.pricing.price),
          prizeInfo: a.pricing.prizeInfo ?? '',
        });
      })
      .catch((e) => { if (!isAbort(e)) setSubmitError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Búsqueda con debounce en Photon API
  useEffect(() => {
    const query = values.addressName.trim();

    if (query === lastSelectedAddressRef.current || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingAddress(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.features ?? []);
      } catch {
        // Ignorar errores temporales de red
      } finally {
        if (!controller.signal.aborted) setSearchingAddress(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [values.addressName]);

  const handleSelectSuggestion = (feature: PhotonFeature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const label = formatPhotonLabel(feature);
    lastSelectedAddressRef.current = label;
    setSuggestions([]);
    fill({
      ...values,
      addressName: label,
      longitude: String(lon),
      latitude: String(lat),
    });
  };

  // Subcategorías disponibles según la categoría elegida
  const currentCategoryObj = categoriesList.find(
    (c) => c.name.toUpperCase() === values.category.toUpperCase(),
  );
  const availableSubcategories = currentCategoryObj?.subcategories ?? [];

  // Comprobación extra por si en edición viene una combinación histórica o desincronizada
  const subcategoryMismatch =
    availableSubcategories.length > 0 &&
    !availableSubcategories.some((s) => s.toUpperCase() === values.subcategory.toUpperCase());

  const handleCategoryChange = (newCategory: string) => {
    const catObj = categoriesList.find(
      (c) => c.name.toUpperCase() === newCategory.toUpperCase(),
    );
    const allowedSubs = catObj?.subcategories ?? [];
    const nextSubcategory = allowedSubs.some((s) => s.toUpperCase() === values.subcategory.toUpperCase())
      ? values.subcategory
      : (allowedSubs[0] ?? '');

    fill({
      ...values,
      category: newCategory,
      subcategory: nextSubcategory,
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    touchAll();
    if (!isValid || subcategoryMismatch) {
      setSubmitError(
        subcategoryMismatch
          ? 'La subcategoría seleccionada no pertenece a esa categoría. Revísala antes de guardar.'
          : 'Revisa los campos obligatorios y vuelve a intentarlo',
      );
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const payload: ActivityInput = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category.trim().toUpperCase(),
        subcategory: values.subcategory.trim().toUpperCase(),
        modality: values.modality as Modality,
        status: values.status as ActivityStatus,
        location: {
          type: 'Point',
          coordinates: [Number(values.longitude), Number(values.latitude)],
          addressName: values.addressName.trim(),
          isStoreLocation: values.isStoreLocation === 'true',
        },
        schedule: {
          startTime: toIso(values.startTime),
          endTime: toIso(values.endTime),
        },
        capacity: {
          minParticipants: Number(values.minParticipants),
          maxParticipants: Number(values.maxParticipants),
        },
        pricing: {
          price: Number(values.price),
          ...(values.prizeInfo.trim() ? { prizeInfo: values.prizeInfo.trim() } : {}),
        },
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

  const hasValidCoords = isNum(values.latitude) && isNum(values.longitude);

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
          <textarea
            id="description"
            name="description"
            value={values.description}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </Field>

        <Field label="Categoría" name="category" error={error('category')}>
          <select
            id="category"
            name="category"
            value={values.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            {categoriesList.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Subcategoría"
          name="subcategory"
          error={
            error('subcategory') ??
            (subcategoryMismatch ? 'Subcategoría no válida para esta categoría. Revísala.' : undefined)
          }
        >
          <select id="subcategory" name="subcategory" value={values.subcategory} onChange={handleChange}>
            {availableSubcategories.length === 0 && (
              <option value="">Sin subcategorías disponibles</option>
            )}
            {availableSubcategories.map((sub) => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </Field>

        <Field label="Modalidad" name="modality">{select('modality', MODALITIES)}</Field>
        <Field label="Estado" name="status">{select('status', ACTIVITY_STATUSES)}</Field>

        <Field label="Dirección (busca y selecciona)" name="addressName" error={error('addressName')}>
          <input
            id="addressName"
            name="addressName"
            type="text"
            autoComplete="off"
            placeholder="Ej: Carrer de Mallorca 401, Barcelona"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={values.addressName}
            onChange={(e) => {
              if (e.target.value !== lastSelectedAddressRef.current && hasValidCoords) {
                fill({ ...values, addressName: e.target.value, latitude: '', longitude: '' });
              } else {
                handleChange(e);
              }
            }}
            onBlur={handleBlur}
          />
          {searchingAddress && <small style={{ display: 'block', marginTop: '4px' }}>Buscando direcciones…</small>}
          {hasValidCoords && !searchingAddress && (
            <small style={{ display: 'block', marginTop: '4px', color: '#16a34a' }}>
              ✓ Ubicación verificada ({Number(values.latitude).toFixed(4)}, {Number(values.longitude).toFixed(4)})
            </small>
          )}
          {suggestions.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '4px 0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: '#ffffff',
                overflow: 'hidden',
              }}
            >
              {suggestions.map((s, idx) => {
                const label = formatPhotonLabel(s);
                return (
                  <li
                    key={idx}
                    style={{ borderBottom: idx < suggestions.length - 1 ? '1px solid #eee' : 'none' }}
                  >
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        backgroundColor: '#ffffff',
                        color: '#111827',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'block',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      onClick={() => handleSelectSuggestion(s)}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Field>

        <Field label="¿Es en una tienda oficial?" name="isStoreLocation">
          <select id="isStoreLocation" name="isStoreLocation" value={values.isStoreLocation} onChange={handleChange}>
            <option value="false">No</option>
            <option value="true">Sí</option>
          </select>
        </Field>

        <Field label="Inicio" name="startTime" error={error('startTime')}>{input('startTime', 'datetime-local')}</Field>
        <Field label="Fin" name="endTime" error={error('endTime')}>{input('endTime', 'datetime-local')}</Field>

        <Field label="Aforo mínimo" name="minParticipants" error={error('minParticipants')}>{input('minParticipants', 'number')}</Field>
        <Field label="Aforo máximo" name="maxParticipants" error={error('maxParticipants')}>{input('maxParticipants', 'number')}</Field>
        <Field label="Precio (€)" name="price" error={error('price')}>{input('price', 'number')}</Field>
        <Field label="Premio" name="prizeInfo" help="Opcional">{input('prizeInfo')}</Field>

        {submitError && <p role="alert">{submitError}</p>}

        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <Link to="/activities">Cancelar</Link>
      </form>
    </section>
  );
}