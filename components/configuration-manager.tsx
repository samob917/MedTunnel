"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Save, Trash2, Star, Plus, Settings, Download, TestTube, RefreshCw } from "lucide-react"
import { useAuth } from "./auth-provider"
import { supabase } from "@/lib/supabase"

// Define the types to match your database structure
interface SavedAmionConfiguration {
  id: string
  user_id: string
  name: string
  description: string | null
  clinic_mappings: Record<string, string>
  resident_mappings: Record<string, string>
  merged_clinics: Record<string, string[]>
  is_default: boolean
  created_at: string
  updated_at: string
}

interface AmionConfiguration {
  name: string
  clinicMappings: Record<string, string>
  residentMappings: Record<string, string>
  mergedClinics: Record<string, string[]>
}

interface ConfigurationManagerProps {
  currentConfig: AmionConfiguration
  onConfigurationLoad: (config: AmionConfiguration) => void
  onConfigurationSave?: (config: AmionConfiguration) => void
}

export function ConfigurationManager({
  currentConfig,
  onConfigurationLoad,
  onConfigurationSave,
}: ConfigurationManagerProps) {
  const { user } = useAuth()
  const [configurations, setConfigurations] = useState<SavedAmionConfiguration[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveForm, setSaveForm] = useState({
    name: "",
    description: "",
    isDefault: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  // Load configurations on mount
  useEffect(() => {
    if (user?.id) {
      loadConfigurations()
    }
  }, [user?.id])

  // Improved auth headers function with better error handling
  const getAuthHeaders = async () => {
    try {
      console.log("Getting auth headers...")
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error("Session error:", error)
        throw new Error(`Session error: ${error.message}`)
      }

      if (!session) {
        console.error("No session found")
        throw new Error("No active session. Please sign in again.")
      }

      if (!session.access_token) {
        console.error("No access token in session")
        throw new Error("No access token found. Please sign in again.")
      }

      console.log("Session valid, user:", session.user?.email)

      return {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      }
    } catch (error) {
      console.error("Error in getAuthHeaders:", error)
      throw error
    }
  }

  const loadConfigurations = async () => {
    if (!user?.id) {
      console.log("No user ID, skipping load")
      return
    }

    console.log("=== LOADING CONFIGURATIONS START ===")
    console.log("User ID:", user.id)
    console.log("User email:", user.email)

    setLoading(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      console.log("Auth headers obtained successfully")

      const url = `/api/amion-configurations?userId=${encodeURIComponent(user.id)}`
      console.log("Fetching from URL:", url)

      const response = await fetch(url, {
        method: "GET",
        headers: headers,
        signal: AbortSignal.timeout(15000), // 15 second timeout
      })

      console.log("Response status:", response.status)
      console.log("Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Response not OK:", response.status, errorText)

        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }

        if (response.status === 401) {
          throw new Error("Authentication failed. Please sign in again.")
        } else if (response.status === 404) {
          throw new Error("User not found. Please sign in again.")
        } else {
          throw new Error(errorData.error || `Server error: ${response.status}`)
        }
      }

      const data = await response.json()
      console.log("Response data:", data)

      if (!data.configurations) {
        console.warn("No configurations field in response")
        setConfigurations([])
      } else {
        console.log("Loaded configurations:", data.configurations.length)
        setConfigurations(data.configurations)
      }
    } catch (err) {
      console.error("=== LOAD CONFIGURATIONS ERROR ===")
      console.error("Error type:", err?.constructor?.name)
      console.error("Error message:", err instanceof Error ? err.message : String(err))
      console.error("Full error:", err)

      if (err instanceof Error && err.name === "TimeoutError") {
        setError("Request timed out. Please check your connection and try again.")
      } else if (err instanceof Error && err.message.includes("sign in")) {
        setError("Please sign in again to load your configurations.")
      } else {
        setError(err instanceof Error ? err.message : "Failed to load configurations")
      }
    } finally {
      setLoading(false)
      console.log("=== LOADING CONFIGURATIONS END ===")
    }
  }

  const testSave = async () => {
    if (!user?.id) return

    setTesting(true)
    setError(null)
    setTestResult(null)

    try {
      console.log("Testing save functionality...")
      const headers = await getAuthHeaders()

      const response = await fetch("/api/amion-configurations/test-save", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Test save failed:", data)
        setError(`Test failed: ${data.error} - ${data.details || ""}`)
        return
      }

      console.log("Test save successful:", data)
      setTestResult("✅ Test save successful! Database connection and RLS working.")
    } catch (err) {
      console.error("Test save error:", err)
      setError(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTesting(false)
    }
  }

  const saveConfiguration = async () => {
    if (!user?.id || !saveForm.name.trim()) return

    setSaving(true)
    setError(null)

    try {
      console.log("Saving configuration:", {
        userId: user.id,
        name: saveForm.name.trim(),
        description: saveForm.description.trim() || null,
        clinicMappings: currentConfig.clinicMappings,
        residentMappings: currentConfig.residentMappings,
        mergedClinics: currentConfig.mergedClinics,
        isDefault: saveForm.isDefault,
      })

      const headers = await getAuthHeaders()
      const response = await fetch("/api/amion-configurations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: user.id,
          name: saveForm.name.trim(),
          description: saveForm.description.trim() || null,
          clinicMappings: currentConfig.clinicMappings,
          residentMappings: currentConfig.residentMappings,
          mergedClinics: currentConfig.mergedClinics,
          isDefault: saveForm.isDefault,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Save response error:", data)
        throw new Error(data.error || "Failed to save configuration")
      }

      console.log("Configuration saved successfully:", data)

      // Refresh configurations list
      await loadConfigurations()

      // Reset form and close dialog
      setSaveForm({ name: "", description: "", isDefault: false })
      setShowSaveDialog(false)

      // Call callback if provided
      if (onConfigurationSave) {
        onConfigurationSave(currentConfig)
      }
    } catch (err) {
      console.error("Error saving configuration:", err)
      setError(err instanceof Error ? err.message : "Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  // Load configuration with correct data structure
  const loadConfiguration = (config: SavedAmionConfiguration) => {
    const amionConfig: AmionConfiguration = {
      name: config.name,
      clinicMappings: config.clinic_mappings || {},
      residentMappings: config.resident_mappings || {},
      mergedClinics: config.merged_clinics || {},
    }
    onConfigurationLoad(amionConfig)
  }

  const deleteConfiguration = async (configId: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`/api/amion-configurations/${configId}`, {
        method: "DELETE",
        headers,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to delete configuration")
      }

      // Refresh configurations list
      await loadConfigurations()
    } catch (err) {
      console.error("Error deleting configuration:", err)
      setError(err instanceof Error ? err.message : "Failed to delete configuration")
    }
  }

  const setAsDefault = async (configId: string) => {
    if (!user?.id) return

    try {
      const config = configurations.find((c) => c.id === configId)
      if (!config) return

      const headers = await getAuthHeaders()
      const response = await fetch(`/api/amion-configurations/${configId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name: config.name,
          description: config.description,
          clinicMappings: config.clinic_mappings,
          residentMappings: config.resident_mappings,
          mergedClinics: config.merged_clinics,
          isDefault: true,
          userId: user.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to set as default")
      }

      // Refresh configurations list
      await loadConfigurations()
    } catch (err) {
      console.error("Error setting default:", err)
      setError(err instanceof Error ? err.message : "Failed to set as default")
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">Sign in to save and load configurations</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {testResult && (
        <Alert>
          <AlertDescription>{testResult}</AlertDescription>
        </Alert>
      )}

      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Saved Configurations
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={testSave}
            disabled={testing}
            className="flex items-center gap-2 bg-transparent"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            <TestTube className="w-4 h-4" />
            Test Save
          </Button>
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Save Current
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Configuration</DialogTitle>
                <DialogDescription>Save your current clinic and resident mappings for future use.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Configuration Name</label>
                  <Input
                    value={saveForm.name}
                    onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
                    placeholder="e.g., General Surgery 2024"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Textarea
                    value={saveForm.description}
                    onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
                    placeholder="Brief description of this configuration..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={saveForm.isDefault}
                    onChange={(e) => setSaveForm({ ...saveForm, isDefault: e.target.checked })}
                  />
                  <label htmlFor="isDefault" className="text-sm">
                    Set as default configuration
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveConfiguration} disabled={saving || !saveForm.name.trim()}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Configurations List */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading configurations...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <Button
                onClick={loadConfigurations}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 bg-transparent"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          ) : configurations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No saved configurations yet</p>
              <p className="text-sm text-gray-400">
                Configure your clinic and resident mappings, then save them for future use.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {configurations.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{config.name}</h4>
                      {config.is_default && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {config.description && <p className="text-sm text-gray-600 mb-2">{config.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Updated {formatDate(config.updated_at)}</span>
                      <span>{Object.keys(config.clinic_mappings || {}).length} clinic mappings</span>
                      <span>{Object.keys(config.resident_mappings || {}).length} resident mappings</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadConfiguration(config)}
                      className="flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Load
                    </Button>
                    {!config.is_default && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAsDefault(config.id)}
                        className="flex items-center gap-1"
                      >
                        <Star className="w-3 h-3" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteConfiguration(config.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
