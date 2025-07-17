"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Eye, Settings, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FileUpload } from "@/components/file-upload"
import { TunnelSelector } from "@/components/tunnel-selector"
import { DataPreview } from "@/components/data-preview"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { AuthModal } from "@/components/auth-modal"
import { processFile, type ProcessedData, exportToCsv, exportToExcel } from "@/lib/file-processor"
import { getTunnel, processTunnelData } from "@/lib/tunnel-processor"
import { supabase } from "@/lib/supabase"

function MedTunnelApp() {
  const { user, signOut, usageCount, canUseService, incrementUsage } = useAuth()
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [selectedTunnel, setSelectedTunnel] = useState<string>("")
  const [parsedData, setParsedData] = useState<ProcessedData | null>(null)
  const [convertedData, setConvertedData] = useState<any[]>([])
  const [conversionErrors, setConversionErrors] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState("upload")
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [connectionStatus, setConnectionStatus] = useState<string>("Checking...")

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.from("users").select("count").limit(1)
        if (error) {
          setConnectionStatus(`Error: ${error.message}`)
        } else {
          setConnectionStatus("✅ Connected to Supabase")
        }
      } catch (err) {
        setConnectionStatus(`Connection failed: ${err}`)
      }
    }
    testConnection()
  }, [])

  const handleFileUpload = async (file: File) => {
    if (!canUseService) {
      setShowAuthModal(true)
      return
    }

    setUploadedFile(file)
    setIsProcessing(true)

    try {
      const processed = await processFile(file)
      setParsedData(processed)
      await incrementUsage()
      setActiveTab("tunnel")
    } catch (error) {
      console.error("File processing error:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTunnelSelect = (tunnelId: string) => {
    setSelectedTunnel(tunnelId)
    if (parsedData) {
      processConversion(tunnelId, parsedData)
    }
    setActiveTab("preview")
  }

  const processConversion = (tunnelId: string, data: ProcessedData) => {
    const tunnel = getTunnel(tunnelId)
    if (!tunnel) return

    const { processedData, errors } = processTunnelData(data.rows, data.headers, tunnel)

    setConvertedData(processedData)
    setConversionErrors(errors)
  }

  const handleDownload = (format: "csv" | "excel") => {
    if (convertedData.length === 0) return

    const filename = `converted_${uploadedFile?.name?.split(".")[0] || "data"}`

    if (format === "csv") {
      exportToCsv(convertedData, `${filename}.csv`)
    } else {
      exportToExcel(convertedData, `${filename}.xlsx`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">MedTunnel</h1>
            <div className="text-sm text-gray-500 mt-2">Status: {connectionStatus}</div>
            <p className="text-lg text-gray-600">Transform your data with intelligent conversion tunnels</p>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{usageCount}/5 uses</Badge>
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{usageCount}/1 free use</Badge>
                <Button variant="outline" size="sm" onClick={() => setShowAuthModal(true)}>
                  <User className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="tunnel" disabled={!parsedData} className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Select Tunnel
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={!selectedTunnel} className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="download" disabled={!convertedData.length} className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Your File</CardTitle>
                  <CardDescription>
                    Upload an Excel (.xlsx) or CSV file to get started with data conversion
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload onFileUpload={handleFileUpload} isProcessing={isProcessing} />
                  {uploadedFile && parsedData && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <p className="text-green-800">
                        ✓ File processed: <strong>{uploadedFile.name}</strong>
                      </p>
                      <p className="text-sm text-green-600 mt-1">
                        {parsedData.totalRows} rows, {parsedData.headers.length} columns
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tunnel" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select Conversion Tunnel</CardTitle>
                  <CardDescription>Choose a predefined tunnel for your data conversion</CardDescription>
                </CardHeader>
                <CardContent>
                  <TunnelSelector onTunnelSelect={handleTunnelSelect} selectedTunnel={selectedTunnel} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preview Conversion</CardTitle>
                  <CardDescription>Review your data before downloading the converted file</CardDescription>
                </CardHeader>
                <CardContent>
                  <DataPreview
                    originalData={parsedData}
                    convertedData={convertedData}
                    errors={conversionErrors}
                    isProcessing={isProcessing}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="download" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Download Converted File</CardTitle>
                  <CardDescription>Your file has been successfully converted and is ready for download</CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <div className="flex justify-center gap-4">
                    <Button onClick={() => handleDownload("csv")} size="lg">
                      <Download className="w-5 h-5 mr-2" />
                      Download CSV
                    </Button>
                    <Button onClick={() => handleDownload("excel")} size="lg" variant="outline">
                      <Download className="w-5 h-5 mr-2" />
                      Download Excel
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600">{convertedData.length} rows converted successfully</p>
                  {conversionErrors.length > 0 && (
                    <p className="text-sm text-amber-600">{conversionErrors.length} rows had validation errors</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="text-center mt-12 p-6 bg-white rounded-lg shadow-sm">
          <p className="text-gray-600">
            Want new tunnels? Contact us for custom conversions and personalized preferences.
          </p>
        </div>
      </div>

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <MedTunnelApp />
    </AuthProvider>
  )
}
