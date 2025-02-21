import { Spinner } from '@/components/ui/spinner'

export default function Loading() {
  return (
    <div className="fixed w-screen h-screen inset-0 flex flex-col items-center justify-center gap-4 bg-background z-100">
      <Spinner size="lg" className="text-primary" />
    </div>
  )
}
