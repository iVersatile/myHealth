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
