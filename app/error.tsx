'use client'

export default function Error({ error }: { error: Error }) {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold">Error</h1>
      <p className="text-red-600">{error.message}</p>
    </div>
  )
}
