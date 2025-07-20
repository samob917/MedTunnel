"use client"

import { useState, useEffect } from "react"
import { User, LogOut, Upload, Download, Eye, Settings, Crown, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileUpload } from "@/components/file-upload"
import { TunnelSelector } from "@/components/tunnel-selector"
import { DataPreview } from "@/components/data-preview"
import { AmionDataPreview } from "@/components/amion-data-preview"
import { ClinicConfigurationDialog, type AmionConfiguration } from "@/components/clinic-configuration-dialog"
import { AuthProvider, useAuth } from "@/components/auth-provider"
import { AuthModal } from "@/components/auth-modal"
import { SubscriptionManager } from "@/components/subscription-manager"
import { LimitReachedModal } from "@/components/limit-reached-modal"
// Remove this line if using a different toast library

import {
  processFile,
  type ProcessedData,
  exportToCsv,
  exportToExcel,
  exportToExcelMultiSheet,
} from "@/lib/file-processor"
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
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)

  // State for enhanced configuration
  const [amionConfig, setAmionConfig] = useState<AmionConfiguration>({
    name: "",
    clinicMappings: {},
    residentMappings: {},
    mergedClinics: {},
  })
  const [showMappingConfig, setShowMappingConfig] = useState(false)
  const [detectedClinics, setDetectedClinics] = useState<string[]>([])
  const [detectedResidents, setDetectedResidents] = useState<string[]>([])

  const [connectionStatus, setConnectionStatus] = useState<string>("Checking...")

  // Check if user is pro (mock some users as pro for demo)
  const isProUser = user?.subscription_tier === "pro" && user?.subscription_status === "active"

  // Handle Stripe redirect parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const canceled = urlParams.get('canceled')
    const sessionId = urlParams.get('session_id')
    
    if (success === 'true') {
      // Using your toast library - adjust based on what you're using
      // Example for react-toastify:
      // toast.success('Payment successful! Your Pro subscription is now active.')
      
      // Example for react-hot-toast:
      // toast.success('Payment successful! Your Pro subscription is now active.')
      
      console.log('Payment successful! Session ID:', sessionId)
      
      // Clean up URL
      window.history.replaceState({}, '', '/')
    }
    
    if (canceled === 'true') {
      // Using your toast library
      // toast.error('Payment canceled. You can try again anytime.')
      
      console.log('Payment canceled')
      
      // Clean up URL
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Since we know the connection works, let's make it simpler
        setConnectionStatus("✅ Connected to Supabase")
        
        // Or if you want to actually test it:
        const { error } = await supabase
          .from("users")
          .select("id")
          .single() // This might work better than limit(1)
        
        if (!error) {
          setConnectionStatus("✅ Connected to Supabase")
        } else {
          setConnectionStatus(`Error: ${error.message}`)
        }
      } catch (err) {
        setConnectionStatus(`Connection failed: ${err}`)
      }
    }
    
    testConnection()
  }, [])

  // Function to detect clinics and residents from converted data
  const detectClinicsAndResidents = (data: any[]) => {
    const clinics = new Set<string>()
    const residents = new Set<string>()

    data.forEach((row) => {
      if (row.assignment) {
        clinics.add(row.assignment)
      }
      if (row.resident) {
        residents.add(row.resident)
      }
    })

    setDetectedClinics(Array.from(clinics).sort())
    setDetectedResidents(Array.from(residents).sort())
  }

  const handleFileUpload = async (file: File) => {
    if (!canUseService) {
      // Show appropriate modal based on user type
      if (!user) {
        setShowLimitModal(true)
      } else if (!isProUser) {
        setShowLimitModal(true)
      }
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
      // Use your toast library here
      // Example: toast.error('Error processing file. Please try again.')
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

    let dataToProcess = data.rows
    let headersToProcess = data.headers

    // For Amion tunnel, we need to handle multi-sheet data specially
    if (tunnelId === "amion" && data.allSheetData) {
      // Combine all sheets into one dataset for the Amion preProcess function
      dataToProcess = []
      data.allSheetData.forEach((sheetData, sheetIndex) => {
        // Add sheet source information to each row
        sheetData.forEach((row, rowIndex) => {
          const augmentedRow = [...row, data.sheetNames?.[sheetIndex] || `Sheet${sheetIndex + 1}`]
          dataToProcess.push(augmentedRow)
        })
      })
      // Add sheet source to headers
      headersToProcess = [...headersToProcess, "_sheet_source"]
    }

    const { processedData, errors } = processTunnelData(dataToProcess, headersToProcess, tunnel)

    setConvertedData(processedData)
    setConversionErrors(errors)

    // Detect clinics and residents for Amion tunnel
    if (tunnelId === "amion") {
      detectClinicsAndResidents(processedData)
    }
  }

  const handleDownload = (format: "csv" | "excel") => {
    if (convertedData.length === 0) return

    const filename = `converted_${uploadedFile?.name?.split(".")[0] || "data"}`

    if (format === "csv") {
      exportToCsv(convertedData, `${filename}.csv`)
    } else {
      // Use multi-sheet export for Amion tunnel
      if (selectedTunnel === "amion") {
        // Apply resident name mappings to the data before export
        const mappedData = convertedData.map((row) => ({
          ...row,
          displayName: amionConfig.residentMappings[row.resident] || row.displayName,
        }))

        exportToExcelMultiSheet(mappedData, `${filename}.xlsx`, amionConfig.clinicMappings, amionConfig.mergedClinics)
      } else {
        exportToExcel(convertedData, `${filename}.xlsx`)
      }
    }
  }

  // Handle configuration save
  const handleConfigurationSave = (config: AmionConfiguration) => {
    setAmionConfig(config)
  }

  // Determine user type for limit modal
  const getUserType = () => {
    if (!user) return "anonymous"
    if (isProUser) return "pro"
    return "free"
  }

  const handleLimitModalSignUp = () => {
    setShowLimitModal(false)
    setShowAuthModal(true)
  }

  const handleLimitModalUpgrade = () => {
    setShowLimitModal(false)
    setShowSubscriptionModal(true)
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
              <>
                <div className="text-right">
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    {user.email}
                    {isProUser && <Crown className="w-4 h-4 text-yellow-500" />}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isProUser ? "Unlimited conversions" : `${usageCount} / 5 conversions`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowSubscriptionModal(true)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {isProUser ? "Manage" : "Upgrade"}
                </Button>
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Anonymous User</p>
                  <p className="text-xs text-gray-500">{usageCount} / 3 conversions</p>
                </div>
                <Button onClick={() => setShowAuthModal(true)}>
                  <User className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="tunnel" disabled={!parsedData}>
                <Settings className="w-4 h-4 mr-2" />
                Tunnel
              </TabsTrigger>
              <TabsTrigger value="preview" disabled={!selectedTunnel || convertedData.length === 0}>
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="download" disabled={convertedData.length === 0}>
                <Download className="w-4 h-4 mr-2" />
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
                        {parsedData.sheetNames &&
                          parsedData.sheetNames.length > 1 &&
                          ` across ${parsedData.sheetNames.length} sheets`}
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
                  {selectedTunnel === "amion" ? (
                    <AmionDataPreview
                      convertedData={convertedData}
                      clinicMapping={amionConfig.clinicMappings}
                      mergedClinics={amionConfig.mergedClinics}
                      errors={conversionErrors}
                      onConfigureClick={() => setShowMappingConfig(true)}
                    />
                  ) : (
                    <DataPreview
                      originalData={parsedData}
                      convertedData={convertedData}
                      errors={conversionErrors}
                      isProcessing={isProcessing}
                    />
                  )}
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

      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        userType={getUserType()}
        onSignUp={handleLimitModalSignUp}
        onUpgrade={handleLimitModalUpgrade}
      />

      <ClinicConfigurationDialog
        open={showMappingConfig}
        onOpenChange={setShowMappingConfig}
        detectedClinics={detectedClinics}
        detectedResidents={detectedResidents}
        onSave={handleConfigurationSave}
        currentConfig={amionConfig}
        userEmail={user?.email}
      />

      {/* Subscription Management Modal */}
      <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subscription Management</DialogTitle>
            <DialogDescription>Manage your MedTunnel subscription and billing</DialogDescription>
          </DialogHeader>
          <SubscriptionManager onClose={() => setShowSubscriptionModal(false)} />
        </DialogContent>
      </Dialog>
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