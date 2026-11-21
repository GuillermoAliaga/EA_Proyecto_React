const pad = (n: number) => String(n).padStart(2, '0');

// ISO de la API → valor de <input type="datetime-local"> en hora local
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Valor de datetime-local → ISO para la API
export const toIso = (local: string) => new Date(local).toISOString();