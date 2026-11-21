import { useState } from 'react';
import type { ChangeEvent, FocusEvent } from 'react';

type Errors<T> = Partial<Record<keyof T, string>>;
type Touched<T> = Partial<Record<keyof T, boolean>>;
type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function useForm<T extends Record<string, string>>(
  initial: T,
  validate: (values: T) => Errors<T>,
) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Touched<T>>({});

  const errors = validate(values);
  const isValid = Object.keys(errors).length === 0;

  const handleChange = (e: ChangeEvent<FieldElement>) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  };

  const handleBlur = (e: FocusEvent<FieldElement>) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
  };

  // Al enviar, se enseñan todos los errores a la vez
  const touchAll = () =>
    setTouched(Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Touched<T>));

  // Carga datos al editar
  const fill = (data: Partial<T>) => setValues((v) => ({ ...v, ...data }));

  // Solo devuelve el error de un campo si el usuario ya lo ha tocado
  const error = (name: keyof T) => (touched[name] ? errors[name] : undefined);

  return { values, isValid, handleChange, handleBlur, touchAll, fill, error };
}