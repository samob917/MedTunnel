"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"

interface FieldMapping {
  id: string
  sourceField: string
  targetField: string
  transformation: string
  required: boolean
}

export function TunnelConfig() {
  const [mappings, setMappings] = useState<FieldMapping[]>([
    {
      id: "1",
      sourceField: "id",
      targetField: "patient_id",
      transformation: "prefix_P",
      required: true,
    },
  ])

  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: Date.now().toString(),
      sourceField: "",
      targetField: "",
      transformation: "direct",
      required: false,
    }
    setMappings([...mappings, newMapping])
  }

  const removeMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id))
  }

  const updateMapping = (id: string, field: keyof FieldMapping, value: any) => {
    setMappings(mappings.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Field Mapping Configuration</CardTitle>
          <CardDescription>Configure how fields from your source file map to the target format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.map((mapping) => (
            <div key={mapping.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Field Mapping</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMapping(mapping.id)}
                  disabled={mappings.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`source-${mapping.id}`}>Source Field</Label>
                  <Input
                    id={`source-${mapping.id}`}
                    value={mapping.sourceField}
                    onChange={(e) => updateMapping(mapping.id, "sourceField", e.target.value)}
                    placeholder="e.g., id, name, email"
                  />
                </div>

                <div>
                  <Label htmlFor={`target-${mapping.id}`}>Target Field</Label>
                  <Input
                    id={`target-${mapping.id}`}
                    value={mapping.targetField}
                    onChange={(e) => updateMapping(mapping.id, "targetField", e.target.value)}
                    placeholder="e.g., patient_id, full_name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`transform-${mapping.id}`}>Transformation</Label>
                  <Select
                    value={mapping.transformation}
                    onValueChange={(value) => updateMapping(mapping.id, "transformation", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct Copy</SelectItem>
                      <SelectItem value="uppercase">Convert to Uppercase</SelectItem>
                      <SelectItem value="lowercase">Convert to Lowercase</SelectItem>
                      <SelectItem value="prefix_P">Add "P" Prefix</SelectItem>
                      <SelectItem value="date_format">Format Date</SelectItem>
                      <SelectItem value="custom">Custom Function</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id={`required-${mapping.id}`}
                    checked={mapping.required}
                    onCheckedChange={(checked) => updateMapping(mapping.id, "required", checked)}
                  />
                  <Label htmlFor={`required-${mapping.id}`}>Required Field</Label>
                </div>
              </div>
            </div>
          ))}

          <Button onClick={addMapping} variant="outline" className="w-full bg-transparent">
            <Plus className="w-4 h-4 mr-2" />
            Add Field Mapping
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validation Rules</CardTitle>
          <CardDescription>Set up data validation rules for your conversion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="validation-rules">Custom Validation Rules</Label>
            <Textarea id="validation-rules" placeholder="Enter custom validation rules (optional)" className="mt-1" />
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="skip-empty" />
            <Label htmlFor="skip-empty">Skip empty rows</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="validate-emails" />
            <Label htmlFor="validate-emails">Validate email formats</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button size="lg">Save Configuration & Preview</Button>
      </div>
    </div>
  )
}
