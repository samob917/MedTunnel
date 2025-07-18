// tunnels/amion.js

const DEFAULT_CONFIG = {
  yearRangeStart: 2025,
  monthCutoff: 6, // July (0-indexed, so 6 = July)
  clinicMapping: {} // User-configurable clinic name mappings
}

const MONTH_MAP = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8, sept: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

export const amionTunnel = {
  id: "amion",
  name: "Amion Schedule Converter",
  description: "Convert Amion scheduling data with automatic date detection and AM/PM shifts",
  version: "2.0.0", // Updated version for multi-sheet support

  // Pre-process function to handle the special Amion format
  preProcess: (data, headers, config = DEFAULT_CONFIG) => {
    const errors = []
    
    // Process all sheets (data includes all sheets concatenated)
    const result = processAmionData(data, headers, config, errors)
    const allAssignments = result.assignments
    const ambiguousShifts = result.ambiguousShifts
    
    // Store ambiguous shifts in a special property
    if (ambiguousShifts && ambiguousShifts.length > 0) {
      // We'll need to handle these separately
      return {
        headers: ["resident", "displayName", "date", "shift", "assignment", "source", "row", "column"],
        rows: [], // Empty for now - will be filled after disambiguation
        errors,
        ambiguousShifts, // Pass these up for resolution
        assignments: allAssignments // Store the resolved assignments
      }
    }
    
    // Add display names based on duplicate last names
    addDisplayNames(allAssignments)

    // Convert to standard row format for the tunnel processor
    const processedRows = allAssignments.map(assignment => [
      assignment.resident,
      assignment.displayName,
      assignment.date,
      assignment.shift,
      assignment.assignment,
      assignment.source,
      assignment.row,
      assignment.column,
    ])

    // Return processed data with Amion-specific headers
    return {
      headers: ["resident", "displayName", "date", "shift", "assignment", "source", "row", "column"],
      rows: processedRows,
      errors,
    }
  },

  // Since Amion has a special format, we'll use a custom processor
  fieldMappings: [
    {
      source: "resident",
      target: "resident",
      required: true,
    },
    {
      source: "displayName",
      target: "displayName",
      required: true,
    },
    {
      source: "date",
      target: "date",
      required: true,
    },
    {
      source: "shift",
      target: "shift",
      required: true,
    },
    {
      source: "assignment",
      target: "assignment",
      required: true,
    },
    {
      source: "source",
      target: "source",
      required: false,
    },
    {
      source: "row",
      target: "row",
      required: false,
    },
    {
      source: "column",
      target: "column",
      required: false,
    },
  ],

  // Custom validation for Amion format
  validation: {
    skipEmptyRows: false, // We handle empty cells differently in Amion
    requireAllMandatory: false,
    customRules: [
      {
        field: "shift",
        rule: (value) => value === "AM" || value === "PM",
        message: "Shift must be either AM or PM",
      },
      {
        field: "date",
        rule: (value) => !isNaN(Date.parse(value)),
        message: "Invalid date format",
      },
    ],
  },

  // Post-process to sort by date and shift
  postProcess: (data) => {
    return data.sort((a, b) => {
      // First sort by date
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dateCompare !== 0) return dateCompare
      
      // Then by shift (AM before PM)
      if (a.shift === "AM" && b.shift === "PM") return -1
      if (a.shift === "PM" && b.shift === "AM") return 1
      
      // Finally by resident name
      return a.resident.localeCompare(b.resident)
    })
  },
}

// Helper function to process Amion format data
function processAmionData(data, headers, config, errors) {
  const allAssignments = []
  const allAmbiguousShifts = []
  
  if (data.length < 3) {
    errors.push("Not enough rows in the data. Expected at least 3 rows.")
    return {
      assignments: [],
      ambiguousShifts: []
    }
  }
  
  // Detect if this is input data with sheet source info
  const hasSheetSource = headers.includes("_sheet_source")
  const sheetSourceIndex = hasSheetSource ? headers.indexOf("_sheet_source") : -1
  
  // Group data by sheet if we have sheet source
  let sheetsToProcess = [{ name: "Sheet1", data: data }]
  
  if (hasSheetSource) {
    const sheetGroups = {}
    data.forEach(row => {
      const sheetName = row[sheetSourceIndex] || "Sheet1"
      if (!sheetGroups[sheetName]) {
        sheetGroups[sheetName] = []
      }
      // Remove sheet source from row before processing
      const rowWithoutSheet = row.slice(0, sheetSourceIndex)
      sheetGroups[sheetName].push(rowWithoutSheet)
    })
    
    sheetsToProcess = Object.entries(sheetGroups).map(([name, data]) => ({ name, data }))
  }
  
  // Process each sheet
  sheetsToProcess.forEach(({ name, data: sheetData }) => {
    const sheetResult = processAmionSheet(sheetData, name, config, errors)
    
    // Check if this sheet returned an object with ambiguous shifts
    if (sheetResult && typeof sheetResult === 'object' && !Array.isArray(sheetResult)) {
      if (sheetResult.ambiguousShifts) {
        allAmbiguousShifts.push(...sheetResult.ambiguousShifts)
      }
      if (sheetResult.assignments) {
        allAssignments.push(...sheetResult.assignments)
      }
    } else if (Array.isArray(sheetResult)) {
      // Regular assignments array
      allAssignments.push(...sheetResult)
    }
  })
  
  return {
    assignments: allAssignments,
    ambiguousShifts: allAmbiguousShifts
  }
}

// Process a single sheet of Amion data
function processAmionSheet(data, sheetName, config, errors) {
  const assignments = []
  const ambiguousShifts = []
  
  if (data.length < 3) {
    return assignments
  }
  
  // Row 2 (index 1) contains dates starting from column B (index 1)
  const dateRow = data[1]
  if (!dateRow || dateRow.length < 2) {
    errors.push(`No date row found in sheet ${sheetName}`)
    return assignments
  }

  // Parse all dates from the date row
  const dates = []
  for (let colIdx = 1; colIdx < dateRow.length; colIdx++) {
    const dateStr = dateRow[colIdx]
    if (dateStr) {
      const parsedDate = parseAmionDate(dateStr.toString(), config)
      if (parsedDate) {
        dates.push({ date: parsedDate, colIndex: colIdx })
      }
    }
  }
  
  // Process residents - updated logic to handle single-row residents
  let rowIdx = 2
  while (rowIdx < data.length) {
    const currentRow = data[rowIdx]
    if (!currentRow || currentRow.length === 0) {
      rowIdx++
      continue
    }
    
    // Check if this row has a resident name in the first column
    const residentName = extractResidentName(currentRow[0])
    
    if (residentName) {
      // Check if next row exists and has a resident name
      const nextRow = data[rowIdx + 1]
      const nextRowHasResident = nextRow && extractResidentName(nextRow[0])
      
      if (!nextRow || nextRowHasResident) {
        // This resident only has one row - need to determine AM/PM
        dates.forEach(({ date, colIndex }) => {
          if (currentRow[colIndex] && currentRow[colIndex].toString().trim()) {
            ambiguousShifts.push({
              resident: residentName,
              date,
              assignment: currentRow[colIndex].toString().trim(),
              source: sheetName,
              row: rowIdx + 1,
              column: getColumnLetter(colIndex),
            })
          }
        })
        rowIdx += 1
      } else {
        // Standard two-row resident (AM and PM)
        const amRow = currentRow
        const pmRow = nextRow
        
        // Process each date column
        dates.forEach(({ date, colIndex }) => {
          // AM shift
          if (amRow[colIndex] && amRow[colIndex].toString().trim()) {
            assignments.push({
              resident: residentName,
              displayName: residentName,
              date,
              shift: "AM",
              assignment: cleanClinicName(amRow[colIndex].toString().trim()),
              source: sheetName,
              row: rowIdx + 1,
              column: getColumnLetter(colIndex),
            })
          }
          
          // PM shift
          if (pmRow[colIndex] && pmRow[colIndex].toString().trim()) {
            assignments.push({
              resident: residentName,
              displayName: residentName,
              date,
              shift: "PM",
              assignment: cleanClinicName(pmRow[colIndex].toString().trim()),
              source: sheetName,
              row: rowIdx + 2,
              column: getColumnLetter(colIndex),
            })
          }
        })
        
        rowIdx += 2
      }
    } else {
      // This might be an additional assignment row for the same date/time
      // Process as before...
      rowIdx++
    }
  }
  
  // Store ambiguous shifts for later resolution
  if (ambiguousShifts.length > 0) {
    // Return an object with both assignments and ambiguous shifts
    return {
      assignments: assignments,
      ambiguousShifts: ambiguousShifts
    }
  }

  return assignments
}

// Clean clinic names (remove extra spaces, normalize)
function cleanClinicName(clinic) {
  return clinic.trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\s*\(\s*/g, ' (')  // Normalize parentheses
    .replace(/\s*\)\s*/g, ')')
}

// Parse Amion date format (e.g., "1-Jul", "Jul 1", "7/1")
function parseAmionDate(dateStr, config) {
  const cleaned = dateStr.trim()
  
  // Pattern: "1-Jul" or "31-Dec"
  const dayMonthMatch = cleaned.match(/(\d{1,2})-([A-Za-z]{3,})/)
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1])
    const monthStr = dayMonthMatch[2].toLowerCase()
    const month = MONTH_MAP[monthStr]
    
    if (!isNaN(day) && month !== undefined) {
      // Determine year based on month and config
      let year = config.yearRangeStart
      if (month < config.monthCutoff) {
        year = config.yearRangeStart + 1
      }
      
      const date = new Date(year, month, day)
      return formatDate(date)
    }
  }
  
  // Pattern: "Jul 1" or "December 31"
  const monthDayMatch = cleaned.match(/([A-Za-z]{3,})\s+(\d{1,2})/)
  if (monthDayMatch) {
    const monthStr = monthDayMatch[1].toLowerCase()
    const day = parseInt(monthDayMatch[2])
    const month = MONTH_MAP[monthStr]
    
    if (!isNaN(day) && month !== undefined) {
      let year = config.yearRangeStart
      if (month < config.monthCutoff) {
        year = config.yearRangeStart + 1
      }
      
      const date = new Date(year, month, day)
      return formatDate(date)
    }
  }
  
  // Pattern: "7/1" or "12/31"
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})/)
  if (slashMatch) {
    const month = parseInt(slashMatch[1]) - 1 // 0-indexed
    const day = parseInt(slashMatch[2])
    
    if (!isNaN(day) && !isNaN(month) && month >= 0 && month <= 11) {
      let year = config.yearRangeStart
      if (month < config.monthCutoff) {
        year = config.yearRangeStart + 1
      }
      
      const date = new Date(year, month, day)
      return formatDate(date)
    }
  }
  
  // ISO date format YYYY-MM-DD or date object string
  if (cleaned.match(/^\d{4}-\d{2}-\d{2}/)) {
    return cleaned.substring(0, 10)
  }
  
  // Try standard date parsing as fallback
  const parsed = new Date(cleaned)
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed)
  }
  
  return null
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Extract resident name from cell value
function extractResidentName(value) {
  if (!value || typeof value !== "string") return null
  
  const trimmed = value.trim()
  if (!trimmed) return null
  
  // Check if it looks like a name (contains comma and letters)
  if (!/[a-zA-Z]/.test(trimmed)) return null
  if (!trimmed.includes(",")) return null
  
  return trimmed
}

// Add display names for residents with duplicate last names
function addDisplayNames(assignments) {
  // Collect all unique full names and their last names
  const lastNameToFullNames = {}
  
  assignments.forEach(assignment => {
    if (assignment.resident.includes(",")) {
      const parts = assignment.resident.split(",")
      const lastName = parts[0].trim()
      
      if (!lastNameToFullNames[lastName]) {
        lastNameToFullNames[lastName] = new Set()
      }
      lastNameToFullNames[lastName].add(assignment.resident)
    }
  })
  
  // Create display name mapping
  const nameDisplayMap = {}
  
  Object.entries(lastNameToFullNames).forEach(([lastName, fullNames]) => {
    if (fullNames.size > 1) {
      // Multiple people with same last name - add first initial
      fullNames.forEach(fullName => {
        const parts = fullName.split(",")
        const lastNamePart = parts[0].trim()
        const firstNamePart = parts[1] ? parts[1].trim() : ""
        
        if (firstNamePart) {
          const firstInitial = firstNamePart.charAt(0).toUpperCase()
          nameDisplayMap[fullName] = `${lastName}-${firstInitial}`
        } else {
          nameDisplayMap[fullName] = lastName
        }
      })
    } else {
      // Only one person with this last name
      fullNames.forEach(fullName => {
        nameDisplayMap[fullName] = lastName
      })
    }
  })
  
  // Update display names in assignments
  assignments.forEach(assignment => {
    if (assignment.resident.includes(",")) {
      assignment.displayName = nameDisplayMap[assignment.resident] || assignment.resident.split(",")[0].trim()
    } else {
      assignment.displayName = assignment.resident
    }
  })
}

// Convert column index to Excel letter
function getColumnLetter(index) {
  let letter = ""
  while (index >= 0) {
    letter = String.fromCharCode(65 + (index % 26)) + letter
    index = Math.floor(index / 26) - 1
  }
  return letter
}