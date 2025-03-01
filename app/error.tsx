'use client'

export default function Error({ error }: { error: Error }) {
  return (
    <div className="wrapper space-y-4 py-12 text-center">
      <h1 className="font-style-h1">Error</h1>
      <p className="text-red-600">{error.message}</p>
    </div>
  )
}
