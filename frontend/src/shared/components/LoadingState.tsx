export function LoadingState({ label }: { label?: string }) {
  return <div>{label ?? 'Loading...'}</div>
}
