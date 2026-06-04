export function ErrorState({ message }: { message: string }) {
  return (
    <div className="callout callout--danger" role="alert">
      {message}
    </div>
  )
}
