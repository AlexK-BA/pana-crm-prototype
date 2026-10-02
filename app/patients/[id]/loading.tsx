export default function PatientLoading() {
  return <div role="status" aria-label="Ładowanie Patient 360" className="space-y-4 p-6"><div className="h-40 animate-pulse rounded-xl bg-muted" /><div className="h-12 animate-pulse rounded bg-muted" /><div className="h-72 animate-pulse rounded-xl bg-muted" /><span className="sr-only">Ładowanie profilu pacjenta…</span></div>
}
