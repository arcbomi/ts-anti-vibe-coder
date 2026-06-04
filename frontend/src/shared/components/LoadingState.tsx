export function LoadingState({ label }: { label?: string }) {
  return (
    <div className="callout callout--neutral" aria-live="polite" aria-busy="true">
      {label ?? 'Loading...'}
    </div>
  )
}
