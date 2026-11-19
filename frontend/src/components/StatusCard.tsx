import type { ReactNode } from 'react';

export function StatusCard({ label, value, detail, icon, warning = false }: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  warning?: boolean;
}) {
  return <section className="status-card">
    <div className="status-heading"><span aria-hidden="true">{icon}</span><p>{label}</p></div>
    <h2 className={warning ? 'warning' : ''}>{value}</h2>
    <p className="muted">{detail}</p>
  </section>;
}
