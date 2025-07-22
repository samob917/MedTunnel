"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Clock, Save, AlertCircle, CheckCircle } from "lucide-react"

interface AmbiguousShift {
  resident: string
  date: string
  assignment: string
  source: string
  row: number
  column: string
}

interface AmbiguousShiftsResolverProps {
  ambiguousShifts: AmbiguousShift[]
  onResolve: (resolvedShifts: Array<AmbiguousShift & { shift: "AM" | "PM" }>) => void
  onCancel: () => void
}

export function AmbiguousShiftsResolver({ ambiguousShifts, onResolve, onCancel }: AmbiguousShiftsResolverProps) {
  const [shiftSelections, setShiftSelections] = useState<Record<string, "AM" | "PM">>({})
  const [isProcessing, setIsProcessing] = useState(false)

  // Create unique key for each ambiguous shift
  const getShiftKey = (shift: AmbiguousShift) => `${shift.resident}-${shift.date}-${shift.assignment}-${shift.row}`

  // Group shifts by resident for better organization
  const groupedShifts = ambiguousShifts.reduce(
    (groups, shift) => {
      if (!groups[shift.resident]) {
        groups[shift.resident] = []
      }
      groups[shift.resident].push(shift)
      return groups
    },
    {} as Record<string, AmbiguousShift[]>,
  )

  const handleShiftSelection = (shiftKey: string, shift: "AM" | "PM") => {
    setShiftSelections((prev) => ({
      ...prev,
      [shiftKey]: shift,
    }))
  }

  const handleBulkSelection = (resident: string, shift: "AM" | "PM") => {
    const residentShifts = groupedShifts[resident] || []
    const updates: Record<string, "AM" | "PM"> = {}

    residentShifts.forEach((ambiguousShift) => {
      const key = getShiftKey(ambiguousShift)
      updates[key] = shift
    })

    setShiftSelections((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  const handleResolve = async () => {
    setIsProcessing(true)

    // Create resolved shifts array
    const resolvedShifts = ambiguousShifts.map((shift) => ({
      ...shift,
      shift: shiftSelections[getShiftKey(shift)] || "AM", // Default to AM if not selected
    }))

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    onResolve(resolvedShifts)
    setIsProcessing(false)
  }

  const totalShifts = ambiguousShifts.length
  const resolvedCount = Object.keys(shiftSelections).length
  const isComplete = resolvedCount === totalShifts

  // Helper function to format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <Clock className="w-5 h-5" />
            Resolve Ambiguous Shifts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  Found {totalShifts} residents with single-row assignments that need AM/PM specification.
                </p>
                <p className="text-sm">
                  Please specify whether each assignment should be scheduled for AM or PM shift.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Progress indicator */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isComplete ? "default" : "secondary"}>
                {resolvedCount} / {totalShifts} resolved
              </Badge>
              {isComplete && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Ready to process
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={!isComplete || isProcessing}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isProcessing ? "Processing..." : "Resolve & Continue"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shifts by Resident */}
      <div className="space-y-4">
        {Object.entries(groupedShifts).map(([resident, shifts]) => {
          const residentName = resident.includes(",") ? resident.split(",")[0].trim() : resident

          return (
            <Card key={resident}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{residentName}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkSelection(resident, "AM")}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      All AM
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBulkSelection(resident, "PM")}
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      All PM
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-center">Shift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((shift) => {
                        const shiftKey = getShiftKey(shift)
                        const selectedShift = shiftSelections[shiftKey]

                        return (
                          <TableRow key={shiftKey}>
                            <TableCell className="font-medium">{formatDate(shift.date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal">
                                {shift.assignment}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">{shift.source}</TableCell>
                            <TableCell className="text-sm text-gray-500">
                              Row {shift.row}, Col {shift.column}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={selectedShift || ""}
                                onValueChange={(value: "AM" | "PM") => handleShiftSelection(shiftKey, value)}
                              >
                                <SelectTrigger className="w-20">
                                  <SelectValue placeholder="?" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="AM">
                                    <span className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                      AM
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="PM">
                                    <span className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                      PM
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
