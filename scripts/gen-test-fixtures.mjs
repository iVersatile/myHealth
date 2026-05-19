import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(__dirname, '..', 'src-tauri', 'tests', 'fixtures')
const e2eFixturesDir = join(__dirname, '..', 'e2e', 'fixtures')
mkdirSync(e2eFixturesDir, { recursive: true })

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

// ── E2E fixtures ─────────────────────────────────────────────────────────────

// 1. ecg-invoice-london-clinic-dec2023.pdf
const ecgContent = `INVOICE

The London Cardiac Centre
15 Harley Street
London W1G 9QT
Tel: 020 7935 1234

Date of Service: 23/11/2023

Provider: Dr Sarah Chen MBBS MRCP
Specialty: Cardiology

Description: 12-lead ECG recording and interpretation

Amount Due: GBP 350.00

Please settle within 14 days of receipt.`

const ecgBytes = await createPdf(ecgContent)
writeFileSync(join(e2eFixturesDir, 'ecg-invoice-london-clinic-dec2023.pdf'), ecgBytes)
console.log('Created e2e/fixtures/ecg-invoice-london-clinic-dec2023.pdf')

// 2. gp-notes-dr-sharma-2023.pdf
const gpContent = `GP CONSULTATION NOTES

Riverside Medical Practice
42 Station Road
London SE1 7PB

Date: 15/09/2023

Provider: Dr Priya Sharma MBBS MRCGP
Specialty: General Practice

Patient presented with fatigue and mild breathlessness.
BP 128/82 mmHg. Heart rate 72 bpm. SpO2 98%.

Impression: Likely iron-deficiency anaemia. FBC requested.

Follow-up in 2 weeks.`

const gpBytes = await createPdf(gpContent)
writeFileSync(join(e2eFixturesDir, 'gp-notes-dr-sharma-2023.pdf'), gpBytes)
console.log('Created e2e/fixtures/gp-notes-dr-sharma-2023.pdf')

// 3. skin-invoice-2023.pdf
const skinContent = `INVOICE

ClearSkin Dermatology Clinic
8 Wimpole Street
London W1G 9SP
Tel: 020 7935 5678

Date of Service: 10/07/2023

Provider: Dr James Ward MBBS FRCP
Specialty: Dermatology

Presenting symptom: persistent rash — right forearm, 6 weeks duration.

Treatment: Betamethasone 0.1% cream prescribed (30g tube).

Amount Due: GBP 220.00

Please settle within 14 days.`

const skinBytes = await createPdf(skinContent)
writeFileSync(join(e2eFixturesDir, 'skin-invoice-2023.pdf'), skinBytes)
console.log('Created e2e/fixtures/skin-invoice-2023.pdf')

// 4. neurology-scan-letter-nov2019.pdf
const neuroContent = `NEUROLOGY REFERRAL LETTER

National Hospital for Neurology
Queen Square
London WC1N 3BG

Date: 21/11/2019

Dear Colleague,

Re: Referral for MRI brain and neurovascular assessment.

Clinical history: Incidental finding of unruptured brain aneurysm (3 mm, right MCA) on prior imaging. Patient asymptomatic.

Recommendation: Annual MRI surveillance. Neurosurgical opinion if growth > 5 mm.

Yours sincerely,
Consultant Neurologist`

const neuroBytes = await createPdf(neuroContent)
writeFileSync(join(e2eFixturesDir, 'neurology-scan-letter-nov2019.pdf'), neuroBytes)
console.log('Created e2e/fixtures/neurology-scan-letter-nov2019.pdf')

// 5. gynaecology-invoice-2023.pdf
const gynContent = `INVOICE

Women's Health London
22 Portland Place
London W1B 1LY
Tel: 020 7580 0001

Date of Service: 05/04/2023

Provider: Dr Helen Moore MBBS MRCOG
Specialty: Gynaecology

Itemised charges:
  Initial consultation      GBP 280.00
  Pelvic ultrasound scan    GBP 180.00
  Blood panel (hormonal)    GBP  95.00

Total Amount Due: GBP 555.00

Payment due within 14 days of receipt.`

const gynBytes = await createPdf(gynContent)
writeFileSync(join(e2eFixturesDir, 'gynaecology-invoice-2023.pdf'), gynBytes)
console.log('Created e2e/fixtures/gynaecology-invoice-2023.pdf')

// Upload (22Nov2021-13_16_15).pdf — London Clinic, Cardiography, 19/11/21
const londonClinicContent = `INVOICE

Belgrove Cardiac Clinic
14 Langford Place
London NW8 0NX
United Kingdom
Also at: 8 Cavendish Way, London W1M 4AB, United Kingdom

Date of Service: 19/11/21

Provider: Dr James Edwards MBBS FRCP
Specialty: Cardiography

Description: Cardiography assessment and ECG interpretation

Patient account number M24195380/1

Amount Due: GBP 280.00

Please settle within 14 days of receipt.`

const londonClinicBytes = await createPdf(londonClinicContent)
writeFileSync(join(e2eFixturesDir, 'Upload (22Nov2021-13_16_15).pdf'), londonClinicBytes)
console.log('Created e2e/fixtures/Upload (22Nov2021-13_16_15).pdf')

// 2021-Nov-22_12_34.pdf — Cambridge Clinic, Cardiography, 19/11/21, 2 addresses, patient account A12345/21
const cambridgeClinicContent = `INVOICE

The Cambridge Clinic
1 Hills Road
Cambridge CB2 1GE
United Kingdom
Also at: 2 Trumpington Street, Cambridge CB2 1QA
Email: info@cambridgeclinic.co.uk
Sort Code: 40-47-84

Date of Service: 19/11/21

Provider: Cardiography Department
Specialty: Cardiography

Description: Cardiography service charge

Amount Due: £345.00

Patient account number :A12345/21

Please settle within 14 days of receipt.`

const cambridgeClinicBytes = await createPdf(cambridgeClinicContent)
writeFileSync(join(e2eFixturesDir, '2021-Nov-22_12_34.pdf'), cambridgeClinicBytes)
console.log('Created e2e/fixtures/2021-Nov-22_12_34.pdf')
