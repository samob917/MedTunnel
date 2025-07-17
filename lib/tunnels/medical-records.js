export const medicalRecordsTunnel = {
  id: "medical-records",
  name: "Medical Records Converter",
  description: "Convert patient data between different medical record formats",
  version: "1.0.0",

  // Field mappings configuration
  fieldMappings: [
    {
      source: "id",
      target: "patient_id",
      transform: (value) => `P${String(value).padStart(6, "0")}`,
      required: true,
    },
    {
      source: "first_name",
      target: "patient_first_name",
      transform: (value) => String(value).trim().toUpperCase(),
      required: true,
    },
    {
      source: "last_name",
      target: "patient_last_name",
      transform: (value) => String(value).trim().toUpperCase(),
      required: true,
    },
    {
      source: "email",
      target: "contact_email",
      transform: (value) => String(value).toLowerCase().trim(),
      validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    },
    {
      source: "phone",
      target: "contact_phone",
      transform: (value) => String(value).replace(/\D/g, ""),
      validate: (value) => /^\d{10}$/.test(value),
    },
    {
      source: "dob",
      target: "date_of_birth",
      transform: (value) => {
        const date = new Date(value)
        return date.toISOString().split("T")[0]
      },
      validate: (value) => !isNaN(new Date(value).getTime()),
    },
  ],

  // Additional fields to add
  additionalFields: [
    {
      target: "status",
      value: "ACTIVE",
      type: "constant",
    },
    {
      target: "created_date",
      value: () => new Date().toISOString().split("T")[0],
      type: "function",
    },
  ],

  // Validation rules
  validation: {
    skipEmptyRows: true,
    requireAllMandatory: true,
    customRules: [
      {
        field: "patient_id",
        rule: (value) => value && value.startsWith("P"),
        message: "Patient ID must start with P",
      },
    ],
  },

  // Post-processing function
  postProcess: (data) => {
    return data.sort((a, b) => a.patient_id.localeCompare(b.patient_id))
  },
}
