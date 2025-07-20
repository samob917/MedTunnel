import { medicalRecordsTunnel } from "./tunnels/medical-records.js"
import { financialDataTunnel } from "./tunnels/financial-data.js"
import { amionTunnel } from "./tunnels/amion.js"

export interface TunnelConfig {
  id: string
  name: string
  description: string
  version: string
  fieldMappings: FieldMapping[]
  additionalFields?: AdditionalField[]
  validation?: ValidationConfig
  preProcess?: (data: any[][], headers: string[], config?: any) => {
    headers: string[]
    rows: any[][]
    errors: string[]
    ambiguousShifts?: any[]  // Added for Amion single-row residents
    assignments?: any[]      // Added for partial assignments
  }
  postProcess?: (data: any[]) => any[]
}

export interface FieldMapping {
  source: string
  target: string
  transform?: (value: any) => any
  validate?: (value: any) => boolean
  required?: boolean
}

export interface AdditionalField {
  target: string
  value: any
  type: "constant" | "function"
}

export interface ValidationConfig {
  skipEmptyRows?: boolean
  requireAllMandatory?: boolean
  customRules?: ValidationRule[]
}

export interface ValidationRule {
  field: string
  rule: (value: any) => boolean
  message: string
}

export interface ProcessTunnelResult {
  processedData: any[]
  errors: string[]
  ambiguousShifts?: any[]  // For Amion single-row residents
}

// Registry of all available tunnels
export const tunnelRegistry: Record<string, TunnelConfig> = {
  "amion": amionTunnel,
}

export function getTunnel(tunnelId: string): TunnelConfig | null {
  return tunnelRegistry[tunnelId] || null
}

export function getAllTunnels(): TunnelConfig[] {
  return Object.values(tunnelRegistry)
}

export function processTunnelData(
  data: any[][],
  headers: string[],
  tunnel: TunnelConfig,
  customMappings?: Record<string, string>,
): ProcessTunnelResult {
  let processedHeaders = headers
  let processedRows = data
  let preProcessErrors: string[] = []
  let ambiguousShifts: any[] | undefined

  // Apply pre-processing if available (for special formats like Amion)
  if (tunnel.preProcess) {
    const preProcessed = tunnel.preProcess(data, headers, customMappings)
    processedHeaders = preProcessed.headers
    processedRows = preProcessed.rows
    preProcessErrors = preProcessed.errors || []
    
    // Check for ambiguous shifts (Amion single-row residents)
    if (preProcessed.ambiguousShifts && preProcessed.ambiguousShifts.length > 0) {
      ambiguousShifts = preProcessed.ambiguousShifts
      // If we have assignments ready, use them
      if (preProcessed.assignments) {
        // Return early with partial data and ambiguous shifts
        return {
          processedData: preProcessed.assignments || [],
          errors: preProcessErrors,
          ambiguousShifts
        }
      }
    }
  }

  const errors: string[] = [...preProcessErrors]
  const processedData: any[] = []

  // Create header mapping
  const headerMap = processedHeaders.reduce(
    (map, header, index) => {
      map[header] = index
      return map
    },
    {} as Record<string, number>,
  )

  // Process each row
  processedRows.forEach((row, rowIndex) => {
    if (tunnel.validation?.skipEmptyRows && row.every((cell) => !cell)) {
      return
    }

    const processedRow: any = {}
    let hasErrors = false

    // Process field mappings
    tunnel.fieldMappings.forEach((mapping) => {
      const sourceIndex = headerMap[mapping.source]

      if (sourceIndex === undefined) {
        if (mapping.required) {
          errors.push(`Row ${rowIndex + 1}: Required field '${mapping.source}' not found`)
          hasErrors = true
        }
        return
      }

      let value = row[sourceIndex]

      // Apply transformation
      if (mapping.transform && value !== null && value !== undefined) {
        try {
          value = mapping.transform(value)
        } catch (error) {
          errors.push(`Row ${rowIndex + 1}: Transform error for '${mapping.source}': ${error}`)
          hasErrors = true
          return
        }
      }

      // Apply validation
      if (mapping.validate && value !== null && value !== undefined) {
        if (!mapping.validate(value)) {
          errors.push(`Row ${rowIndex + 1}: Validation failed for '${mapping.source}'`)
          hasErrors = true
          return
        }
      }

      // Check required fields
      if (mapping.required && (value === null || value === undefined || value === "")) {
        errors.push(`Row ${rowIndex + 1}: Required field '${mapping.source}' is empty`)
        hasErrors = true
        return
      }

      processedRow[mapping.target] = value
    })

    // Add additional fields
    if (tunnel.additionalFields) {
      tunnel.additionalFields.forEach((field) => {
        if (field.type === "constant") {
          processedRow[field.target] = field.value
        } else if (field.type === "function" && typeof field.value === "function") {
          processedRow[field.target] = field.value()
        }
      })
    }

    // Apply custom validation rules
    if (tunnel.validation?.customRules) {
      tunnel.validation.customRules.forEach((rule) => {
        const fieldValue = processedRow[rule.field]
        if (!rule.rule(fieldValue)) {
          errors.push(`Row ${rowIndex + 1}: ${rule.message}`)
          hasErrors = true
        }
      })
    }

    if (!hasErrors || !tunnel.validation?.requireAllMandatory) {
      processedData.push(processedRow)
    }
  })

  // Apply post-processing
  let finalData = processedData
  if (tunnel.postProcess) {
    finalData = tunnel.postProcess(processedData)
  }

  return { 
    processedData: finalData, 
    errors,
    ambiguousShifts 
  }
}