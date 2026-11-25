import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TARGET_TYPES, REPORT_REASONS, REPORT_STATUSES } from '../models';
import type { ReportInput, ReportReviewInput, TargetType, ReportReason, ReportStatus } from '../models';
import { reportService } from '../services/report.service';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useForm } from '../hooks/useForm';
import { Field } from '../components/Field';
import { errorMessage, isAbort } from '../utils/api-error';

const INITIAL = {
  targetType: TARGET_TYPES[0],
  targetId: '',
  reason: REPORT_REASONS[0],
  description: '',
  status: 'PENDING',
  adminNotes: '',
};
type Values = Record<keyof typeof INITIAL, string>;

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const makeValidate = (isReview: boolean) => (v: Values) => {
  const e: Partial<Record<keyof Values, string>> = {};
  // En revisión los datos originales ya existen y están bloqueados
  if (!isReview) {
    if (!OBJECT_ID_RE.test(v.targetId.trim())) e.targetId = 'Identificador no válido';
    const len = v.description.trim().length;
    if (len < 5 || len > 1000) e.description = 'La descripción debe tener entre 5 y 1000 caracteres';
  }
  if (v.adminNotes.length > 500) e.adminNotes = 'Las notas no pueden superar los 500 caracteres';
  return e;
};

export function ReportForm() {
  const { id } = useParams();
  const isReview = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  // La actividad llega desde el botón "Denunciar" de la lista
  const presetType = searchParams.get('targetType');
  const presetId = searchParams.get('targetId');
  const presetTitle = searchParams.get('title');
  const hasPreset =
    !isReview && Boolean(presetId) && TARGET_TYPES.includes(presetType as TargetType);

  const initial: Values = {
    ...INITIAL,
    ...(hasPreset ? { targetType: presetType as string, targetId: presetId as string } : {}),
  };

  const { values, isValid, handleChange, handleBlur, touchAll, fill, error } =
    useForm<Values>(initial, makeValidate(isReview));

  const [loading, setLoading] = useState(isReview);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    reportService
      .getOne(id, controller.signal)
      .then((r) =>
        fill({
          targetType: r.targetType,
          targetId: r.targetId,
          reason: r.reason,
          description: r.description,
          status: r.status,
          adminNotes: r.adminNotes ?? '',
        }),
      )
      .catch((e) => { if (!isAbort(e)) setSubmitError(errorMessage(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    touchAll();
    if (!isValid) return;

    setSaving(true);
    setSubmitError(null);
    try {
      if (id) {
        // Revisión (ADMIN): solo estado y notas
        const payload: ReportReviewInput = {
          status: values.status as ReportStatus,
          adminNotes: values.adminNotes.trim(),
        };
        await reportService.update(id, payload);
        navigate('/reports');
      } else {
        // Nueva denuncia
        const payload: ReportInput = {
          targetType: values.targetType as TargetType,
          targetId: values.targetId.trim(),
          reason: values.reason as ReportReason,
          description: values.description.trim(),
        };
        await reportService.create(payload);
        showToast('Denuncia enviada');
        navigate('/activities');
      }
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Cargando…</p>;

  // Sin actividad elegida no hay nada que denunciar
  if (!isReview && !hasPreset) {
    return (
      <section>
        <h1>Nueva denuncia</h1>
        <p>Para denunciar, pulsa «Denunciar» en la actividad que quieras reportar.</p>
        <Link to="/activities">Ir a actividades</Link>
      </section>
    );
  }

  return (
    <section>
      <h1>{isReview ? 'Revisar reporte' : 'Nueva denuncia'}</h1>

      {hasPreset && presetTitle && (
        <p>Vas a denunciar: <strong>{presetTitle}</strong></p>
      )}

      <form onSubmit={onSubmit} noValidate>
        {/* Solo en revisión: el administrador ve el objetivo, bloqueado */}
        {isReview && (
          <>
            <Field label="Tipo de objetivo" name="targetType">
              <select id="targetType" name="targetType" value={values.targetType} disabled>
                {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Identificador del objetivo" name="targetId">
              <input id="targetId" name="targetId" value={values.targetId} disabled />
            </Field>
          </>
        )}

        <Field label="Motivo" name="reason">
          <select id="reason" name="reason" value={values.reason}
            onChange={handleChange} disabled={isReview}>
            {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>

        <Field label="Descripción" name="description" error={error('description')}>
          <textarea id="description" name="description" value={values.description}
            onChange={handleChange} onBlur={handleBlur} disabled={isReview} />
        </Field>

        {isReview && (
          <>
            <Field label="Estado" name="status">
              <select id="status" name="status" value={values.status} onChange={handleChange}>
                {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Notas del administrador" name="adminNotes"
              error={error('adminNotes')} help="Máximo 500 caracteres">
              <textarea id="adminNotes" name="adminNotes" value={values.adminNotes}
                onChange={handleChange} onBlur={handleBlur} />
            </Field>
          </>
        )}

        {submitError && <p role="alert">{submitError}</p>}

        <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        <Link to={isReview ? '/reports' : '/activities'}>Cancelar</Link>
      </form>
    </section>
  );
}