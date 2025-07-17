import * as XLSX from "xlsx"
import Papa from "papaparse"

export interface ProcessedData {
  headers: string[]
  rows: any[][]
  totalRows: number
}

export async function processFile(file: File): Promise<ProcessedData> {
  const fileExtension = file.name.split(".").pop()?.toLowerCase()

  if (fileExtension === "csv") {
    return processCsvFile(file)
  } else if (fileExtension === "xlsx" || fileExtension === "xls") {
    return processExcelFile(file)
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

async function processExcelFile(file: File): Promise<ProcessedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
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

export function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1")
  XLSX.writeFile(workbook, filename)
}
