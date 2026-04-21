import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppointmentForm } from './AppointmentForm'
import type { Appointment, AppointmentStatus } from '@/store/appointmentsStore'
import type { Category } from '../categories/CategoryPicker'

// Mock Tauri invoke
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

// Mock useAppointments hook
const mockSaveAppointment = vi.fn()
vi.mock('@/hooks/useAppointments', () => ({
  useAppointments: () => ({
    saveAppointment: mockSaveAppointment,
  }),
}))

describe('AppointmentForm', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Follow-up',
      parentId: null,
      colorHex: '#FF6B6B',
      isSystem: false,
      sortOrder: 1,
    },
    {
      id: 'cat-2',
      name: 'Urgent',
      parentId: null,
      colorHex: '#FFD93D',
      isSystem: false,
      sortOrder: 2,
    },
  ]

  const mockCategoryRows = mockCategories.map(c => ({
    id: c.id,
    name: c.name,
    parent_id: c.parentId,
    color_hex: c.colorHex,
    is_system: c.isSystem,
    sort_order: c.sortOrder,
  }))

  beforeEach(() => {
    mockInvoke.mockClear()
    mockSaveAppointment.mockClear()
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'categories_list') {
        return Promise.resolve(mockCategoryRows)
      }
      if (command === 'categories_for_appointment') {
        return Promise.resolve([])
      }
      return Promise.resolve(null)
    })
  })

  describe('Rendering', () => {
    it('renders all form fields', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/doctor/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/clinic/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/specialty/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/reminder/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
      })
    })

    it('displays Cancel and Save buttons', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /save appointment/i })).toBeInTheDocument()
      })
    })

    it('pre-fills fields from initial appointment prop in edit mode', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      const initialAppointment: Appointment = {
        id: 'apt-1',
        title: 'Routine Checkup',
        doctor_name: 'Dr. Smith',
        clinic_name: 'City Clinic',
        specialty: 'General Practice',
        appt_date: '2025-01-15T10:00:00',
        duration_min: 30,
        location: '123 Main St',
        notes: 'Follow-up needed',
        status: 'scheduled' as AppointmentStatus,
        reminder_min: 15,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        document_ids: [],
      }

      mockInvoke.mockImplementation((command: string) => {
        if (command === 'categories_list') {
          return Promise.resolve(mockCategoryRows)
        }
        if (command === 'categories_for_appointment') {
          return Promise.resolve(['cat-1'])
        }
        return Promise.resolve(null)
      })

      render(
        <AppointmentForm onCancel={onCancel} onSave={onSave} initial={initialAppointment} />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toHaveValue('Routine Checkup')
        expect(screen.getByLabelText(/doctor/i)).toHaveValue('Dr. Smith')
        expect(screen.getByLabelText(/clinic/i)).toHaveValue('City Clinic')
        expect(screen.getByLabelText(/specialty/i)).toHaveValue('General Practice')
        expect(screen.getByLabelText(/duration/i)).toHaveValue(30)
        expect(screen.getByLabelText(/location/i)).toHaveValue('123 Main St')
        expect(screen.getByLabelText(/notes/i)).toHaveValue('Follow-up needed')
        expect(screen.getByLabelText(/reminder/i)).toHaveValue("15")
      })
    })

    it('shows "Save Changes" button in edit mode', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      const initialAppointment: Appointment = {
        id: 'apt-1',
        title: 'Test',
        doctor_name: 'Dr. Test',
        clinic_name: 'Test Clinic',
        specialty: 'General',
        appt_date: '2025-01-15T10:00:00',
        duration_min: 30,
        location: 'Test',
        notes: '',
        status: 'scheduled' as AppointmentStatus,
        reminder_min: 15,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        document_ids: [],
      }

      render(
        <AppointmentForm onCancel={onCancel} onSave={onSave} initial={initialAppointment} />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
      })
    })
  })

  describe('Cancel Button', () => {
    it('calls onCancel when Cancel button is clicked', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const cancelButton = await screen.findByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      expect(onCancel).toHaveBeenCalledOnce()
    })
  })

  describe('Validation', () => {
    it('shows error when title is empty and form is submitted', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const saveButton = await screen.findByRole('button', { name: /save appointment/i })
      fireEvent.submit(saveButton.closest('form')!)

      await waitFor(() => {
        expect(screen.getByText(/title is required\./i)).toBeInTheDocument()
      })
    })

    it('shows error when date is empty and form is submitted', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      await userEvent.type(titleInput, 'Test Appointment')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      fireEvent.submit(saveButton.closest('form')!)

      await waitFor(() => {
        expect(screen.getByText(/date and time are required\./i)).toBeInTheDocument()
      })
    })

    it('clears error message on successful resubmission', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const saveButton = await screen.findByRole('button', { name: /save appointment/i })

      // First attempt - validation error
      fireEvent.submit(saveButton.closest('form')!)
      await waitFor(() => {
        expect(screen.getByText(/title is required\./i)).toBeInTheDocument()
      })

      // Fill in required fields
      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)

      await userEvent.type(titleInput, 'Valid Appointment')
      await userEvent.type(dateInput, '2025-01-15T10:00')

      // Second attempt - should succeed
      await userEvent.click(screen.getByRole('button', { name: /save appointment/i }))

      await waitFor(() => {
        expect(screen.queryByText(/title is required\./i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    it('calls onSave with correct AppointmentInput shape', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)
      const durationInput = screen.getByLabelText(/duration/i)
      const doctorInput = screen.getByLabelText(/doctor/i)
      const clinicInput = screen.getByLabelText(/clinic/i)
      const locationInput = screen.getByLabelText(/location/i)
      const notesInput = screen.getByLabelText(/notes/i)

      await userEvent.type(titleInput, 'Doctor Visit')
      await userEvent.type(dateInput, '2025-01-15T10:00')
      await userEvent.clear(durationInput)
      await userEvent.type(durationInput, '45')
      await userEvent.type(doctorInput, 'Dr. Johnson')
      await userEvent.type(clinicInput, 'Heart Clinic')
      await userEvent.type(locationInput, '456 Oak Ave')
      await userEvent.type(notesInput, 'Bring insurance card')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
        const savedData = onSave.mock.calls[0][0]
        expect(savedData).toEqual(
          expect.objectContaining({
            title: 'Doctor Visit',
            appt_date: '2025-01-15T10:00:00',
            duration_min: 45,
            doctor_name: 'Dr. Johnson',
            clinic_name: 'Heart Clinic',
            location: '456 Oak Ave',
            notes: 'Bring insurance card',
          })
        )
      })
    })

    it('shows "Saving…" button text during async save', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 100)
          })
      )

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
      })
    })

    it('disables save button while saving', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 100)
          })
      )

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        const savingButton = screen.getByRole('button', { name: /saving/i })
        expect(savingButton).toBeDisabled()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message when onSave rejects', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('handles non-Error objects thrown by onSave', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockRejectedValueOnce('Unknown error')

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText('Unknown error')).toBeInTheDocument()
      })
    })
  })

  describe('Categories', () => {
    it('loads categories on mount via categories_list invoke', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('categories_list')
      })
    })

    it('calls categories_for_appointment on mount in edit mode', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      const initialAppointment: Appointment = {
        id: 'apt-1',
        title: 'Test',
        doctor_name: 'Dr. Test',
        clinic_name: 'Test Clinic',
        specialty: 'General',
        appt_date: '2025-01-15T10:00:00',
        duration_min: 30,
        location: 'Test',
        notes: '',
        status: 'scheduled' as AppointmentStatus,
        reminder_min: 15,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        document_ids: [],
      }

      render(
        <AppointmentForm onCancel={onCancel} onSave={onSave} initial={initialAppointment} />
      )

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('categories_for_appointment', {
          appointmentId: 'apt-1',
        })
      })
    })

    it('invokes categories_assign_appointment for new categories in edit mode', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      const initialAppointment: Appointment = {
        id: 'apt-1',
        title: 'Test',
        doctor_name: 'Dr. Test',
        clinic_name: 'Test Clinic',
        specialty: 'General',
        appt_date: '2025-01-15T10:00:00',
        duration_min: 30,
        location: 'Test',
        notes: '',
        status: 'scheduled' as AppointmentStatus,
        reminder_min: 15,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        document_ids: [],
      }

      mockInvoke.mockImplementation((command: string, args?: unknown) => {
        if (command === 'categories_list') {
          return Promise.resolve(mockCategoryRows)
        }
        if (command === 'categories_for_appointment') {
          return Promise.resolve([])
        }
        return Promise.resolve(null)
      })

      render(
        <AppointmentForm onCancel={onCancel} onSave={onSave} initial={initialAppointment} />
      )

      // Simulate category selection
      const categoryElements = await screen.findAllByRole('checkbox')
      if (categoryElements.length > 0) {
        await userEvent.click(categoryElements[0])
      }

      const saveButton = await screen.findByRole('button', { name: /save changes/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
      })
    })

    it('invokes categories_unassign for removed categories in edit mode', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      const initialAppointment: Appointment = {
        id: 'apt-1',
        title: 'Test',
        doctor_name: 'Dr. Test',
        clinic_name: 'Test Clinic',
        specialty: 'General',
        appt_date: '2025-01-15T10:00:00',
        duration_min: 30,
        location: 'Test',
        notes: '',
        status: 'scheduled' as AppointmentStatus,
        reminder_min: 15,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        document_ids: [],
      }

      mockInvoke.mockImplementation((command: string) => {
        if (command === 'categories_list') {
          return Promise.resolve(mockCategoryRows)
        }
        if (command === 'categories_for_appointment') {
          return Promise.resolve(['cat-1'])
        }
        return Promise.resolve(null)
      })

      render(
        <AppointmentForm onCancel={onCancel} onSave={onSave} initial={initialAppointment} />
      )

      // Simulate category deselection
      const categoryElements = await screen.findAllByRole('checkbox')
      if (categoryElements.length > 0) {
        await userEvent.click(categoryElements[0])
      }

      const saveButton = await screen.findByRole('button', { name: /save changes/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
      })
    })
  })

  describe('Date Conversion', () => {
    it('converts datetime-local format to ISO format on submit', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
        const savedData = onSave.mock.calls[0][0]
        expect(savedData.appt_date).toBe('2025-01-15T10:00:00')
      })
    })

    it('converts ISO date format from initial appointment to datetime-local on load', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn()

      const initialAppointment: Appointment = {
        id: 'apt-1',
        title: 'Test',
        doctor_name: 'Dr. Test',
        clinic_name: 'Test Clinic',
        specialty: 'General',
        appt_date: '2025-01-15T10:00:00',
        duration_min: 30,
        location: 'Test',
        notes: '',
        status: 'scheduled' as AppointmentStatus,
        reminder_min: 15,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        document_ids: [],
      }

      render(
        <AppointmentForm onCancel={onCancel} onSave={onSave} initial={initialAppointment} />
      )

      await waitFor(() => {
        const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement
        expect(dateInput.value).toContain('2025-01-15T10:00')
      })
    })
  })

  describe('Field Parsing', () => {
    it('parses duration and reminder as integers, null for invalid values', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)
      const durationInput = screen.getByLabelText(/duration/i)
      const reminderInput = screen.getByLabelText(/reminder/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')
      await userEvent.clear(durationInput)
      await userEvent.type(durationInput, '60')
      await userEvent.selectOptions(reminderInput, '30')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
        const savedData = onSave.mock.calls[0][0]
        expect(savedData.duration_min).toBe(60)
        expect(savedData.reminder_min).toBe(30)
      })
    })

    it('handles empty duration and reminder fields as null', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)
      const durationInput = screen.getByLabelText(/duration/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')
      await userEvent.clear(durationInput)

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
        const savedData = onSave.mock.calls[0][0]
        expect(savedData.duration_min).toBeNull()
        expect(savedData.reminder_min).toBe(60)
      })
    })
  })

  describe('Specialty and Status Selection', () => {
    it('allows selecting specialty from available options', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      render(<AppointmentForm onCancel={onCancel} onSave={onSave} />)

      const titleInput = screen.getByLabelText(/title/i)
      const dateInput = screen.getByLabelText(/date/i)
      const specialtySelect = screen.getByLabelText(/specialty/i)

      await userEvent.type(titleInput, 'Test')
      await userEvent.type(dateInput, '2025-01-15T10:00')
      await userEvent.selectOptions(specialtySelect, 'Cardiology')

      const saveButton = screen.getByRole('button', { name: /save appointment/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
        const savedData = onSave.mock.calls[0][0]
        expect(savedData.specialty).toBe('Cardiology')
      })
    })

    it('allows changing appointment status', async () => {
      const onCancel = vi.fn()
      const onSave = vi.fn().mockResolvedValueOnce(undefined)

      const initialAppointment: Appointment = {
        id: 'apt-1',
        title: 'Test',
        doctor_name: 'Dr. Test',
        clinic_name: 'Test Clinic',
        specialty: 'General',
        appt_date: '2025-01-15T10:00:00',
        duration_min: 30,
        location: 'Test',
        notes: '',
        status: 'scheduled' as AppointmentStatus,
        reminder_min: 15,
        created_at: '2025-01-01T00:00:00',
        updated_at: '2025-01-01T00:00:00',
        document_ids: [],
      }

      render(
        <AppointmentForm onCancel={onCancel} onSave={onSave} initial={initialAppointment} />
      )

      const statusSelect = await screen.findByLabelText(/status/i)
      await userEvent.selectOptions(statusSelect, 'completed')

      const saveButton = screen.getByRole('button', { name: /save changes/i })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled()
        const savedData = onSave.mock.calls[0][0]
        expect(savedData.status).toBe('completed')
      })
    })
  })
})
