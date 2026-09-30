"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Radio, Plus, ArrowRight, Trash2 } from "lucide-react"
import { apiRequest } from "@/lib/api"

type ChannelItem = {
  id: string
  name: string
  description?: string | null
  status: string
  waNumber?: string | null
  createdAt?: string | null
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

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Request failed"
}

export default function ChannelsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadChannels() {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await apiRequest<ChannelsResponse>("/api/channels")
      setChannels(Array.isArray(payload.channels) ? payload.channels : [])
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await apiRequest(`/api/channels/${id}`, { method: "DELETE" })
      setChannels((current) => current.filter((c) => c.id !== id))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Channels</h1>
          <p className="text-muted-foreground">WhatsApp numbers linked to this account</p>
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
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-3 py-12 text-muted-foreground">
          <Spinner />
          Loading channels...
        </div>
      ) : channels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Radio className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No channels yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Create a channel, scan a QR code, and get an API key for that WhatsApp number.
            </p>
            <Button asChild>
              <Link href="/dashboard/channels/new">Create Your First Channel</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => (
            <Card key={channel.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <Link
                  href={`/dashboard/channels/${channel.id}`}
                  className="flex flex-1 items-center gap-4 min-w-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Radio className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{channel.name}</span>
                      {getStatusBadge(channel.status)}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {channel.waNumber || channel.description || "Not linked yet"}
                    </div>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/channels/${channel.id}`}>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete &ldquo;{channel.name}&rdquo;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This unlinks the WhatsApp number, revokes its API keys, and stops delivering webhooks.
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(channel.id)}
                            disabled={deletingId === channel.id}
                          >
                            {deletingId === channel.id ? "Deleting..." : "Delete"}
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
