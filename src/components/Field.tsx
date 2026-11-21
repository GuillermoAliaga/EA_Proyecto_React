import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  name: string;
  error?: string;
  help?: string;
  children: ReactNode; // el input, select o textarea (con id igual a name)
}

export function Field({ label, name, error, help, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {help && <small>{help}</small>}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}