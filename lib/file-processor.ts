import * as XLSX from "xlsx-js-style"
import Papa from "papaparse"

export interface ProcessedData {
  headers: string[]
  rows: any[][]
  totalRows: number
  sheetNames?: string[]  // Added for multi-sheet support
  allSheetData?: any[][][] // Added for Amion multi-sheet processing
}

export async function processFile(file: File): Promise<ProcessedData> {
  const fileExtension = file.name.split(".").pop()?.toLowerCase()

  if (fileExtension === "csv") {
    return processCsvFile(file)
  } else if (fileExtension === "xlsx" || fileExtension === "xls") {
    // Check if it might be an Amion file by name pattern
    const isAmionFile = file.name.toLowerCase().includes('amion') || 
                       file.name.toLowerCase().includes('schedule')
    return processExcelFile(file, isAmionFile)
  } else {
    throw new Error("Unsupported file format")
  }
}

async function processCsvFile(file: File): Promise<ProcessedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      complete: (results) => {
        const data = results.data as string[][]
        const headers = data[0] || []
        const rows = data.slice(1)

        resolve({
          headers,
          rows,
          totalRows: rows.length,
        })
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`))
      },
    })
  })
}

async function processExcelFile(file: File, preserveAllSheets: boolean = false): Promise<ProcessedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { 
          type: "array",
          cellDates: false,  // Don't auto-parse dates for Amion
          cellText: true,
          raw: false
        })

        if (preserveAllSheets) {
          // For Amion files, we need all sheets
          const allSheetData: any[][][] = []
          const sheetNames: string[] = []
          let totalRows = 0

          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName]
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1,
              raw: false,
              defval: ''
            }) as any[][]
            
            allSheetData.push(jsonData)
            sheetNames.push(sheetName)
            totalRows += jsonData.length
          })

          // For compatibility, also include the first sheet's data in the standard format
          const firstSheetData = allSheetData[0] || [[]]
          const headers = firstSheetData[0] || []
          const rows = firstSheetData.slice(1)

          resolve({
            headers,
            rows,
            totalRows,
            sheetNames,
            allSheetData
          })
        } else {
          // Standard processing for non-Amion files
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]

          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
          const headers = jsonData[0] || []
          const rows = jsonData.slice(1)

          resolve({
            headers,
            rows,
            totalRows: rows.length,
          })
        }
      } catch (error) {
        reject(new Error(`Excel parsing error: ${error}`))
      }
    }

    reader.onerror = () => reject(new Error("File reading error"))
    reader.readAsArrayBuffer(file)
  })
}

export function exportToCsv(data: any[], filename: string) {
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Standard single-sheet export
export function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, filename)
}

// New multi-sheet export for clinic-based output with styling
export function exportToExcelMultiSheet(
  data: any[], 
  filename: string, 
  clinicMapping?: Record<string, string>,
  mergedClinics?: Record<string, string[]>
) {
  // Group data by clinic
  const clinicData: { [clinic: string]: any[] } = {}
  
  data.forEach(row => {
    const originalClinic = row.assignment || "Unassigned"
    let targetSheet = clinicMapping?.[originalClinic] || originalClinic
    
    // Check if this clinic is part of a merge
    if (mergedClinics) {
      for (const [mergeName, clinics] of Object.entries(mergedClinics)) {
        if (clinics.includes(originalClinic)) {
          targetSheet = mergeName
          break
        }
      }
    }
    
    if (!clinicData[targetSheet]) {
      clinicData[targetSheet] = []
    }
    
    clinicData[targetSheet].push(row)
  })
  
  // Create workbook with one sheet per clinic
  const workbook = XLSX.utils.book_new()
  
  Object.entries(clinicData).forEach(([clinicName, clinicRows]) => {
    // Sort rows by date and shift for each clinic
    const sortedRows = clinicRows.sort((a, b) => {
      // Parse dates properly to avoid timezone issues
      const dateA = new Date(a.date + 'T12:00:00')
      const dateB = new Date(b.date + 'T12:00:00')
      const dateCompare = dateA.getTime() - dateB.getTime()
      if (dateCompare !== 0) return dateCompare
      
      if (a.shift === "AM" && b.shift === "PM") return -1
      if (a.shift === "PM" && b.shift === "AM") return 1
      
      return 0
    })
    
    // Transform to the output format matching your example
    const outputRows = sortedRows.map(row => ({
      "Date": row.date,
      "Day Of Week": getDayOfWeek(row.date),
      "AM": row.shift === "AM" ? row.displayName : "",
      "PM": row.shift === "PM" ? row.displayName : ""
    }))
    
    // Consolidate rows with same date
    const consolidatedRows: any[] = []
    let currentDateRows: any[] = []
    let currentDate: string | null = null
    
    outputRows.forEach(row => {
      if (row.Date !== currentDate) {
        // Process previous date's rows
        if (currentDateRows.length > 0) {
          consolidatedRows.push(...consolidateDate(currentDateRows))
        }
        currentDateRows = [row]
        currentDate = row.Date
      } else {
        currentDateRows.push(row)
      }
    })
    
    // Don't forget the last date
    if (currentDateRows.length > 0) {
      consolidatedRows.push(...consolidateDate(currentDateRows))
    }
    
    // Format dates to MM/DD/YYYY
    const formattedRows = consolidatedRows.map(row => ({
      Date: row.Date ? formatDateForExcel(row.Date) : "",
      "Day Of Week": row["Day Of Week"] || "",
      AM: row.AM || "",
      PM: row.PM || ""
    }))
    
    // Create worksheet with array of arrays format for better styling control
    const wsData = [
      ["Date", "Day Of Week", "AM", "PM"],
      ...formattedRows.map(row => [row.Date, row["Day Of Week"], row.AM, row.PM])
    ]
    
    const worksheet = XLSX.utils.aoa_to_sheet(wsData)
    
    // Apply comprehensive styling
    applyWorksheetStyling(worksheet, formattedRows.length)
    
    // Truncate sheet names to 31 characters (Excel limit)
    const sheetName = clinicName.substring(0, 31)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  })
  
  XLSX.writeFile(workbook, filename)
}

// Helper function to apply comprehensive worksheet styling
function applyWorksheetStyling(worksheet: any, rowCount: number) {
  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 12 }, // Day Of Week
    { wch: 20 }, // AM
    { wch: 20 }  // PM
  ]
  
  // Header style (row 1) - Light blue background with bold text
  const headerStyle = {
    font: { 
      bold: true, 
      name: "Calibri", 
      sz: 11,
      color: { rgb: "000000" }
    },
    fill: { 
      patternType: "solid", 
      fgColor: { rgb: "D9E1F2" } // Light blue
    },
    alignment: { 
      horizontal: "center", 
      vertical: "center" 
    },
    border: {
      top: { style: "thin", color: { rgb: "B8B8B8" } },
      bottom: { style: "thin", color: { rgb: "B8B8B8" } },
      left: { style: "thin", color: { rgb: "B8B8B8" } },
      right: { style: "thin", color: { rgb: "B8B8B8" } }
    }
  }
  
  // Date/Day column style - Lighter blue background
  const dateColumnStyle = {
    font: { 
      name: "Calibri", 
      sz: 11,
      color: { rgb: "000000" }
    },
    fill: { 
      patternType: "solid", 
      fgColor: { rgb: "E7EFFA" } // Lighter blue
    },
    alignment: { 
      horizontal: "left", 
      vertical: "center" 
    },
    border: {
      top: { style: "thin", color: { rgb: "B8B8B8" } },
      bottom: { style: "thin", color: { rgb: "B8B8B8" } },
      left: { style: "thin", color: { rgb: "B8B8B8" } },
      right: { style: "thin", color: { rgb: "B8B8B8" } }
    }
  }
  
  // Normal cell style - White background with borders
  const normalStyle = {
    font: { 
      name: "Calibri", 
      sz: 11,
      color: { rgb: "000000" }
    },
    fill: { 
      patternType: "solid", 
      fgColor: { rgb: "FFFFFF" } // White
    },
    alignment: { 
      horizontal: "left", 
      vertical: "center" 
    },
    border: {
      top: { style: "thin", color: { rgb: "B8B8B8" } },
      bottom: { style: "thin", color: { rgb: "B8B8B8" } },
      left: { style: "thin", color: { rgb: "B8B8B8" } },
      right: { style: "thin", color: { rgb: "B8B8B8" } }
    }
  }
  
  // Apply header styles to row 1
  const headerCells = ['A1', 'B1', 'C1', 'D1']
  headerCells.forEach(cell => {
    if (worksheet[cell]) {
      worksheet[cell].s = headerStyle
    }
  })
  
  // Apply data row styles
  for (let row = 2; row <= rowCount + 1; row++) {
    // Date and Day columns (A & B) - Light blue background
    const dateCell = `A${row}`
    const dayCell = `B${row}`
    
    if (worksheet[dateCell]) {
      worksheet[dateCell].s = dateColumnStyle
    }
    if (worksheet[dayCell]) {
      worksheet[dayCell].s = dateColumnStyle
    }
    
    // AM and PM columns (C & D) - White background
    const amCell = `C${row}`
    const pmCell = `D${row}`
    
    if (worksheet[amCell]) {
      worksheet[amCell].s = normalStyle
    }
    if (worksheet[pmCell]) {
      worksheet[pmCell].s = normalStyle
    }
  }
  
  // Set row heights (optional)
  if (!worksheet['!rows']) {
    worksheet['!rows'] = []
  }
  for (let i = 0; i <= rowCount; i++) {
    worksheet['!rows'][i] = { hpt: 20 }
  }
  
  // Add autofilter to the header row
  worksheet['!autofilter'] = { ref: `A1:D${rowCount + 1}` }
  
  // Set print options
  worksheet['!printOptions'] = {
    gridLines: true,
    headings: true
  }
  
  // Set page margins
  worksheet['!margins'] = {
    left: 0.7,
    right: 0.7,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3
  }
}

// Helper function to get day of week
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')  // Add noon time to avoid timezone issues
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return days[date.getDay()]
}

// Helper function to format date as MM/DD/YYYY
function formatDateForExcel(dateStr: string): string {
  // Parse the date string and add noon time to avoid timezone shifting
  const parts = dateStr.split('-')
  const year = parseInt(parts[0])
  const month = parseInt(parts[1])
  const day = parseInt(parts[2])
  
  // Create date using local timezone
  const date = new Date(year, month - 1, day, 12, 0, 0)
  
  // Format as MM/DD/YYYY
  const formattedMonth = String(date.getMonth() + 1).padStart(2, '0')
  const formattedDay = String(date.getDate()).padStart(2, '0')
  const formattedYear = date.getFullYear()
  
  return `${formattedMonth}/${formattedDay}/${formattedYear}`
}

// Helper function to consolidate multiple assignments for the same date/time
function consolidateDate(rows: any[]): any[] {
  if (rows.length === 0) return []
  
  // Group by AM and PM assignments
  const amAssignments = rows.filter(r => r.AM).map(r => r.AM)
  const pmAssignments = rows.filter(r => r.PM).map(r => r.PM)
  
  const result: any[] = []
  
  // First row has date and day
  const firstRow = {
    Date: rows[0].Date,
    "Day Of Week": rows[0]["Day Of Week"],
    AM: amAssignments[0] || "",
    PM: pmAssignments[0] || ""
  }
  result.push(firstRow)
  
  // Additional rows for multiple residents (no date/day)
  const maxAssignments = Math.max(amAssignments.length, pmAssignments.length)
  for (let i = 1; i < maxAssignments; i++) {
    result.push({
      Date: "",
      "Day Of Week": "",
      AM: amAssignments[i] || "",
      PM: pmAssignments[i] || ""
    })
  }
  
  return result
}