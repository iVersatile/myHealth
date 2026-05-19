import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'

export interface ReportAppointment {
  id: string
  title: string
  appt_date: string
  doctor_name: string | null
  clinic_name: string | null
  specialty: string | null
  status: string
}

export interface ReportEntity {
  id: string
  document_id: string
  entity_type: string
  name: string
  value: string | null
  unit: string | null
  raw_text: string
  created_at: string
}

export interface ReportData {
  document_id: string
  title: string
  document_date: string | null
  category: string
  clinic_name: string | null
  notes: string | null
  tags: string[]
  entities: ReportEntity[]
  appointments: ReportAppointment[]
  ocr_excerpt: string | null
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  meta: {
    fontSize: 9,
    color: '#555',
    marginBottom: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 8,
    color: '#444',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingBottom: 4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 100,
    fontFamily: 'Helvetica-Bold',
    color: '#444',
  },
  value: {
    flex: 1,
    color: '#222',
  },
  entityCard: {
    backgroundColor: '#fafafa',
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  entityType: {
    fontSize: 8,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  entityName: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  entityValue: {
    color: '#333',
  },
  apptCard: {
    borderLeftWidth: 2,
    borderLeftColor: '#4a90e2',
    paddingLeft: 8,
    marginBottom: 8,
  },
  apptTitle: {
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  apptMeta: {
    fontSize: 9,
    color: '#555',
    marginBottom: 1,
  },
  excerpt: {
    fontSize: 9,
    color: '#444',
    lineHeight: 1.5,
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 3,
  },
  notes: {
    fontSize: 9,
    color: '#333',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#aaa',
    textAlign: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    paddingTop: 6,
  },
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

interface ReportDocumentProps {
  data: ReportData
}

function ReportDocument({ data }: ReportDocumentProps) {
  return (
    <Document
      title={data.title}
      author="myHealth"
      subject="Medical Document Report"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>Category: {data.category}</Text>
          {data.document_date && (
            <Text style={styles.meta}>Date: {formatDate(data.document_date)}</Text>
          )}
          {data.clinic_name && (
            <Text style={styles.meta}>Clinic: {data.clinic_name}</Text>
          )}
          {data.tags.length > 0 && (
            <View style={styles.tagRow}>
              {data.tags.map((tag, i) => (
                <View key={i} style={styles.tag}>
                  <Text>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{data.notes}</Text>
          </View>
        )}

        {/* Extracted Data */}
        {data.entities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Extracted Medical Data ({data.entities.length})
            </Text>
            {data.entities.map((entity) => (
              <View key={entity.id} style={styles.entityCard}>
                <Text style={styles.entityType}>{entity.entity_type}</Text>
                <Text style={styles.entityName}>{entity.name}</Text>
                {entity.value !== null && (
                  <Text style={styles.entityValue}>
                    {entity.value}
                    {entity.unit ? ` ${entity.unit}` : ''}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Appointments */}
        {data.appointments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Linked Appointments ({data.appointments.length})
            </Text>
            {data.appointments.map((appt) => (
              <View key={appt.id} style={styles.apptCard}>
                <Text style={styles.apptTitle}>{appt.title}</Text>
                <Text style={styles.apptMeta}>
                  {formatDate(appt.appt_date)}
                  {appt.doctor_name ? ` · ${appt.doctor_name}` : ''}
                  {appt.clinic_name ? ` · ${appt.clinic_name}` : ''}
                </Text>
                {appt.specialty && (
                  <Text style={styles.apptMeta}>{appt.specialty}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* OCR Excerpt */}
        {data.ocr_excerpt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Document Text (excerpt)</Text>
            <Text style={styles.excerpt}>{data.ocr_excerpt}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by myHealth · {new Date().toLocaleDateString('en-GB')} ·
          Document ID: {data.document_id}
        </Text>
      </Page>
    </Document>
  )
}

export async function downloadReport(data: ReportData): Promise<void> {
  const blob = await pdf(<ReportDocument data={data} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${data.title.replace(/[^a-z0-9]/gi, '_')}_report.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
