import { Hammer } from 'lucide-react'
import { EmptyState, Card } from '../components/ui'

export default function ComingSoon({ title, phase, hint }) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-headline text-2xl font-bold text-slate-900 lg:text-3xl">{title}</h1>
      <Card>
        <EmptyState icon={Hammer} title={`${title} is coming in ${phase}`} hint={hint || 'This screen is next on the build plan.'} />
      </Card>
    </div>
  )
}
