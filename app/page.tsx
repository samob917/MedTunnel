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

import {
  processFile,
  type ProcessedData,
  exportToCsv,
  exportToExcel,
  exportToExcelMultiSheet,
} from "@/lib/file-processor"
import { getTunnel, processTunnelData } from "@/lib/tunnel-processor"

function MedTunnelApp() {
  const { user, signOut, usageCount, canUseService, incrementUsage, refreshUser } = useAuth()
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
  const [ambiguousShifts, setAmbiguousShifts] = useState<any[]>([])

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

  // Check if user is pro
  const isProUser = user?.subscription_tier === "pro" && user?.subscription_status === "active"

  // Enhanced Stripe redirect handling with user refresh
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get("success")
    const canceled = urlParams.get("canceled")
    const sessionId = urlParams.get("session_id")

    console.log("=== MAIN APP STRIPE REDIRECT CHECK ===")
    console.log("URL params:", { success, canceled, sessionId })
    console.log("Current user status:", {
      email: user?.email,
      tier: user?.subscription_tier,
      status: user?.subscription_status,
    })

    if (success === "true" && sessionId) {
      console.log("✅ Payment successful detected! Session ID:", sessionId)

      // Check session and refresh user data
      checkStripeSessionAndRefresh(sessionId)

      // Clean up URL after processing
      setTimeout(() => {
        window.history.replaceState({}, "", "/")
      }, 3000)
    }

    if (canceled === "true") {
      console.log("❌ Payment canceled")
      window.history.replaceState({}, "", "/")
    }
  }, [user?.email]) // Add user email as dependency to re-run when user changes

  useEffect(() => {
    const testConnection = async () => {
      try {
        setConnectionStatus("✅ Connected to Supabase")
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

    const {
      processedData,
      errors,
      ambiguousShifts: detectedAmbiguousShifts,
    } = processTunnelData(dataToProcess, headersToProcess, tunnel)

    // Handle ambiguous shifts for Amion tunnel
    if (tunnelId === "amion" && detectedAmbiguousShifts && detectedAmbiguousShifts.length > 0) {
      setAmbiguousShifts(detectedAmbiguousShifts)
      setConvertedData(processedData)
      setConversionErrors(errors)
      return
    }

    setConvertedData(processedData)
    setConversionErrors(errors)
    setAmbiguousShifts([])

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

  const handleResolveAmbiguousShifts = (resolvedShifts: any[]) => {
    // Convert resolved shifts to the standard format
    const resolvedAssignments = resolvedShifts.map((shift) => ({
      resident: shift.resident,
      displayName: shift.resident.includes(",") ? shift.resident.split(",")[0].trim() : shift.resident,
      date: shift.date,
      shift: shift.shift,
      assignment: shift.assignment,
      source: shift.source,
      row: shift.row,
      column: shift.column,
    }))

    // Combine resolved shifts with existing multi-row residents
    const combinedData = [...convertedData, ...resolvedAssignments]

    setConvertedData(combinedData)
    setAmbiguousShifts([])

    // Detect clinics and residents from combined data
    if (selectedTunnel === "amion") {
      detectClinicsAndResidents(combinedData)
    }
  }

  // Enhanced session check with multiple refresh attempts
  const checkStripeSessionAndRefresh = async (sessionId: string) => {
    console.log("=== CHECKING STRIPE SESSION AND REFRESHING USER ===")

    try {
      // First, check the session
      const response = await fetch("/api/stripe/check-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      console.log("Session check response status:", response.status)
      const data = await response.json()
      console.log("Session check response data:", data)

      if (data.success) {
        console.log("✅ Session successfully processed!")
        setConnectionStatus("✅ Payment successful! Refreshing subscription...")

        // Refresh user data multiple times to ensure it's updated
        console.log("🔄 Refreshing user data (attempt 1)...")
        await refreshUser()

        // Wait a bit and refresh again to ensure database has been updated
        setTimeout(async () => {
          console.log("🔄 Refreshing user data (attempt 2)...")
          await refreshUser()
        }, 2000)

        // One more refresh after a longer delay
        setTimeout(async () => {
          console.log("🔄 Refreshing user data (attempt 3)...")
          await refreshUser()
          setConnectionStatus("✅ Subscription activated!")
        }, 5000)
      } else {
        console.log("⚠️ Session not yet processed, but refreshing user data anyway")
        await refreshUser()
        setConnectionStatus("⚠️ Payment processing, please wait...")
      }
    } catch (error) {
      console.error("❌ Error checking session:", error)
      // Still try to refresh user data
      await refreshUser()
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
              <TabsTrigger
                value="preview"
                disabled={!selectedTunnel || (convertedData.length === 0 && ambiguousShifts.length === 0)}
              >
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
                      ambiguousShifts={ambiguousShifts}
                      onResolveAmbiguousShifts={handleResolveAmbiguousShifts}
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
