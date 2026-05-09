import ViewSymptomClient from './ViewSymptomClient'

export const dynamicParams = false

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function ViewSymptomPage() {
  return <ViewSymptomClient />
}
