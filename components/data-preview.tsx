"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import type { ProcessedData } from "@/lib/file-processor"

interface DataPreviewProps {
  originalData: ProcessedData | null
  convertedData: any[]
  errors: string[]
  isProcessing: boolean
}

export function DataPreview({ originalData, convertedData, errors, isProcessing }: DataPreviewProps) {
  const [previewRows] = useState(10) // Show first 10 rows for preview

  if (isProcessing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-medium">Processing your data...</p>
          <p className="text-sm text-gray-600">This may take a few moments</p>
        </div>
      </div>
    )
  }

  if (!originalData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data to preview</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Data Preview</h3>
          <p className="text-sm text-gray-600">
            Showing first {Math.min(previewRows, originalData.totalRows)} of {originalData.totalRows} rows
          </p>
        </div>
        <div className="flex items-center gap-2">
          {convertedData.length > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {convertedData.length} rows converted
            </Badge>
          )}
          {errors.length > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {errors.length} errors
            </Badge>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Conversion Errors:</p>
              <div className="max-h-32 overflow-y-auto text-sm">
                {errors.slice(0, 5).map((error, index) => (
                  <p key={index} className="text-red-600">
                    • {error}
                  </p>
                ))}
                {errors.length > 5 && <p className="text-gray-600">... and {errors.length - 5} more errors</p>}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="original" className="w-full">
        <TabsList>
          <TabsTrigger value="original">Original Data ({originalData.totalRows})</TabsTrigger>
          <TabsTrigger value="converted" disabled={convertedData.length === 0}>
            Converted Data ({convertedData.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="original">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Original File Data</CardTitle>
              <CardDescription>Your uploaded file data structure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {originalData.headers.map((header, index) => (
                        <TableHead key={index}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {originalData.rows.slice(0, previewRows).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex}>{String(cell || "")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="converted">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Converted Data</CardTitle>
              <CardDescription>Data after tunnel transformation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {convertedData.length > 0 &&
                        Object.keys(convertedData[0]).map((key) => <TableHead key={key}>{key}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {convertedData.slice(0, previewRows).map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((value, cellIndex) => (
                          <TableCell key={cellIndex}>{String(value || "")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
