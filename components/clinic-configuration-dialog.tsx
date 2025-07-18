import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, Save, Upload, Trash2, Plus, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

export interface AmionConfiguration {
  id?: string
  name: string
  clinicMappings: Record<string, string>  // Original clinic -> Output sheet name
  residentMappings: Record<string, string> // Original resident -> Display name
  mergedClinics: Record<string, string[]>  // Output sheet -> [Original clinics]
}

interface ClinicConfigurationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detectedClinics: string[]
  detectedResidents: string[]
  onSave: (config: AmionConfiguration) => void
  currentConfig?: AmionConfiguration
  userEmail?: string
}

export function ClinicConfigurationDialog({
  open,
  onOpenChange,
  detectedClinics,
  detectedResidents,
  onSave,
  currentConfig,
  userEmail
}: ClinicConfigurationDialogProps) {
  const [activeTab, setActiveTab] = useState("clinics")
  const [configName, setConfigName] = useState(currentConfig?.name || "")
  const [clinicMappings, setClinicMappings] = useState<Record<string, string>>(currentConfig?.clinicMappings || {})
  const [residentMappings, setResidentMappings] = useState<Record<string, string>>(currentConfig?.residentMappings || {})
  const [mergedClinics, setMergedClinics] = useState<Record<string, string[]>>(currentConfig?.mergedClinics || {})
  const [savedConfigs, setSavedConfigs] = useState<AmionConfiguration[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<string>("")
  
  // New merge UI state
  const [newMergeName, setNewMergeName] = useState("")
  const [selectedClinicsForMerge, setSelectedClinicsForMerge] = useState<string[]>([])

  useEffect(() => {
    if (userEmail) {
      loadSavedConfigs()
    }
  }, [userEmail])

  const loadSavedConfigs = async () => {
    if (!userEmail) return
    
    const { data, error } = await supabase
      .from('amion_configurations')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
    
    if (data) {
      setSavedConfigs(data)
    }
  }

  const handleSaveConfiguration = async () => {
    const config: AmionConfiguration = {
      name: configName || `Configuration ${new Date().toLocaleDateString()}`,
      clinicMappings,
      residentMappings,
      mergedClinics
    }
    
    if (userEmail && configName) {
      // Save to database
      const { data, error } = await supabase
        .from('amion_configurations')
        .upsert({
          id: currentConfig?.id,
          user_email: userEmail,
          name: configName,
          clinic_mappings: clinicMappings,
          resident_mappings: residentMappings,
          merged_clinics: mergedClinics,
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (data) {
        config.id = data.id
        await loadSavedConfigs()
      }
    }
    
    onSave(config)
    onOpenChange(false)
  }

  const handleLoadConfiguration = async (configId: string) => {
    const config = savedConfigs.find(c => c.id === configId)
    if (config) {
      setConfigName(config.name)
      setClinicMappings(config.clinicMappings || {})
      setResidentMappings(config.residentMappings || {})
      setMergedClinics(config.mergedClinics || {})
      setSelectedConfigId(configId)
    }
  }

  const handleDeleteConfiguration = async (configId: string) => {
    await supabase
      .from('amion_configurations')
      .delete()
      .eq('id', configId)
    
    await loadSavedConfigs()
    if (selectedConfigId === configId) {
      setSelectedConfigId("")
    }
  }

  const handleCreateMerge = () => {
    if (newMergeName && selectedClinicsForMerge.length > 0) {
      setMergedClinics({
        ...mergedClinics,
        [newMergeName]: selectedClinicsForMerge
      })
      
      // Update clinic mappings for merged clinics
      const updatedMappings = { ...clinicMappings }
      selectedClinicsForMerge.forEach(clinic => {
        updatedMappings[clinic] = newMergeName
      })
      setClinicMappings(updatedMappings)
      
      // Reset merge UI
      setNewMergeName("")
      setSelectedClinicsForMerge([])
    }
  }

  const handleRemoveMerge = (mergeName: string) => {
    const { [mergeName]: removed, ...rest } = mergedClinics
    setMergedClinics(rest)
    
    // Reset clinic mappings for unmerged clinics
    const updatedMappings = { ...clinicMappings }
    removed?.forEach(clinic => {
      delete updatedMappings[clinic]
    })
    setClinicMappings(updatedMappings)
  }

  // Get unique residents from the detected list
  const uniqueResidents = Array.from(new Set(detectedResidents)).sort()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Amion Export</DialogTitle>
          <DialogDescription>
            Customize clinic and resident names, merge clinics, and save configurations for future use.
          </DialogDescription>
        </DialogHeader>

        {/* Configuration Name and Load/Save */}
        <div className="space-y-4 border-b pb-4">
          <div className="flex gap-2">
            <Input
              placeholder="Configuration name"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              className="flex-1"
            />
            {userEmail && (
              <>
                <Select value={selectedConfigId} onValueChange={handleLoadConfiguration}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Load saved config" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedConfigs.map(config => (
                      <SelectItem key={config.id} value={config.id!}>
                        <div className="flex items-center justify-between w-full">
                          <span>{config.name}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteConfiguration(config.id!)
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clinics" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Clinics
            </TabsTrigger>
            <TabsTrigger value="merge" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Merge Clinics
            </TabsTrigger>
            <TabsTrigger value="residents" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Residents
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Clinics Tab */}
            <TabsContent value="clinics" className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                {detectedClinics.map((clinic) => (
                  <div key={clinic} className="flex items-center gap-2">
                    <Label className="w-1/2 text-sm truncate" title={clinic}>
                      {clinic}
                    </Label>
                    <Input
                      type="text"
                      placeholder={clinic}
                      value={clinicMappings[clinic] || ""}
                      onChange={(e) => {
                        setClinicMappings({
                          ...clinicMappings,
                          [clinic]: e.target.value
                        })
                      }}
                      className="w-1/2"
                      disabled={Object.values(mergedClinics).some(clinics => clinics.includes(clinic))}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Merge Clinics Tab */}
            <TabsContent value="merge" className="space-y-4 p-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Create New Merge</CardTitle>
                  <CardDescription>
                    Combine multiple clinics into a single sheet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Merged sheet name"
                    value={newMergeName}
                    onChange={(e) => setNewMergeName(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {detectedClinics
                      .filter(clinic => !Object.values(mergedClinics).flat().includes(clinic))
                      .map(clinic => (
                        <Badge
                          key={clinic}
                          variant={selectedClinicsForMerge.includes(clinic) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            if (selectedClinicsForMerge.includes(clinic)) {
                              setSelectedClinicsForMerge(selectedClinicsForMerge.filter(c => c !== clinic))
                            } else {
                              setSelectedClinicsForMerge([...selectedClinicsForMerge, clinic])
                            }
                          }}
                        >
                          {clinic}
                        </Badge>
                      ))}
                  </div>
                  <Button 
                    onClick={handleCreateMerge}
                    disabled={!newMergeName || selectedClinicsForMerge.length === 0}
                    className="w-full"
                  >
                    Create Merge
                  </Button>
                </CardContent>
              </Card>

              {/* Existing Merges */}
              <div className="space-y-2">
                {Object.entries(mergedClinics).map(([mergeName, clinics]) => (
                  <Card key={mergeName}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{mergeName}</CardTitle>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMerge(mergeName)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {clinics.map(clinic => (
                          <Badge key={clinic} variant="secondary" className="text-xs">
                            {clinic}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Residents Tab */}
            <TabsContent value="residents" className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                {uniqueResidents.map((resident) => {
                  let displayName = resident
                  
                  // Create a map of last names to full names (similar to addDisplayNames logic)
                  const lastNameMap: Record<string, string[]> = {}
                  uniqueResidents.forEach(r => {
                    if (r.includes(",")) {
                      const lastName = r.split(",")[0].trim()
                      if (!lastNameMap[lastName]) {
                        lastNameMap[lastName] = []
                      }
                      lastNameMap[lastName].push(r)
                    }
                  })
                  
                  // Determine display name based on duplicates
                  if (resident.includes(",")) {
                    const parts = resident.split(",")
                    const lastName = parts[0].trim()
                    const firstName = parts[1] ? parts[1].trim() : ""
                    
                    // Check if there are multiple people with this last name
                    if (lastNameMap[lastName] && lastNameMap[lastName].length > 1) {
                      // Multiple people with same last name - add first initial
                      displayName = firstName ? `${lastName}-${firstName.charAt(0).toUpperCase()}` : lastName
                    } else {
                      // Only one person with this last name
                      displayName = lastName
                    }
                  }
                  
                  return (
                    <div key={resident} className="flex items-center gap-2">
                      <Label className="w-1/2 text-sm truncate" title={resident}>
                        {displayName}
                      </Label>
                      <Input
                        type="text"
                        placeholder={displayName}
                        value={residentMappings[resident] || ""}
                        onChange={(e) => {
                          setResidentMappings({
                            ...residentMappings,
                            [resident]: e.target.value
                          })
                        }}
                        className="w-1/2"
                      />
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveConfiguration} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save & Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}