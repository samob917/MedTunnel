"use client"
import { Settings, FileText, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAllTunnels } from "@/lib/tunnel-processor"

interface TunnelSelectorProps {
  onTunnelSelect: (tunnelId: string) => void
  selectedTunnel: string
}

const tunnelIcons: Record<string, any> = {
  "medical-records": FileText,
  "financial-data": DollarSign,
}

export function TunnelSelector({ onTunnelSelect, selectedTunnel }: TunnelSelectorProps) {
  const tunnels = getAllTunnels()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tunnels.map((tunnel) => {
          const Icon = tunnelIcons[tunnel.id] || Settings
          const isSelected = selectedTunnel === tunnel.id

          return (
            <Card
              key={tunnel.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? "ring-2 ring-blue-500 bg-blue-50" : ""
              }`}
              onClick={() => onTunnelSelect(tunnel.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? "bg-blue-100" : "bg-gray-100"}`}>
                      <Icon className={`w-5 h-5 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{tunnel.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        v{tunnel.version}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-3">{tunnel.description}</CardDescription>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs">
                    {tunnel.fieldMappings.length} field mappings
                  </Badge>
                  {tunnel.validation && (
                    <Badge variant="outline" className="text-xs">
                      Validation included
                    </Badge>
                  )}
                  {tunnel.postProcess && (
                    <Badge variant="outline" className="text-xs">
                      Post-processing
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedTunnel && (
        <div className="flex justify-center pt-4">
          <Button onClick={() => onTunnelSelect(selectedTunnel)}>Process with Selected Tunnel</Button>
        </div>
      )}
    </div>
  )
}
