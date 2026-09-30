"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Radio, Plus, ArrowRight, Wifi, QrCode } from "lucide-react"
import { apiRequest, getStoredUser } from "@/lib/api"

type ChannelItem = {
  id: string
  name: string
  status: string
  waNumber?: string | null
}

type ChannelsResponse = {
  success: boolean
  channels: ChannelItem[]
}

function getStatusBadge(status: string) {
  switch (status) {
    case "linked":
      return <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Linked</Badge>
    case "linking":
      return <Badge variant="outline">Linking</Badge>
    case "disconnected":
      return <Badge className="bg-chart-3/10 text-chart-3 hover:bg-chart-3/20">Disconnected</Badge>
    case "conflict":
      return <Badge variant="destructive">Conflict</Badge>
    default:
      return <Badge variant="secondary">Unlinked</Badge>
  }
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [displayName, setDisplayName] = useState("there")

  useEffect(() => {
    const user = getStoredUser()
    if (user?.name) {
      setDisplayName(user.name)
    }

    let mounted = true

    async function loadDashboard() {
      setIsLoading(true)
      setError(null)

      try {
        const payload = await apiRequest<ChannelsResponse>("/api/channels")
        if (!mounted) return
        setChannels(Array.isArray(payload.channels) ? payload.channels : [])
      } catch (loadError) {
        if (!mounted) return
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard")
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadDashboard()
    return () => {
      mounted = false
    }
  }, [])

  const summary = useMemo(() => {
    return {
      total: channels.length,
      linked: channels.filter((c) => c.status === "linked").length,
      linking: channels.filter((c) => c.status === "linking").length,
      needsAttention: channels.filter((c) => c.status === "disconnected" || c.status === "conflict").length,
    }
  }, [channels])

  const stats = [
    { label: "Channels", value: String(summary.total), icon: Radio },
    { label: "Linked", value: String(summary.linked), icon: Wifi },
    { label: "Awaiting Scan", value: String(summary.linking), icon: QrCode },
    { label: "Needs Attention", value: String(summary.needsAttention), icon: Radio },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {displayName}!</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard/channels/new">
            <Plus className="h-4 w-4" />
            New Channel
          </Link>
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Channels</CardTitle>
              <CardDescription>WhatsApp numbers linked to this account</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/channels" className="gap-1">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-3 py-8 text-muted-foreground">
              <Spinner />
              Loading channels...
            </div>
          ) : channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Radio className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="mb-2 text-lg font-medium text-foreground">No channels yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create a channel, scan a QR code, and get an API key for that WhatsApp number.
              </p>
              <Button asChild>
                <Link href="/dashboard/channels/new">Create Your First Channel</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {channels.slice(0, 5).map((channel) => (
                <Link
                  key={channel.id}
                  href={`/dashboard/channels/${channel.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Radio className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{channel.name}</span>
                        {getStatusBadge(channel.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">{channel.waNumber || "Not linked yet"}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
