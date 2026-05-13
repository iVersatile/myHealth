/**
 * Tauri IPC mock for Playwright E2E tests.
 * Injected via addInitScript before every page load.
 * Uses sessionStorage['tauri_mock_state'] for persistence within a test.
 */
(function () {
  'use strict';

  // Disable Next.js dev overlay so it doesn't block hover events in tests
  document.addEventListener('DOMContentLoaded', function () {
    var style = document.createElement('style');
    style.textContent = 'nextjs-portal { pointer-events: none !important; }';
    document.head.appendChild(style);
  });

  const STATE_KEY = 'tauri_mock_state';

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      documents: [],
      contacts: [],
      clinics: [],
      appointments: [],
      notes: [],
      categories: [],
      trash: [],
      symptoms: [],
      medications: [],
      entity_links: [],
      draft_contacts: [],
      draft_clinics: [],
      draft_appointments: [],
      settings: {},
    };
  }

  function saveState(state) {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  // ------------------------------------------------------------------
  // Extraction fixtures keyed by filename (basename)
  // ------------------------------------------------------------------
  const EXTRACTION_MAP = {
    'sample-Upload (09Mar2023-16_31_26).pdf': {
      contact_suggestions: [
        {
          name: 'Mr John Green',
          phone: '07544 370440',
          email: 'jg@johngreenphysio.com',
          role: 'doctor',
        },
      ],
      clinic_suggestions: [
        {
          name: 'JOHN GREEN PHYSIOTHERAPY LTD',
          company_registration_number: '6780032',
          addresses: [
            { line1: '1 Physio Lane', city: 'London', postcode: 'W1 1AA' },
            { line1: '2 Clinic Road', city: 'London', postcode: 'W1 2BB' },
            { line1: '3 Health Street', city: 'London', postcode: 'W1 3CC' },
          ],
        },
      ],
      category_suggestion: 'Physiotherapy',
      document_tags: ['invoice', 'Mr John Green', 'Physiotherapy', '2023-03-09'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-03-09',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'medical-invoice.pdf': {
      contact_suggestions: [
        {
          name: 'Dr Sarah Mitchell',
          phone: '020 7946 0958',
          email: null,
          role: 'doctor',
        },
      ],
      clinic_suggestions: [
        {
          name: 'Hartfield Physiotherapy Clinic',
          company_registration_number: '5432109',
          addresses: [{ line1: '1 Harley Street', city: 'London', postcode: 'W1G 0PU' }],
        },
      ],
      category_suggestion: 'Physiotherapy',
      document_tags: ['invoice', 'PHYSIOTHERAPY'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2024-01-15',
      appointment_suggestion: { date: '2024-01-15', type: 'Physiotherapy' },
      extracted_text: 'Invoice from Hartfield Physiotherapy Clinic\nDate: 15 January 2024\nPatient: Test Patient\nTreatment: Physiotherapy session\nAmount due: £85.00',
      extracted_text_preview: 'Invoice from Hartfield Physiotherapy Clinic\nDate: 15 January 2024\nPatient: Test Patient\nTreatment: Physiotherapy session\nAmount due: £85.00',
      entities: [
        { entity_type: 'medication', name: 'Ibuprofen', value: null, unit: null, raw_text: 'Ibuprofen 400mg' },
        { entity_type: 'diagnosis', name: 'Musculoskeletal pain', value: null, unit: null, raw_text: 'Musculoskeletal pain' },
      ],
    },
    'BloodTest_2024-01-15.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: ['Blood Work'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2024-01-15',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'StMarysHospital_2024-06-15.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [{ name: 'St Marys Hospital', company_registration_number: null, addresses: [] }],
      category_suggestion: null,
      document_tags: ['clinic:St Marys Hospital'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2024-06-15',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'DrSmith_intl_phone_2024-03-10.pdf': {
      contact_suggestions: [
        {
          name: 'Dr Smith',
          phone: '+1 (555) 123-4567',
          email: null,
          role: 'doctor',
        },
      ],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: [],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2024-03-10',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'no-date-physio.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: [],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-03-09',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'no-date-no-filename.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: [],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: todayStr(),
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'two-page-scanned.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: ['Scan'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: todayStr(),
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'sample.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: [],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: todayStr(),
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    // Phase 64-66 E2E acceptance test fixtures
    'ecg-invoice-london-clinic-dec2023.pdf': {
      contact_suggestions: [
        { name: 'Dr Sarah Chen', phone: '020 7935 1234', email: null, role: 'doctor', specialty: 'Cardiology' },
      ],
      clinic_suggestions: [
        {
          name: 'The London Cardiac Centre',
          company_registration_number: null,
          addresses: [{ line1: '15 Harley Street', city: 'London', postcode: 'W1G 9QT' }],
        },
      ],
      category_suggestion: 'Cardiology',
      document_tags: ['ECG', 'Cardiology', 'invoice', '2023-11-23'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-11-23',
      appointment_suggestion: { date: '2023-11-23', type: 'Cardiology' },
      extracted_text_preview: '12-lead ECG recording and interpretation. Amount Due: GBP 350.00',
    },
    'gp-notes-dr-sharma-2023.pdf': {
      contact_suggestions: [
        { name: 'Dr Priya Sharma', phone: null, email: null, role: 'doctor', specialty: 'General Practice' },
      ],
      clinic_suggestions: [
        {
          name: 'Riverside Medical Practice',
          company_registration_number: null,
          addresses: [{ line1: '42 Station Road', city: 'London', postcode: 'SE1 7PB' }],
        },
      ],
      category_suggestion: 'General Practice',
      document_tags: ['GP notes', 'General Practice', '2023-09-15'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-09-15',
      appointment_suggestion: { date: '2023-09-15', type: 'General Practice' },
      extracted_text_preview: 'GP Consultation Notes. Date: 15/09/2023. Provider: Dr Priya Sharma.',
      clinical_notes: 'Likely iron-deficiency anaemia. FBC requested.',
    },
    'skin-invoice-2023.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [
        {
          name: 'ClearSkin Dermatology Clinic',
          company_registration_number: null,
          addresses: [{ line1: '8 Welbeck Street', city: 'London', postcode: 'W1G 9YN' }],
        },
      ],
      category_suggestion: 'Dermatology',
      document_tags: ['Dermatology', 'invoice', '2023-07-10'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-07-10',
      appointment_suggestion: { date: '2023-07-10', type: 'Dermatology' },
      extracted_text_preview: 'ClearSkin Dermatology Clinic. Amount Due: GBP 220.00',
    },
    'neurology-scan-letter-nov2019.pdf': {
      contact_suggestions: [],
      clinic_suggestions: [
        {
          name: 'National Hospital for Neurology',
          company_registration_number: null,
          addresses: [{ line1: 'Queen Square', city: 'London', postcode: 'WC1N 3BG' }],
        },
      ],
      category_suggestion: 'Neurology',
      document_tags: ['Neurology', 'referral', '2019-11-21'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2019-11-21',
      appointment_suggestion: null,
      extracted_text_preview: 'Neurology Referral Letter. Date: 21/11/2019.',
    },
    'gynaecology-invoice-2023.pdf': {
      contact_suggestions: [
        { name: 'Dr Helen Moore', phone: null, email: null, role: 'doctor', specialty: 'Gynaecology' },
      ],
      clinic_suggestions: [
        {
          name: "Women's Health London",
          company_registration_number: null,
          addresses: [{ line1: '22 Devonshire Place', city: 'London', postcode: 'W1G 6JB' }],
        },
      ],
      category_suggestion: 'Gynaecology',
      document_tags: ['Gynaecology', 'invoice', '2023-04-05'],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-04-05',
      appointment_suggestion: { date: '2023-04-05', type: 'Gynaecology' },
      extracted_text_preview: "Women's Health London. Total Amount Due: GBP 555.00",
    },
    // UTF-08 contact extraction edge-case fixtures
    'allcaps-surname-2023-06-01.pdf': {
      contact_suggestions: [
        { name: 'Mary Margaret MURPHY', phone: null, email: null, role: 'doctor' },
      ],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: [],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-06-01',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'gp-labelled-sharma-2023-06-01.pdf': {
      contact_suggestions: [
        { name: 'Vaibhav SHARMA', phone: null, email: null, role: 'doctor' },
      ],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: [],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-06-01',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
    'london-203-phone-2023-06-01.pdf': {
      contact_suggestions: [
        { name: 'Dr Jones', phone: '+44 (0) 203 423 7500', email: null, role: 'doctor' },
      ],
      clinic_suggestions: [],
      category_suggestion: null,
      document_tags: [],
      auto_tags: [],
      doctor_candidates: [],
      activity_date: '2023-06-01',
      appointment_suggestion: null,
      extracted_text_preview: null,
    },
  };

  function extractionForFilename(filename) {
    const base = filename ? filename.split('/').pop().split('\\').pop() : '';
    return (
      EXTRACTION_MAP[base] || {
        contact_suggestions: [],
        clinic_suggestions: [],
        category_suggestion: null,
        document_tags: [],
        auto_tags: [],
        doctor_candidates: [],
        activity_date: todayStr(),
        appointment_suggestion: null,
        extracted_text_preview: null,
      }
    );
  }

  // ------------------------------------------------------------------
  // OCR event simulation
  // ------------------------------------------------------------------
  const ocrListeners = [];
  const callbackRegistry = {};

  function simulateOcr(docId) {
    let page = 0;
    const total = 2;
    const interval = setInterval(() => {
      page++;
      const payload = { document_id: docId, current_page: page, total_pages: total };
      ocrListeners.forEach((cb) => {
        try {
          cb({ payload });
        } catch { /* ignore */ }
      });
      if (page >= total) clearInterval(interval);
    }, 600);
  }

  // ------------------------------------------------------------------
  // Command handlers
  // ------------------------------------------------------------------
  function handleInvoke(cmd, args) {
    const state = loadState();

    // Auth
    if (cmd === 'auth_is_locked') return Promise.resolve(false);
    if (cmd === 'auth_unlock') return Promise.resolve(null);
    if (cmd === 'auth_lock') return Promise.resolve(null);
    if (cmd === 'auth_has_password') return Promise.resolve(true);
    if (cmd === 'auth_list_users') return Promise.resolve([]);
    if (cmd === 'auth_set_password') return Promise.resolve(null);
    if (cmd === 'auth_switch_user') return Promise.resolve(null);

    // Settings
    if (cmd === 'settings_get') {
      const s = loadState();
      return Promise.resolve(s.settings[args.key] ?? null);
    }
    if (cmd === 'settings_set') {
      const s = loadState();
      s.settings[args.key] = args.value;
      saveState(s);
      return Promise.resolve(null);
    }
    if (cmd === 'settings_get_data_dir') return Promise.resolve('/mock/data');

    // Calendar
    if (cmd === 'calendar_list_sources') return Promise.resolve([]);

    // Stats
    if (cmd === 'stats_summary') {
      return Promise.resolve({
        total_documents: state.documents.length,
        total_contacts: state.contacts.length,
        total_clinics: state.clinics.length,
        total_appointments: state.appointments.length,
      });
    }

    // Search
    if (cmd === 'search_query') return Promise.resolve([]);

    // ------------------------------------------------------------------
    // Documents
    // ------------------------------------------------------------------
    if (cmd === 'documents_list') {
      const { page = 1, limit = 50 } = args || {};
      const offset = (page - 1) * limit;
      const docs = state.documents.filter((d) => !d._deleted);
      return Promise.resolve(docs.slice(offset, offset + limit));
    }

    if (cmd === 'documents_upload') {
      const filename = args?.filePath || args?.file_path || args?.filename || args?.file_name || 'unknown.pdf';
      const ext = extractionForFilename(filename);
      const doc = {
        id: uid(),
        filename,
        file_path: `/tmp/${filename}`,
        title: filename.replace(/\.pdf$/i, ''),
        mime_type: 'application/pdf',
        tags: [],
        category_id: null,
        category_name: null,
        clinic_id: null,
        clinic_name: null,
        activity_date: ext.activity_date,
        extracted_text: ext.extracted_text || null,
        created_at: nowIso(),
        updated_at: nowIso(),
        _extraction: ext,
        _entities: (ext.entities || []).map((e, i) => ({
          id: uid() + i,
          document_id: '',
          entity_type: e.entity_type,
          name: e.name,
          value: e.value || null,
          unit: e.unit || null,
          raw_text: e.raw_text,
          created_at: nowIso(),
        })),
        _deleted: false,
      };
      state.documents.push(doc);
      saveState(state);

      const base = filename.split('/').pop().split('\\').pop();
      if (base === 'two-page-scanned.pdf') {
        setTimeout(() => simulateOcr(doc.id), 100);
      }

      return Promise.resolve(doc);
    }

    if (cmd === 'documents_run_extraction') {
      const docId = args?.id || args?.document_id || args?.documentId;
      const doc = state.documents.find((d) => d.id === docId);
      const ext = doc ? doc._extraction || extractionForFilename(doc.filename) : {};
      return Promise.resolve(ext);
    }

    if (cmd === 'documents_get_extraction_status') {
      const docId = args?.document_id || args?.documentId;
      const doc = state.documents.find((d) => d.id === docId);
      const suggestions = doc ? doc._extraction || extractionForFilename(doc.filename) : {};
      return Promise.resolve({ status: 'done', suggestions });
    }

    if (cmd === 'documents_get') {
      const docId = args?.document_id || args?.documentId || args?.id;
      const doc = state.documents.find((d) => d.id === docId);
      return doc ? Promise.resolve(doc) : Promise.reject(new Error('Document not found'));
    }

    if (cmd === 'documents_update') {
      const docId = args?.document_id || args?.documentId || args?.id;
      const idx = state.documents.findIndex((d) => d.id === docId);
      if (idx >= 0) {
        const normalized = { ...args };
        if ('activityDate' in normalized) { normalized.activity_date = normalized.activityDate; delete normalized.activityDate; }
        if ('clinicId' in normalized) { normalized.clinic_id = normalized.clinicId; delete normalized.clinicId; }
        if ('categoryId' in normalized) { normalized.category_id = normalized.categoryId; delete normalized.categoryId; }
        state.documents[idx] = { ...state.documents[idx], ...normalized, id: docId, updated_at: nowIso() };
        saveState(state);
        return Promise.resolve(state.documents[idx]);
      }
      return Promise.reject(new Error('Document not found'));
    }

    if (cmd === 'documents_tags_set') {
      const docId = args?.document_id || args?.documentId;
      const tags = args?.tags || [];
      const idx = state.documents.findIndex((d) => d.id === docId);
      if (idx >= 0) {
        state.documents[idx].tags = tags;
        state.documents[idx].updated_at = nowIso();
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'documents_delete') {
      const docId = args?.document_id || args?.documentId || args?.id;
      const idx = state.documents.findIndex((d) => d.id === docId);
      if (idx >= 0) {
        const doc = state.documents[idx];
        doc._deleted = true;
        if (!state.trash) state.trash = [];
        state.trash.push({
          entity_type: 'document',
          id: doc.id,
          display_name: doc.title || doc.filename || 'Untitled',
          deleted_at: nowIso(),
        });
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'documents_set_clinic') {
      const docId = args?.document_id || args?.documentId;
      const clinicId = args?.clinic_id || args?.clinicId;
      const clinicName = args?.clinicName || args?.clinic_name;
      const idx = state.documents.findIndex((d) => d.id === docId);
      if (idx >= 0) {
        let clinic = state.clinics.find((c) => c.id === clinicId);
        if (!clinic && clinicName) {
          clinic = state.clinics.find((c) => !c._deleted && c.name === clinicName);
        }
        state.documents[idx].clinic_id = clinic ? clinic.id : clinicId || null;
        state.documents[idx].clinic_name = clinic ? clinic.name : clinicName || null;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'documents_valid_categories') {
      return Promise.resolve(['lab', 'imaging', 'prescription', 'report', 'other']);
    }

    if (cmd === 'documents_export_report') {
      const docId = args?.document_id || args?.documentId || args?.id;
      const doc = state.documents.find((d) => d.id === docId);
      return Promise.resolve({
        document_id: docId || '',
        title: doc ? (doc.title || doc.filename.replace(/\.pdf$/i, '')) : 'Document',
        document_date: doc ? (doc.activity_date || null) : null,
        category: doc ? (doc.category_name || '') : '',
        clinic_name: doc ? (doc.clinic_name || null) : null,
        notes: null,
        tags: doc ? (doc.tags || []) : [],
        entities: [],
        appointments: [],
        ocr_excerpt: doc && doc.extracted_text ? doc.extracted_text.slice(0, 400) : null,
      });
    }

    if (cmd === 'documents_link_contact') return Promise.resolve(null);
    if (cmd === 'documents_link_clinic') return Promise.resolve(null);
    if (cmd === 'link_document_to_appointment') return Promise.resolve(null);
    if (cmd === 'unlink_document_from_appointment') return Promise.resolve(null);
    if (cmd === 'links_create') return Promise.resolve(null);
    if (cmd === 'links_delete') return Promise.resolve(null);
    if (cmd === 'links_list_for_document') return Promise.resolve([]);
    if (cmd === 'links_list_for_appointment') return Promise.resolve([]);

    if (cmd === 'links_score_candidates') return Promise.resolve([]);
    if (cmd === 'notes_for_entity') return Promise.resolve([]);

    if (cmd === 'appointments_suggest_from_document') {
      const docId = args?.id || args?.document_id || args?.documentId;
      const doc = state.documents.find((d) => d.id === docId);
      const ext = doc ? doc._extraction || extractionForFilename(doc.filename) : null;
      const apptSug = ext ? ext.appointment_suggestion : null;
      if (!apptSug) return Promise.resolve(null);
      const contacts = ext.contact_suggestions || [];
      const clinics = ext.clinic_suggestions || [];
      return Promise.resolve({
        appt_date: apptSug.date,
        title: `${apptSug.type} Appointment`,
        doctor_name: contacts.length > 0 ? contacts[0].name : null,
        specialty: apptSug.type || null,
        clinic_name: clinics.length > 0 ? clinics[0].name : null,
      });
    }

    // ------------------------------------------------------------------
    // Contacts
    // ------------------------------------------------------------------
    if (cmd === 'contacts_list') {
      const role = args?.role;
      let contacts = state.contacts.filter((c) => !c._deleted);
      if (role) contacts = contacts.filter((c) => c.role === role);
      return Promise.resolve(contacts);
    }

    if (cmd === 'contacts_create') {
      const input = args?.input || args;
      const contact = {
        id: uid(),
        name: input?.name || '',
        phone: input?.phone || null,
        email: input?.email || null,
        role: input?.role || 'other',
        clinic_id: input?.clinic_id || input?.clinicId || null,
        created_at: nowIso(),
        updated_at: nowIso(),
        _deleted: false,
      };
      state.contacts.push(contact);
      saveState(state);
      return Promise.resolve(contact);
    }

    if (cmd === 'contacts_create_with_clinic') {
      const clinicData = args?.clinic;
      let clinicId = null;
      if (clinicData) {
        const existing = state.clinics.find(
          (c) => c.name.toLowerCase() === (clinicData.name || '').toLowerCase()
        );
        if (existing) {
          clinicId = existing.id;
        } else {
          const clinic = {
            id: uid(),
            name: clinicData.name || '',
            company_registration_number: clinicData.company_registration_number ?? clinicData.crn ?? null,
            phone: clinicData.phone || null,
            addresses: clinicData.addresses || [],
            linked_contacts: [],
            created_at: nowIso(),
            updated_at: nowIso(),
            _deleted: false,
          };
          state.clinics.push(clinic);
          clinicId = clinic.id;
        }
      }
      const contact = {
        id: uid(),
        name: args?.name || '',
        phone: args?.phone || null,
        email: args?.email || null,
        role: args?.role || 'other',
        clinic_id: clinicId,
        created_at: nowIso(),
        updated_at: nowIso(),
        _deleted: false,
      };
      state.contacts.push(contact);
      saveState(state);
      return Promise.resolve({ contact, clinic_id: clinicId });
    }

    if (cmd === 'contacts_get') {
      const id = args?.contact_id || args?.contactId || args?.id;
      const contact = state.contacts.find((c) => c.id === id);
      return contact ? Promise.resolve(contact) : Promise.reject(new Error('Contact not found'));
    }

    if (cmd === 'contacts_update') {
      const id = args?.contact_id || args?.contactId || args?.id;
      const idx = state.contacts.findIndex((c) => c.id === id);
      if (idx >= 0) {
        state.contacts[idx] = { ...state.contacts[idx], ...args, id, updated_at: nowIso() };
        saveState(state);
        return Promise.resolve(state.contacts[idx]);
      }
      return Promise.reject(new Error('Contact not found'));
    }

    if (cmd === 'contacts_delete') {
      const id = args?.contact_id || args?.contactId || args?.id;
      const idx = state.contacts.findIndex((c) => c.id === id);
      if (idx >= 0) {
        state.contacts[idx]._deleted = true;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'find_duplicate_contacts') {
      // UI sends { userId, contactId, threshold } — look up contact by id, then find same-name others
      const contactId = args?.contactId || args?.contact_id;
      if (contactId) {
        const target = state.contacts.find((c) => c.id === contactId);
        if (!target) return Promise.resolve([]);
        const name = target.name.toLowerCase();
        const dupes = state.contacts.filter(
          (c) => !c._deleted && c.id !== contactId && c.name.toLowerCase() === name
        );
        return Promise.resolve(dupes);
      }
      // fallback: legacy name-based lookup
      const name = (args?.name || '').toLowerCase();
      return Promise.resolve(state.contacts.filter((c) => !c._deleted && c.name.toLowerCase() === name));
    }

    if (cmd === 'contacts_find_similar') {
      const name = (args?.name || '').toLowerCase();
      const match = state.contacts.find((c) => !c._deleted && c.name.toLowerCase() === name);
      return Promise.resolve(match || null);
    }

    if (cmd === 'merge_contacts') {
      const keepId = args?.keep_id || args?.keepId;
      const mergeId = args?.merge_id || args?.mergeId;
      const mergeIdx = state.contacts.findIndex((c) => c.id === mergeId);
      if (mergeIdx >= 0) {
        state.contacts[mergeIdx]._deleted = true;
      }
      const kept = state.contacts.find((c) => c.id === keepId);
      saveState(state);
      return Promise.resolve(kept || null);
    }

    // ------------------------------------------------------------------
    // Clinics
    // ------------------------------------------------------------------
    if (cmd === 'clinics_list') {
      const clinics = state.clinics.filter((c) => !c._deleted);
      return Promise.resolve(clinics);
    }

    if (cmd === 'clinics_list_with_contacts') {
      const clinics = state.clinics
        .filter((c) => !c._deleted)
        .map((c) => ({
          ...c,
          linked_contacts: (c.linked_contacts || []).map((cid) => {
            const contact = state.contacts.find((ct) => ct.id === cid);
            return contact ? { id: contact.id, name: contact.name, role: contact.role } : null;
          }).filter(Boolean),
        }));
      return Promise.resolve(clinics);
    }

    if (cmd === 'clinics_get') {
      const id = args?.clinic_id || args?.clinicId || args?.id;
      const clinic = state.clinics.find((c) => c.id === id);
      return clinic ? Promise.resolve(clinic) : Promise.reject(new Error('Clinic not found'));
    }

    if (cmd === 'clinics_create') {
      const clinic = {
        id: uid(),
        name: args?.name || '',
        company_registration_number: args?.company_registration_number ?? args?.crn ?? null,
        phone: args?.phone || null,
        addresses: args?.addresses || [],
        linked_contacts: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        _deleted: false,
      };
      state.clinics.push(clinic);
      saveState(state);
      return Promise.resolve(clinic);
    }

    if (cmd === 'clinics_update') {
      const id = args?.clinic_id || args?.clinicId || args?.id;
      const idx = state.clinics.findIndex((c) => c.id === id);
      if (idx >= 0) {
        state.clinics[idx] = { ...state.clinics[idx], ...args, id, updated_at: nowIso() };
        saveState(state);
        return Promise.resolve(state.clinics[idx]);
      }
      return Promise.reject(new Error('Clinic not found'));
    }

    if (cmd === 'clinics_delete') {
      const id = args?.clinic_id || args?.clinicId || args?.id;
      const idx = state.clinics.findIndex((c) => c.id === id);
      if (idx >= 0) {
        state.clinics[idx]._deleted = true;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'clinics_create_if_not_exists') {
      const input = args?.input || args;
      const name = input?.name || '';
      const existing = state.clinics.find(
        (c) => !c._deleted && c.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return Promise.resolve(existing);
      const clinic = {
        id: uid(),
        name,
        company_registration_number: input?.company_registration_number ?? input?.crn ?? null,
        phone: input?.phone || null,
        addresses: input?.addresses || [],
        linked_contacts: [],
        created_at: nowIso(),
        updated_at: nowIso(),
        _deleted: false,
      };
      state.clinics.push(clinic);
      saveState(state);
      return Promise.resolve(clinic);
    }

    if (cmd === 'clinics_link_contact') return Promise.resolve(null);
    if (cmd === 'clinics_get_linked_contacts') return Promise.resolve([]);
    if (cmd === 'clinics_get_linked_documents') return Promise.resolve([]);

    if (cmd === 'clinic_addresses_list') {
      const id = args?.clinic_id || args?.clinicId;
      const clinic = state.clinics.find((c) => c.id === id);
      return Promise.resolve(clinic ? clinic.addresses || [] : []);
    }

    // ------------------------------------------------------------------
    // Appointments
    // ------------------------------------------------------------------
    if (cmd === 'appointments_list') {
      const appts = state.appointments.filter((a) => !a._deleted);
      return Promise.resolve(appts);
    }

    if (cmd === 'appointments_create') {
      const input = args?.input || args;
      const appt = {
        id: uid(),
        title: input?.title || '',
        appt_date: input?.appt_date || input?.date || todayStr(),
        date: input?.appt_date || input?.date || todayStr(),
        doctor_name: input?.doctor_name || input?.doctorName || null,
        clinic_name: input?.clinic_name || input?.clinicName || null,
        specialty: input?.specialty || null,
        notes: input?.notes || null,
        status: input?.status || 'completed',
        contact_ids: input?.contact_ids || input?.contactIds || [],
        document_ids: input?.document_ids || [],
        duration_min: input?.duration_min || 0,
        location: input?.location || null,
        reminder_min: input?.reminder_min || 0,
        recurrence_series_id: null,
        reminder_offsets: input?.reminder_offsets || null,
        created_at: nowIso(),
        updated_at: nowIso(),
        _deleted: false,
      };
      state.appointments.push(appt);
      saveState(state);
      return Promise.resolve(appt);
    }

    if (cmd === 'appointments_get') {
      const id = args?.appointment_id || args?.appointmentId || args?.id;
      const appt = state.appointments.find((a) => a.id === id);
      return appt ? Promise.resolve(appt) : Promise.reject(new Error('Appointment not found'));
    }

    if (cmd === 'appointments_update') {
      const id = args?.appointment_id || args?.appointmentId || args?.id;
      const idx = state.appointments.findIndex((a) => a.id === id);
      if (idx >= 0) {
        state.appointments[idx] = { ...state.appointments[idx], ...args, id, updated_at: nowIso() };
        saveState(state);
        return Promise.resolve(state.appointments[idx]);
      }
      return Promise.reject(new Error('Appointment not found'));
    }

    if (cmd === 'appointments_delete') {
      const id = args?.appointment_id || args?.appointmentId || args?.id;
      const idx = state.appointments.findIndex((a) => a.id === id);
      if (idx >= 0) {
        state.appointments[idx]._deleted = true;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'appointment_link_contact') {
      const apptId = args?.appointment_id || args?.appointmentId;
      const contactId = args?.contact_id || args?.contactId;
      const idx = state.appointments.findIndex((a) => a.id === apptId);
      if (idx >= 0) {
        const ids = state.appointments[idx].contact_ids || [];
        if (!ids.includes(contactId)) {
          state.appointments[idx].contact_ids = [...ids, contactId];
          saveState(state);
        }
      }
      return Promise.resolve(null);
    }

    if (cmd === 'appointment_unlink_contact') {
      const apptId = args?.appointment_id || args?.appointmentId;
      const contactId = args?.contact_id || args?.contactId;
      const idx = state.appointments.findIndex((a) => a.id === apptId);
      if (idx >= 0) {
        state.appointments[idx].contact_ids = (state.appointments[idx].contact_ids || []).filter(
          (id) => id !== contactId
        );
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'recurrence_create') {
      const baseId = args?.baseAppointmentId;
      const base = state.appointments.find((a) => a.id === baseId);
      if (!base) return Promise.resolve(null);
      const seriesId = uid();
      base.recurrence_series_id = seriesId;
      const rule = args?.rule || 'weekly';
      const n = args?.occurrences ?? 4;
      for (let i = 1; i < n; i++) {
        const d = new Date(base.appt_date);
        if (rule === 'weekly') d.setDate(d.getDate() + 7 * i);
        else d.setMonth(d.getMonth() + i);
        state.appointments.push({
          ...base,
          id: uid(),
          appt_date: d.toISOString(),
          recurrence_series_id: seriesId,
          _deleted: false,
        });
      }
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === 'recurrence_delete_series') {
      const seriesId = args?.seriesId;
      const fromDate = args?.fromOccurrence || null;
      state.appointments.forEach((a) => {
        if (a.recurrence_series_id === seriesId) {
          if (!fromDate || a.appt_date >= fromDate) a._deleted = true;
        }
      });
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === 'reminders_schedule') return Promise.resolve(null);
    if (cmd === 'reminders_cancel') return Promise.resolve(null);

    // ------------------------------------------------------------------
    // Notes
    // ------------------------------------------------------------------
    if (cmd === 'notes_list') {
      return Promise.resolve(state.notes.filter((n) => !n._deleted));
    }

    if (cmd === 'notes_get') {
      const id = args?.note_id || args?.noteId || args?.id;
      const note = state.notes.find((n) => n.id === id);
      return note ? Promise.resolve(note) : Promise.reject(new Error('Note not found'));
    }

    if (cmd === 'notes_create') {
      const note = {
        id: uid(),
        title: args?.title || '',
        content: args?.content || '',
        tags: args?.tags || [],
        pinned: false,
        created_at: nowIso(),
        updated_at: nowIso(),
        _deleted: false,
      };
      state.notes.push(note);
      saveState(state);
      return Promise.resolve(note);
    }

    if (cmd === 'notes_update') {
      const id = args?.note_id || args?.noteId || args?.id;
      const idx = state.notes.findIndex((n) => n.id === id);
      if (idx >= 0) {
        state.notes[idx] = { ...state.notes[idx], ...args, id, updated_at: nowIso() };
        saveState(state);
        return Promise.resolve(state.notes[idx]);
      }
      return Promise.reject(new Error('Note not found'));
    }

    if (cmd === 'notes_delete') {
      const id = args?.note_id || args?.noteId || args?.id;
      const idx = state.notes.findIndex((n) => n.id === id);
      if (idx >= 0) {
        state.notes[idx]._deleted = true;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'notes_pin') {
      const id = args?.note_id || args?.noteId || args?.id;
      const pinned = args?.pinned !== undefined ? args.pinned : true;
      const idx = state.notes.findIndex((n) => n.id === id);
      if (idx >= 0) {
        state.notes[idx].pinned = pinned;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'notes_tags_set') {
      const id = args?.note_id || args?.noteId;
      const tags = args?.tags || [];
      const idx = state.notes.findIndex((n) => n.id === id);
      if (idx >= 0) {
        state.notes[idx].tags = tags;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    // ------------------------------------------------------------------
    // Categories
    // ------------------------------------------------------------------
    if (cmd === 'categories_list') {
      const includeArchived = args?.includeArchived === true;
      return Promise.resolve(
        state.categories.filter((c) => !c._deleted && (includeArchived || !c.is_archived))
      );
    }

    if (cmd === 'categories_create') {
      const cat = {
        id: uid(),
        name: args?.name || '',
        color: args?.color || '#6366f1',
        created_at: nowIso(),
        _deleted: false,
      };
      state.categories.push(cat);
      saveState(state);
      return Promise.resolve(cat);
    }

    if (cmd === 'categories_create_if_not_exists') {
      const name = args?.name || '';
      const existing = state.categories.find(
        (c) => !c._deleted && c.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) return Promise.resolve(existing.id);
      const cat = {
        id: uid(),
        name,
        color: args?.color || '#6366f1',
        created_at: nowIso(),
        _deleted: false,
      };
      state.categories.push(cat);
      saveState(state);
      return Promise.resolve(cat.id);
    }

    if (cmd === 'categories_update') {
      const id = args?.category_id || args?.categoryId || args?.id;
      const idx = state.categories.findIndex((c) => c.id === id);
      if (idx >= 0) {
        state.categories[idx] = { ...state.categories[idx], ...args, id };
        saveState(state);
        return Promise.resolve(state.categories[idx]);
      }
      return Promise.reject(new Error('Category not found'));
    }

    if (cmd === 'categories_reorder') {
      const orderedIds = args?.orderedIds || args?.ordered_ids || [];
      orderedIds.forEach((id, idx) => {
        const cat = state.categories.find((c) => c.id === id);
        if (cat) cat.sort_order = idx;
      });
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === 'categories_assign_document' || cmd === 'assign_category_to_document') {
      const docId = args?.document_id || args?.documentId;
      const catId = args?.category_id || args?.categoryId;
      const idx = state.documents.findIndex((d) => d.id === docId);
      if (idx >= 0) {
        const cat = state.categories.find((c) => c.id === catId);
        state.documents[idx].category_id = catId;
        state.documents[idx].category_name = cat ? cat.name : null;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'unassign_category_from_document') {
      const docId = args?.document_id || args?.documentId;
      const idx = state.documents.findIndex((d) => d.id === docId);
      if (idx >= 0) {
        state.documents[idx].category_id = null;
        state.documents[idx].category_name = null;
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'categories_for_document') {
      const docId = args?.document_id || args?.documentId;
      const doc = state.documents.find((d) => d.id === docId);
      if (doc && doc.category_id) {
        const cat = state.categories.find((c) => c.id === doc.category_id);
        return Promise.resolve(cat || null);
      }
      return Promise.resolve(null);
    }

    // ------------------------------------------------------------------
    // Trash
    // ------------------------------------------------------------------
    if (cmd === 'trash_list') {
      return Promise.resolve(state.trash || []);
    }

    if (cmd === 'trash_restore') {
      const id = args?.id;
      const entityType = args?.entityType || args?.entity_type;
      state.trash = (state.trash || []).filter((t) => !(t.id === id && t.entity_type === entityType));
      if (entityType === 'document') {
        const docIdx = state.documents.findIndex((d) => d.id === id);
        if (docIdx >= 0) state.documents[docIdx]._deleted = false;
      }
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === 'trash_hard_delete') {
      const id = args?.id;
      state.trash = (state.trash || []).filter((t) => t.id !== id);
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === 'trash_empty') {
      state.trash = [];
      saveState(state);
      return Promise.resolve(null);
    }

    // ------------------------------------------------------------------
    // Advanced search filters
    // ------------------------------------------------------------------
    if (cmd === 'get_flagged_lab_values') {
      const docId = args?.docId || args?.doc_id;
      const doc = state.documents.find((d) => d.id === docId);
      return Promise.resolve(doc?._flagged_values || []);
    }

    if (cmd === 'get_linked_documents') {
      return Promise.resolve([]);
    }

    if (cmd === 'documents_search_filtered') {
      const { query, dateFrom, dateTo, categoryIds, page = 0, limit = 20 } = args || {};
      let docs = state.documents.filter((d) => !d._deleted);
      const q = (query || '').toLowerCase();
      if (q) {
        docs = docs.filter(
          (d) =>
            (d.filename || '').toLowerCase().includes(q) ||
            (d.extracted_text || '').toLowerCase().includes(q),
        );
      }
      if (dateFrom) {
        docs = docs.filter((d) => d.activity_date && d.activity_date >= dateFrom);
      }
      if (dateTo) {
        docs = docs.filter((d) => d.activity_date && d.activity_date <= dateTo);
      }
      if (categoryIds && categoryIds.length > 0) {
        docs = docs.filter((d) => categoryIds.includes(d.category_id));
      }
      const total = docs.length;
      const items = docs.slice(page * limit, page * limit + limit);
      return Promise.resolve({ items, total });
    }

    if (cmd === 'documents_content_search') {
      const query = (args?.query || '').toLowerCase();
      const allResults = [];

      // Documents
      const docMatches = state.documents.filter(
        (d) => !d._deleted && d.extracted_text && d.extracted_text.toLowerCase().includes(query)
      );
      for (const d of docMatches) {
        const text = d.extracted_text;
        const idx = text.toLowerCase().indexOf(query);
        const start = Math.max(0, idx - 40);
        const end = Math.min(text.length, idx + query.length + 40);
        const snippet =
          text.slice(start, idx) +
          '<mark>' + text.slice(idx, idx + query.length) + '</mark>' +
          text.slice(idx + query.length, end);
        allResults.push({ entity_type: 'document', id: d.id, title: d.title || d.filename, snippet });
      }

      // Notes
      for (const n of (state.notes || [])) {
        if (n._deleted) continue;
        const fullText = (n.title || '') + ' ' + (n.content || '');
        if (!fullText.toLowerCase().includes(query)) continue;
        const idx = fullText.toLowerCase().indexOf(query);
        const start = Math.max(0, idx - 40);
        const end = Math.min(fullText.length, idx + query.length + 40);
        const snippet =
          fullText.slice(start, idx) +
          '<mark>' + fullText.slice(idx, idx + query.length) + '</mark>' +
          fullText.slice(idx + query.length, end);
        allResults.push({ entity_type: 'note', id: n.id, title: n.title || 'Untitled Note', snippet });
      }

      // Symptoms
      for (const s of (state.symptoms || [])) {
        if (s.deleted_at) continue;
        const fullText = (s.name || '') + (s.notes ? ' ' + s.notes : '');
        if (!fullText.toLowerCase().includes(query)) continue;
        const idx = fullText.toLowerCase().indexOf(query);
        const start = Math.max(0, idx - 40);
        const end = Math.min(fullText.length, idx + query.length + 40);
        const snippet =
          fullText.slice(start, idx) +
          '<mark>' + fullText.slice(idx, idx + query.length) + '</mark>' +
          fullText.slice(idx + query.length, end);
        allResults.push({ entity_type: 'symptom', id: s.id, title: s.name, snippet });
      }

      // Medications
      for (const m of (state.medications || [])) {
        if (m.deleted_at) continue;
        const fullText = (m.name || '') + (m.notes ? ' ' + m.notes : '');
        if (!fullText.toLowerCase().includes(query)) continue;
        const idx = fullText.toLowerCase().indexOf(query);
        const start = Math.max(0, idx - 40);
        const end = Math.min(fullText.length, idx + query.length + 40);
        const snippet =
          fullText.slice(start, idx) +
          '<mark>' + fullText.slice(idx, idx + query.length) + '</mark>' +
          fullText.slice(idx + query.length, end);
        allResults.push({ entity_type: 'medication', id: m.id, title: m.name, snippet });
      }

      // Apply entity-type filter
      const entityTypes = args?.entityTypes || null;
      let filtered = entityTypes && entityTypes.length
        ? allResults.filter((r) => entityTypes.includes(r.entity_type))
        : allResults;

      // Apply date range filter using activity_date on documents
      const dateFrom = args?.dateFrom || null;
      const dateTo = args?.dateTo || null;
      if (dateFrom || dateTo) {
        filtered = filtered.filter((r) => {
          const doc = r.entity_type === 'document'
            ? state.documents.find((d) => d.id === r.id)
            : null;
          const dateStr = doc?.activity_date || null;
          if (!dateStr) return true;
          if (dateFrom && dateStr < dateFrom) return false;
          if (dateTo && dateStr > dateTo) return false;
          return true;
        });
      }

      const dates = docMatches.map((d) => d.activity_date).filter(Boolean).sort();
      return Promise.resolve({
        results: filtered,
        summary: {
          first_date: dates[0] || null,
          last_date: dates[dates.length - 1] || null,
          doc_count: filtered.length,
          unique_providers: 0,
        },
      });
    }

    if (cmd === 'document_entities_get') {
      const docId = args?.document_id || args?.documentId;
      const doc = state.documents.find((d) => d.id === docId);
      const entities = (doc?._entities || []).map((e) => ({ ...e, document_id: docId }));
      return Promise.resolve(entities);
    }

    // ------------------------------------------------------------------
    // Symptoms
    // ------------------------------------------------------------------
    if (cmd === 'symptoms_list') {
      return Promise.resolve(state.symptoms.filter((s) => !s.deleted_at));
    }

    if (cmd === 'symptoms_create') {
      const input = args?.input || args;
      const s = {
        id: uid(),
        name: input?.name || '',
        severity: input?.severity ?? null,
        onset_date: input?.onset_date || null,
        notes: input?.notes || null,
        deleted_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      if (!state.symptoms) state.symptoms = [];
      state.symptoms.push(s);
      saveState(state);
      return Promise.resolve(s);
    }

    if (cmd === 'symptoms_get') {
      const id = args?.id;
      const s = (state.symptoms || []).find((x) => x.id === id);
      return s ? Promise.resolve(s) : Promise.reject(new Error('Symptom not found'));
    }

    if (cmd === 'symptoms_update') {
      const id = args?.id;
      const input = args?.input || {};
      const idx = (state.symptoms || []).findIndex((x) => x.id === id);
      if (idx >= 0) {
        state.symptoms[idx] = { ...state.symptoms[idx], ...input, id, updated_at: nowIso() };
        saveState(state);
        return Promise.resolve(state.symptoms[idx]);
      }
      return Promise.reject(new Error('Symptom not found'));
    }

    if (cmd === 'symptoms_delete') {
      const id = args?.id;
      const idx = (state.symptoms || []).findIndex((x) => x.id === id);
      if (idx >= 0) {
        state.symptoms[idx].deleted_at = nowIso();
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'symptoms_for_entity') {
      const { entityType, entityId } = args || {};
      const links = (state.entity_links || []).filter(
        (l) => l.from_type === 'symptom' && l.to_type === entityType && l.to_id === entityId
      );
      const ids = links.map((l) => l.from_id);
      const result = (state.symptoms || []).filter((s) => ids.includes(s.id) && !s.deleted_at);
      return Promise.resolve(result);
    }

    if (cmd === 'symptom_link') {
      const { symptomId, toType, toId } = args || {};
      if (!state.entity_links) state.entity_links = [];
      const already = state.entity_links.find(
        (l) => l.from_type === 'symptom' && l.from_id === symptomId && l.to_type === toType && l.to_id === toId
      );
      if (!already) {
        state.entity_links.push({ id: uid(), from_type: 'symptom', from_id: symptomId, to_type: toType, to_id: toId });
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'symptom_unlink') {
      const { symptomId, toType, toId } = args || {};
      state.entity_links = (state.entity_links || []).filter(
        (l) => !(l.from_type === 'symptom' && l.from_id === symptomId && l.to_type === toType && l.to_id === toId)
      );
      saveState(state);
      return Promise.resolve(null);
    }

    // ------------------------------------------------------------------
    // Medications
    // ------------------------------------------------------------------
    if (cmd === 'medications_list') {
      return Promise.resolve((state.medications || []).filter((m) => !m.deleted_at));
    }

    if (cmd === 'medications_create') {
      const input = args?.input || args;
      const m = {
        id: uid(),
        name: input?.name || '',
        dosage: input?.dosage || null,
        frequency: input?.frequency || null,
        start_date: input?.start_date || null,
        end_date: input?.end_date || null,
        notes: input?.notes || null,
        deleted_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      if (!state.medications) state.medications = [];
      state.medications.push(m);
      saveState(state);
      return Promise.resolve(m);
    }

    if (cmd === 'medications_get') {
      const id = args?.id;
      const m = (state.medications || []).find((x) => x.id === id);
      return m ? Promise.resolve(m) : Promise.reject(new Error('Medication not found'));
    }

    if (cmd === 'medications_update') {
      const id = args?.id;
      const input = args?.input || {};
      const idx = (state.medications || []).findIndex((x) => x.id === id);
      if (idx >= 0) {
        state.medications[idx] = { ...state.medications[idx], ...input, id, updated_at: nowIso() };
        saveState(state);
        return Promise.resolve(state.medications[idx]);
      }
      return Promise.reject(new Error('Medication not found'));
    }

    if (cmd === 'medications_delete') {
      const id = args?.id;
      const idx = (state.medications || []).findIndex((x) => x.id === id);
      if (idx >= 0) {
        state.medications[idx].deleted_at = nowIso();
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'medications_for_entity') {
      const { entityType, entityId } = args || {};
      const links = (state.entity_links || []).filter(
        (l) => l.from_type === 'medication' && l.to_type === entityType && l.to_id === entityId
      );
      const ids = links.map((l) => l.from_id);
      const result = (state.medications || []).filter((m) => ids.includes(m.id) && !m.deleted_at);
      return Promise.resolve(result);
    }

    if (cmd === 'medication_link') {
      const { medicationId, toType, toId } = args || {};
      if (!state.entity_links) state.entity_links = [];
      const already = state.entity_links.find(
        (l) => l.from_type === 'medication' && l.from_id === medicationId && l.to_type === toType && l.to_id === toId
      );
      if (!already) {
        state.entity_links.push({ id: uid(), from_type: 'medication', from_id: medicationId, to_type: toType, to_id: toId });
        saveState(state);
      }
      return Promise.resolve(null);
    }

    if (cmd === 'medication_unlink') {
      const { medicationId, toType, toId } = args || {};
      state.entity_links = (state.entity_links || []).filter(
        (l) => !(l.from_type === 'medication' && l.from_id === medicationId && l.to_type === toType && l.to_id === toId)
      );
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === 'appointment_tags_get') {
      return Promise.resolve([]);
    }

    if (cmd === 'get_appointment_links') {
      return Promise.resolve([]);
    }

    if (cmd === 'categories_for_appointment') {
      return Promise.resolve([]);
    }

    if (cmd === 'get_draft_entities') {
      const entityType = args?.entityType || args?.entity_type;
      let drafts = [];
      if (entityType === 'contact') drafts = state.draft_contacts || [];
      else if (entityType === 'clinic') drafts = state.draft_clinics || [];
      else if (entityType === 'appointment') drafts = state.draft_appointments || [];
      return Promise.resolve(drafts);
    }

    if (cmd === 'accept_draft_entity') {
      const entityType = args?.entityType || args?.entity_type;
      const id = args?.id;
      if (entityType === 'contact') {
        const idx = state.draft_contacts.findIndex((d) => d.id === id);
        if (idx !== -1) {
          const draft = state.draft_contacts.splice(idx, 1)[0];
          const permanent = { ...draft, id: draft.id, _deleted: false };
          delete permanent.entity_type;
          delete permanent.source_document_id;
          state.contacts.push(permanent);
        }
      } else if (entityType === 'clinic') {
        const idx = state.draft_clinics.findIndex((d) => d.id === id);
        if (idx !== -1) {
          const draft = state.draft_clinics.splice(idx, 1)[0];
          const permanent = { ...draft, _deleted: false };
          delete permanent.entity_type;
          delete permanent.source_document_id;
          state.clinics.push(permanent);
        }
      } else if (entityType === 'appointment') {
        const idx = state.draft_appointments.findIndex((d) => d.id === id);
        if (idx !== -1) {
          const draft = state.draft_appointments.splice(idx, 1)[0];
          const permanent = { ...draft, _deleted: false };
          delete permanent.entity_type;
          delete permanent.source_document_id;
          state.appointments.push(permanent);
        }
      }
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === 'reject_draft_entity') {
      const entityType = args?.entityType || args?.entity_type;
      const id = args?.id;
      if (entityType === 'contact') {
        state.draft_contacts = (state.draft_contacts || []).filter((d) => d.id !== id);
      } else if (entityType === 'clinic') {
        state.draft_clinics = (state.draft_clinics || []).filter((d) => d.id !== id);
      } else if (entityType === 'appointment') {
        state.draft_appointments = (state.draft_appointments || []).filter((d) => d.id !== id);
      }
      saveState(state);
      return Promise.resolve(null);
    }

    if (cmd === '__seed_draft_entity') {
      // Test-only: inject a draft row into the appropriate draft array.
      // args: { entityType: 'contact'|'clinic'|'appointment', draft: DraftEntityRow }
      const entityType = args?.entityType;
      const draft = args?.draft;
      if (entityType === 'contact') {
        state.draft_contacts = state.draft_contacts || [];
        state.draft_contacts.push(draft);
      } else if (entityType === 'clinic') {
        state.draft_clinics = state.draft_clinics || [];
        state.draft_clinics.push(draft);
      } else if (entityType === 'appointment') {
        state.draft_appointments = state.draft_appointments || [];
        state.draft_appointments.push(draft);
      }
      saveState(state);
      return Promise.resolve(null);
    }

    // Unknown command — log and resolve null
    console.warn('[tauri-mock] Unknown command:', cmd, args);
    return Promise.resolve(null);
  }

  // ------------------------------------------------------------------
  // transformCallback registry (needed for plugin:event|listen)
  // ------------------------------------------------------------------
  let callbackId = 1;

  function transformCallback(callback, once) {
    const id = callbackId++;
    callbackRegistry[id] = once
      ? (...args) => {
          delete callbackRegistry[id];
          callback(...args);
        }
      : callback;
    return id;
  }

  // ------------------------------------------------------------------
  // Main invoke override
  // ------------------------------------------------------------------
  function invoke(cmd, args) {
    // Tauri v2 passes args wrapped: { __tauriModule, message: { cmd, data } }
    // but from frontend code it's usually invoke('cmd', { key: value })
    // Handle both shapes.
    let realCmd = cmd;
    let realArgs = args || {};

    // plugin:event|listen / plugin:event|unlisten
    if (cmd === 'plugin:event|listen') {
      const { event, handler } = realArgs;
      if (event === 'ocr_progress' && callbackRegistry[handler]) {
        ocrListeners.push(callbackRegistry[handler]);
      }
      return Promise.resolve(1);
    }
    if (cmd === 'plugin:event|unlisten') {
      return Promise.resolve(null);
    }

    // Auto-accept all dialog confirmations in E2E tests
    // plugin-dialog's confirm() calls plugin:dialog|message and checks result === okLabel ('Ok')
    if (cmd === 'plugin:dialog|confirm' || cmd === 'plugin:dialog|message' || cmd === 'plugin:dialog|ask') {
      return Promise.resolve('Ok');
    }

    return handleInvoke(realCmd, realArgs);
  }

  // ------------------------------------------------------------------
  // Install __TAURI_INTERNALS__
  // ------------------------------------------------------------------
  window.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback,
    convertFileSrc: (src) => src,
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main' },
    },
    isTauri: true,
  };

  // Required by @tauri-apps/api/event _unlisten() — line 43 of event.js
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: () => {},
  };

  // Also expose the helper the frontend may use directly
  window.__TAURI__ = {
    core: { invoke },
    event: {
      listen: (event, handler) => {
        if (event === 'ocr_progress') ocrListeners.push(handler);
        return Promise.resolve(() => {});
      },
      unlisten: () => Promise.resolve(),
      emit: () => Promise.resolve(),
      once: () => Promise.resolve(() => {}),
    },
    convertFileSrc: (src) => src,
  };
})();
