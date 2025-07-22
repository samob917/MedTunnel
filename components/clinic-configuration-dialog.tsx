"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConfigurationManager } from "./configuration-manager"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Users, Building, Check } from "lucide-react"

export interface AmionConfiguration {
  name: string
  clinicMappings: Record<string, string>
  residentMappings: Record<string, string>
  mergedClinics: Record<string, string[]>
}

interface ClinicConfigurationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detectedClinics: string[]
  detectedResidents: string[]
  onSave: (config: AmionConfiguration) => void
  currentConfig: AmionConfiguration
  userEmail?: string
}

export function ClinicConfigurationDialog({
  open,
  onOpenChange,
  detectedClinics,
  detectedResidents,
  onSave,
  currentConfig,
  userEmail,
}: ClinicConfigurationDialogProps) {
  const [config, setConfig] = useState<AmionConfiguration>(currentConfig)
  const [newClinicName, setNewClinicName] = useState("")
  const [selectedClinicsForMerge, setSelectedClinicsForMerge] = useState<string[]>([])
  const [mergeGroupName, setMergeGroupName] = useState("")

  // Update local config when currentConfig changes
  useEffect(() => {
    setConfig(currentConfig)
  }, [currentConfig])

  const handleClinicMappingChange = (originalName: string, displayName: string) => {
    console.log("Clinic mapping changed:", originalName, "->", displayName)
    setConfig((prev) => ({
      ...prev,
      clinicMappings: {
        ...prev.clinicMappings,
        [originalName]: displayName,
      },
    }))
  }

  const handleResidentMappingChange = (originalName: string, displayName: string) => {
    setConfig((prev) => ({
      ...prev,
      residentMappings: {
        ...prev.residentMappings,
        [originalName]: displayName,
      },
    }))
  }

  const handleMergeClinic = () => {
    if (!mergeGroupName.trim() || selectedClinicsForMerge.length < 2) return

    setConfig((prev) => ({
      ...prev,
      mergedClinics: {
        ...prev.mergedClinics,
        [mergeGroupName.trim()]: selectedClinicsForMerge,
      },
    }))

    setMergeGroupName("")
    setSelectedClinicsForMerge([])
  }

  const handleRemoveMergeGroup = (groupName: string) => {
    setConfig((prev) => {
      const newMergedClinics = { ...prev.mergedClinics }
      delete newMergedClinics[groupName]
      return {
        ...prev,
        mergedClinics: newMergedClinics,
      }
    })
  }

  const handleApplyChanges = () => {
    console.log("Apply changes clicked, current config:", config)
    onSave(config)
    onOpenChange(false)
  }

  const handleConfigurationLoad = (loadedConfig: AmionConfiguration) => {
    setConfig(loadedConfig)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Clinic & Resident Names</DialogTitle>
          <DialogDescription>
            Customize how clinic and resident names appear in your exported files, and save configurations for future
            use.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="clinics" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clinics">
              <Building className="w-4 h-4 mr-2" />
              Clinics
            </TabsTrigger>
            <TabsTrigger value="residents">
              <Users className="w-4 h-4 mr-2" />
              Residents
            </TabsTrigger>
            <TabsTrigger value="merge">Merge Clinics</TabsTrigger>
            <TabsTrigger value="saved">Saved Configs</TabsTrigger>
          </TabsList>

          <TabsContent value="clinics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Clinic Name Mappings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {detectedClinics.map((clinic) => (
                  <div key={clinic} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700">{clinic}</label>
                    </div>
                    <div className="flex-1">
                      <Input
                        value={config.clinicMappings[clinic] || clinic}
                        onChange={(e) => handleClinicMappingChange(clinic, e.target.value)}
                        placeholder="Display name"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="residents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resident Name Mappings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {detectedResidents.map((resident) => (
                  <div key={resident} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-gray-700">{resident}</label>
                    </div>
                    <div className="flex-1">
                      <Input
                        value={config.residentMappings[resident] || resident}
                        onChange={(e) => handleResidentMappingChange(resident, e.target.value)}
                        placeholder="Display name"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="merge" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Merge Clinics</CardTitle>
                <p className="text-sm text-gray-600">Combine multiple clinics into a single Excel sheet</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Input
                    value={mergeGroupName}
                    onChange={(e) => setMergeGroupName(e.target.value)}
                    placeholder="Merged group name (e.g., 'Combined Surgery')"
                  />
                  <Select
                    value=""
                    onValueChange={(clinic) => {
                      if (!selectedClinicsForMerge.includes(clinic)) {
                        setSelectedClinicsForMerge([...selectedClinicsForMerge, clinic])
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select clinics to merge" />
                    </SelectTrigger>
                    <SelectContent>
                      {detectedClinics
                        .filter((clinic) => !selectedClinicsForMerge.includes(clinic))
                        .map((clinic) => (
                          <SelectItem key={clinic} value={clinic}>
                            {clinic}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  {selectedClinicsForMerge.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedClinicsForMerge.map((clinic) => (
                        <Badge key={clinic} variant="secondary" className="flex items-center gap-1">
                          {clinic}
                          <button
                            onClick={() =>
                              setSelectedClinicsForMerge(selectedClinicsForMerge.filter((c) => c !== clinic))
                            }
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleMergeClinic}
                    disabled={!mergeGroupName.trim() || selectedClinicsForMerge.length < 2}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Merge Group
                  </Button>
                </div>

                {Object.keys(config.mergedClinics).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Current Merge Groups:</h4>
                    {Object.entries(config.mergedClinics).map(([groupName, clinics]) => (
                      <div key={groupName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="font-medium">{groupName}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {clinics.map((clinic) => (
                              <Badge key={clinic} variant="outline" className="text-xs">
                                {clinic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMergeGroup(groupName)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="space-y-4">
            <ConfigurationManager
              currentConfig={config}
              onConfigurationLoad={handleConfigurationLoad}
              onConfigurationSave={(savedConfig) => {
                // Configuration was saved successfully
                console.log("Configuration saved:", savedConfig)
              }}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApplyChanges} className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            Apply Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
