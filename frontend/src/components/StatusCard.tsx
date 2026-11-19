export function StatusCard({ label, value, detail, warning = false }: {
  label: string; value: string; detail: string; warning?: boolean;
}) {
  return <section className="status-card">
    <p className="eyebrow">{label}</p>
    <h2 className={warning ? 'warning' : ''}>{value}</h2>
    <p className="muted">{detail}</p>
  </section>;
}
