import ViewMedicationClient from './ViewMedicationClient'

export const dynamicParams = false

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function ViewMedicationPage() {
  return <ViewMedicationClient />
}
