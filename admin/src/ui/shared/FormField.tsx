export function FormField({
  label,
  name,
  children,
  error,
}: {
  label: string;
  name?: string;
  children?: React.ReactNode;
  error?: string;
}) {
  return (
    <label>
      {label}
      {children ?? <input name={name} />}
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
