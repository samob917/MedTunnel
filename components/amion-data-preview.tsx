"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Settings, Calendar, Users } from "lucide-react"
import { AmbiguousShiftsResolver } from "./ambiguous-shifts-resolver"

interface AmionDataPreviewProps {
  convertedData: any[]
  clinicMapping?: Record<string, string>
  mergedClinics?: Record<string, string[]>
  errors: string[]
  onConfigureClick?: () => void
  ambiguousShifts?: any[]
  onResolveAmbiguousShifts?: (resolvedShifts: any[]) => void
}

export function AmionDataPreview({
  convertedData,
  clinicMapping = {},
  mergedClinics = {},
  errors,
  onConfigureClick,
  ambiguousShifts,
  onResolveAmbiguousShifts,
}: AmionDataPreviewProps) {
  // Group data by clinic
  const clinicData: { [clinic: string]: any[] } = {}

  convertedData.forEach((row) => {
    const originalClinic = row.assignment || "Unassigned"
    let targetSheet = clinicMapping[originalClinic] || originalClinic

    // Check if this clinic is part of a merge
    for (const [mergeName, clinics] of Object.entries(mergedClinics)) {
      if (clinics.includes(originalClinic)) {
        targetSheet = mergeName
        break
      }
    }

    if (!clinicData[targetSheet]) {
      clinicData[targetSheet] = []
    }

    clinicData[targetSheet].push(row)
  })

  // Get sorted clinic names
  const clinicNames = Object.keys(clinicData).sort()
  const [activeClinic, setActiveClinic] = useState(clinicNames[0] || "")

  // Handle ambiguous shifts first
  if (ambiguousShifts && ambiguousShifts.length > 0 && onResolveAmbiguousShifts) {
    return (
      <AmbiguousShiftsResolver
        ambiguousShifts={ambiguousShifts}
        onResolve={onResolveAmbiguousShifts}
        onCancel={() => {
          console.log("User cancelled ambiguous shift resolution")
        }}
      />
    )
  }

  // Helper function to get day of week
  const getDayOfWeek = (dateStr: string): string => {
    const date = new Date(dateStr)
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    return days[date.getDay()]
  }

  // Transform data to output format for a specific clinic
  const getClinicOutputData = (clinicName: string) => {
    const clinicRows = clinicData[clinicName] || []

    // Sort by date and shift
    const sortedRows = clinicRows.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime()
      if (dateCompare !== 0) return dateCompare

      if (a.shift === "AM" && b.shift === "PM") return -1
      if (a.shift === "PM" && b.shift === "AM") return 1

      return 0
    })

    // Group by date
    const dateGroups: { [date: string]: { am: string[]; pm: string[] } } = {}

    sortedRows.forEach((row) => {
      if (!dateGroups[row.date]) {
        dateGroups[row.date] = { am: [], pm: [] }
      }

      if (row.shift === "AM") {
        dateGroups[row.date].am.push(row.displayName)
      } else {
        dateGroups[row.date].pm.push(row.displayName)
      }
    })

    // Convert to output format
    const outputRows: any[] = []

    Object.entries(dateGroups).forEach(([date, shifts]) => {
      const maxCount = Math.max(shifts.am.length, shifts.pm.length)

      for (let i = 0; i < maxCount; i++) {
        outputRows.push({
          date: i === 0 ? date : "",
          dayOfWeek: i === 0 ? getDayOfWeek(date) : "",
          am: shifts.am[i] || "",
          pm: shifts.pm[i] || "",
        })
      }
    })

    return outputRows
  }

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Conversion Warnings</span>
          </div>
          <ul className="text-sm text-amber-700 space-y-1">
            {errors.slice(0, 5).map((error, idx) => (
              <li key={idx}>• {error}</li>
            ))}
            {errors.length > 5 && <li className="italic">... and {errors.length - 5} more warnings</li>}
          </ul>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Preview by Clinic Sheet
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Each clinic will be exported as a separate sheet in the Excel file
            </p>
          </div>
          {onConfigureClick && (
            <Button
              onClick={onConfigureClick}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 bg-transparent"
            >
              <Settings className="w-4 h-4" />
              Configure Names
            </Button>
          )}
        </div>

        {/* Stats Summary */}
        <div className="mt-4 flex gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              <strong>{clinicNames.length}</strong> clinics detected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700">
              <strong>{convertedData.length}</strong> total assignments
            </span>
          </div>
        </div>
      </div>

      {/* Clinic Selector - Desktop: Tabs, Mobile: Dropdown */}
      <div className="space-y-4">
        {/* Mobile Dropdown (hidden on larger screens) */}
        <div className="md:hidden">
          <Select value={activeClinic} onValueChange={setActiveClinic}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinicNames.map((clinic) => (
                <SelectItem key={clinic} value={clinic}>
                  <div className="flex items-center justify-between w-full">
                    <span>{clinic}</span>
                    <Badge variant="secondary" className="ml-2">
                      {clinicData[clinic].length}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop Tabs (hidden on mobile) */}
        <div className="hidden md:block">
          <div className="border rounded-lg bg-gray-50 p-2">
            <div className="flex flex-wrap gap-2">
              {clinicNames.map((clinic) => (
                <Button
                  key={clinic}
                  variant={activeClinic === clinic ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveClinic(clinic)}
                  className="flex items-center gap-2"
                >
                  <span className="font-medium">{clinic}</span>
                  <Badge variant={activeClinic === clinic ? "secondary" : "outline"} className="text-xs">
                    {clinicData[clinic].length}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Card */}
        <Card className="border-2">
          <CardHeader className="bg-gray-50 border-b">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>{activeClinic}</span>
              <Badge variant="secondary" className="text-sm">
                {getClinicOutputData(activeClinic).length} rows
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Day Of Week</TableHead>
                    <TableHead className="font-semibold">AM</TableHead>
                    <TableHead className="font-semibold">PM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getClinicOutputData(activeClinic)
                    .slice(0, 20)
                    .map((row, idx) => (
                      <TableRow key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <TableCell className="font-medium">{row.date}</TableCell>
                        <TableCell>{row.dayOfWeek}</TableCell>
                        <TableCell>
                          {row.am && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-sm">
                              {row.am}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.pm && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-sm">
                              {row.pm}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              {getClinicOutputData(activeClinic).length > 20 && (
                <div className="p-4 text-center bg-gray-50 border-t">
                  <p className="text-sm text-gray-600">
                    Showing first 20 of {getClinicOutputData(activeClinic).length} rows
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
