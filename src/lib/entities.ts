export const ENTITY_CONFIG = {
  document:    { label: 'Document',    route: '/documents/view'    },
  note:        { label: 'Note',        route: '/notes/view'        },
  symptom:     { label: 'Symptom',     route: '/symptoms/view'     },
  medication:  { label: 'Medication',  route: '/medications/view'  },
  appointment: { label: 'Appointment', route: '/appointments/view' },
} as const

export type EntityType = keyof typeof ENTITY_CONFIG
