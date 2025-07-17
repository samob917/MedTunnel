export const financialDataTunnel = {
  id: "financial-data",
  name: "Financial Data Transformer",
  description: "Transform financial spreadsheets and accounting data",
  version: "1.0.0",

  fieldMappings: [
    {
      source: "account_id",
      target: "account_number",
      transform: (value) => String(value).padStart(10, "0"),
      required: true,
    },
    {
      source: "description",
      target: "transaction_description",
      transform: (value) => String(value).trim(),
      required: true,
    },
    {
      source: "amount",
      target: "transaction_amount",
      transform: (value) => Number.parseFloat(value).toFixed(2),
      validate: (value) => !isNaN(Number.parseFloat(value)),
    },
    {
      source: "date",
      target: "transaction_date",
      transform: (value) => {
        const date = new Date(value)
        return date.toISOString().split("T")[0]
      },
    },
    {
      source: "category",
      target: "account_category",
      transform: (value) => String(value).toUpperCase(),
    },
  ],

  additionalFields: [
    {
      target: "currency",
      value: "USD",
      type: "constant",
    },
    {
      target: "processed_date",
      value: () => new Date().toISOString(),
      type: "function",
    },
  ],

  validation: {
    skipEmptyRows: true,
    requireAllMandatory: true,
  },

  postProcess: (data) => {
    return data.sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date))
  },
}
