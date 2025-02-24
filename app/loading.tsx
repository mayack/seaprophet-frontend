import { Spinner } from '@/components/ui/spinner'

export default function Loading() {
  return (
    <div className="z-100 fixed inset-0 flex h-full w-full flex-col items-center justify-center gap-4 bg-background">
      <Spinner size="lg" className="text-primary" />
    </div>
  )
}
