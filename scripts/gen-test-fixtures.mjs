import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', 'src-tauri', 'tests', 'fixtures')

async function createPdf(text) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText(text, {
    x: 50,
    y: 750,
    size: 11,
    font,
    color: rgb(0, 0, 0),
    maxWidth: 495,
    lineHeight: 16,
  })
  return doc.save()
}

// no-date-physio.pdf — provider content, no date in body, filename has 09Mar2023
const physioContent = `INVOICE

JOHN GREEN PHYSIOTHERAPY LTD
Company Registration No: 6780032
16 High Street
London SW1A 1AA

Service: Physiotherapy consultation
Provider: Mr John Green MCSP

Amount due: GBP 120.00

Please pay within 30 days.`

const physioBytes = await createPdf(physioContent)
writeFileSync(join(fixturesDir, 'no-date-physio.pdf'), physioBytes)
console.log('Created no-date-physio.pdf')

// no-date-no-filename.pdf — PHYSIOTHERAPY invoice, no body date, no date token in filename
const noDateContent = `INVOICE

JOHN GREEN PHYSIOTHERAPY LTD
Company Registration No: 6780032
16 High Street
London SW1A 1AA

Service: Physiotherapy consultation
Provider: Mr John Green MCSP

Amount due: GBP 120.00

Please pay within 30 days.`

const noDateBytes = await createPdf(noDateContent)
writeFileSync(join(fixturesDir, 'no-date-no-filename.pdf'), noDateBytes)
console.log('Created no-date-no-filename.pdf')

// medical-invoice.pdf — rich fixture triggering all suggestion types:
//   Contact: Dr Sarah Mitchell (title+name pattern)
//   Clinic:  Hartfield Physiotherapy Clinic (name + keyword suffix + UK postcode)
//   Date:    Date of Service: 15/01/2024 → appointment suggestion
//   Tags:    invoice (type), PHYSIOTHERAPY (specialty), Dr Sarah Mitchell (provider), 2024-01-15 (date)
const medicalInvoiceContent = `Medical Invoice

Hartfield Physiotherapy Clinic
Company Registration No: 5432109
12 Cavendish Square
London
W1G 0PU
Tel: 020 7946 0234

Date of Service: 15/01/2024

Invoice

Provider: Dr Sarah Mitchell BSc MSc MCSP
Specialty: Physiotherapy Assessment

Description: Initial physiotherapy assessment and treatment plan

Amount Due: GBP 150.00

Please settle within 14 days of receipt.`

const medicalInvoiceBytes = await createPdf(medicalInvoiceContent)
writeFileSync(join(fixturesDir, 'medical-invoice.pdf'), medicalInvoiceBytes)
console.log('Created medical-invoice.pdf')

// sample-Upload (09Mar2023-16_31_26).pdf — REAL_PDF fixture used by most V3 specs
const realPdfContent = `INVOICE

JOHN GREEN PHYSIOTHERAPY LTD
Company Registration No: 6780032
16 High Street
London SW1A 1AA
Also at: 42 Regent Street, London W1B 5AH
Also at: 8 Victoria Road, London SW1V 1QT
Tel: 07544 370440
Email: jg@johngreenphysio.com

Date of Service: 09/03/2023

Provider: Mr John Green MCSP
Specialty: Physiotherapy Assessment

Description: Physiotherapy consultation and treatment session

Amount Due: GBP 120.00

Please settle within 30 days of receipt.`

const realPdfBytes = await createPdf(realPdfContent)
writeFileSync(join(fixturesDir, 'sample-Upload (09Mar2023-16_31_26).pdf'), realPdfBytes)
console.log('Created sample-Upload (09Mar2023-16_31_26).pdf')
