export function Loading({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={`spinner spinner-${size}`} role="status">
      <span className="sr-only">Loading...</span>
    </div>
  )
}
