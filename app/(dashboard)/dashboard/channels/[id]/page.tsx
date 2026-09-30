"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Copy,
  Check,
  Key,
  Webhook as WebhookIcon,
  Activity,
  QrCode,
  RefreshCw,
  Unlink,
  Trash2,
  AlertTriangle,
  TerminalSquare,
} from "lucide-react"
import { apiRequest, getAccessToken } from "@/lib/api"

type Channel = {
  id: string
  name: string
  description?: string | null
  status: string
  waNumber?: string | null
  linkedAt?: string | null
  lastConnectedAt?: string | null
  lastDisconnectedAt?: string | null
  createdAt?: string | null
  session: {
    qrPayload?: string | null
    qrGeneratedAt?: string | null
    connectedAt?: string | null
    lastActive?: string | null
  }
}

type ApiKey = {
  id: string
  name?: string | null
  keyPrefix: string
  expiresAt: string
  isExpired: boolean
  isRevoked: boolean
  lastUsedAt?: string | null
  createdAt: string
  apiKey?: string
}

type WebhookConfig = {
  id: string
  url: string
  isActive: boolean
  replyMode: "sync" | "none"
  secret?: string
}

type WebhookDelivery = {
  id: string
  inboundMessageId: string
  url: string
  status: "pending" | "delivered" | "failed" | "dead_letter"
  attemptCount: number
  nextAttemptAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

type InboundMessage = {
  id: string
  contactJid: string
  messageType: string
  content?: string | null
  receivedAt: string
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Request failed"
}

function statusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case "linked":
      return { label: "Linked", className: "bg-primary/10 text-primary hover:bg-primary/20" }
    case "linking":
      return { label: "Linking", className: "" }
    case "disconnected":
      return { label: "Disconnected — reconnecting", className: "bg-chart-3/10 text-chart-3 hover:bg-chart-3/20" }
    case "conflict":
      return { label: "Conflict — another device took over", className: "" }
    default:
      return { label: "Unlinked", className: "" }
  }
}

function deliveryStatusMeta(status: string): { label: string; className: string } {
  switch (status) {
    case "delivered":
      return { label: "Delivered", className: "border-primary/30 bg-primary/10 text-primary" }
    case "pending":
      return { label: "Retrying", className: "border-chart-3/30 bg-chart-3/10 text-chart-3" }
    case "dead_letter":
      return { label: "Gave up", className: "border-destructive/30 bg-destructive/10 text-destructive" }
    default:
      return { label: "Failed", className: "border-destructive/30 bg-destructive/10 text-destructive" }
  }
}

function buildWebSocketUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3444"
  const wsBase = base.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://").replace(/\/+$/, "")
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`
}

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3444"
  return `${base.replace(/\/+$/, "")}/api/v1`
}

function CodeSnippet({
  id,
  label,
  code,
  copiedId,
  onCopy,
}: {
  id: string
  label: string
  code: string
  copiedId: string | null
  onCopy: (code: string, id: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-secondary/30">
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onCopy(code, id)}
        >
          {copiedId === id ? (
            <>
              <Check className="h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  )
}

export default function ChannelDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const channelId = params.id

  const [channel, setChannel] = useState<Channel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyExpiry, setNewKeyExpiry] = useState("365")
  const [isCreatingKey, setIsCreatingKey] = useState(false)
  const [revealedKey, setRevealedKey] = useState<ApiKey | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [webhook, setWebhook] = useState<WebhookConfig | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [isSavingWebhook, setIsSavingWebhook] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [replyMode, setReplyMode] = useState<"sync" | "none">("sync")
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [redelivering, setRedelivering] = useState<string | null>(null)
  const [starterLang, setStarterLang] = useState<"node" | "python">("node")

  const [messages, setMessages] = useState<InboundMessage[]>([])

  const socketRef = useRef<WebSocket | null>(null)

  const loadChannel = useCallback(async () => {
    try {
      const payload = await apiRequest<{ success: boolean; channel: Channel }>(`/api/channels/${channelId}`)
      setChannel(payload.channel)
      return payload.channel
    } catch (err) {
      setError(errorMessage(err))
      return null
    }
  }, [channelId])

  const loadApiKeys = useCallback(async () => {
    try {
      const payload = await apiRequest<{ success: boolean; apiKeys: ApiKey[] }>(`/api/channels/${channelId}/api-keys`)
      setApiKeys(payload.apiKeys)
    } catch {
      // non-fatal — the main channel card is the important part
    }
  }, [channelId])

  const loadWebhook = useCallback(async () => {
    try {
      const payload = await apiRequest<{ success: boolean; webhook: WebhookConfig | null }>(
        `/api/channels/${channelId}/webhook`
      )
      setWebhook(payload.webhook)
      setWebhookUrl(payload.webhook?.url || "")
      setReplyMode(payload.webhook?.replyMode || "sync")
    } catch {
      // non-fatal
    }
  }, [channelId])

  const loadDeliveries = useCallback(async () => {
    try {
      const payload = await apiRequest<{ success: boolean; deliveries: WebhookDelivery[] }>(
        `/api/channels/${channelId}/webhook-deliveries?limit=20`
      )
      setDeliveries(payload.deliveries)
    } catch {
      // non-fatal
    }
  }, [channelId])

  const loadMessages = useCallback(async () => {
    try {
      const payload = await apiRequest<{ success: boolean; messages: InboundMessage[] }>(
        `/api/channels/${channelId}/messages/inbound?limit=20`
      )
      setMessages(payload.messages)
    } catch {
      // non-fatal
    }
  }, [channelId])

  useEffect(() => {
    let mounted = true
    async function load() {
      setIsLoading(true)
      await loadChannel()
      if (mounted) {
        await Promise.all([loadApiKeys(), loadWebhook(), loadMessages(), loadDeliveries()])
        setIsLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [loadChannel, loadApiKeys, loadWebhook, loadMessages, loadDeliveries])

  // Live status/QR updates over the same WebSocket the rest of the dashboard uses.
  useEffect(() => {
    const token = getAccessToken()
    if (!token || !channelId) return

    const socket = new WebSocket(buildWebSocketUrl(token))
    socketRef.current = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ action: "join_bot_room", botId: channelId }))
    }

    socket.onmessage = (event) => {
      let payload: { event?: string; data?: Record<string, unknown> } | null = null
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }
      const eventName = payload?.event
      const data = payload?.data || {}
      if (String(data.botId || "") !== channelId) return

      if (eventName === "status_update") {
        setChannel((current) =>
          current
            ? {
                ...current,
                status: typeof data.status === "string" ? data.status : current.status,
                waNumber: typeof data.waNumber === "string" ? data.waNumber : current.waNumber,
                session: {
                  ...current.session,
                  qrPayload: typeof data.qrPayload === "string" ? data.qrPayload : current.session.qrPayload,
                  qrGeneratedAt:
                    typeof data.qrGeneratedAt === "string" ? data.qrGeneratedAt : current.session.qrGeneratedAt,
                  connectedAt:
                    typeof data.connectedAt === "string" ? data.connectedAt : current.session.connectedAt,
                },
              }
            : current
        )
      } else if (eventName === "message_received") {
        loadMessages()
      }
    }

    return () => {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: "leave_bot_room", botId: channelId }))
        }
      } catch {
        // ignore
      }
      socket.close()
    }
  }, [channelId, loadMessages])

  async function handleStartLinking() {
    setIsLinking(true)
    setError(null)
    try {
      const payload = await apiRequest<{ success: boolean; channel: Channel }>(
        `/api/channels/${channelId}/link/start`,
        { method: "POST" }
      )
      setChannel(payload.channel)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsLinking(false)
    }
  }

  async function handleRelink() {
    setIsLinking(true)
    setError(null)
    try {
      const payload = await apiRequest<{ success: boolean; channel: Channel }>(`/api/channels/${channelId}/relink`, {
        method: "POST",
      })
      setChannel(payload.channel)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsLinking(false)
    }
  }

  async function handleUnlink() {
    setError(null)
    try {
      const payload = await apiRequest<{ success: boolean; channel: Channel }>(`/api/channels/${channelId}/unlink`, {
        method: "POST",
      })
      setChannel(payload.channel)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function handleDeleteChannel() {
    try {
      await apiRequest(`/api/channels/${channelId}`, { method: "DELETE" })
      router.push("/dashboard/channels")
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function handleCreateApiKey() {
    setIsCreatingKey(true)
    setError(null)
    try {
      const payload = await apiRequest<{ success: boolean; apiKey: ApiKey }>(`/api/channels/${channelId}/api-keys`, {
        method: "POST",
        body: JSON.stringify({
          name: newKeyName.trim() || null,
          expiresInDays: Number(newKeyExpiry) || 365,
        }),
      })
      setRevealedKey(payload.apiKey)
      setNewKeyName("")
      await loadApiKeys()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsCreatingKey(false)
    }
  }

  async function handleRevokeApiKey(keyId: string) {
    try {
      await apiRequest(`/api/channels/${channelId}/api-keys/${keyId}`, { method: "DELETE" })
      await loadApiKeys()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function handleSaveWebhook() {
    setIsSavingWebhook(true)
    setError(null)
    try {
      const payload = await apiRequest<{ success: boolean; webhook: WebhookConfig }>(
        `/api/channels/${channelId}/webhook`,
        { method: "PUT", body: JSON.stringify({ url: webhookUrl.trim(), replyMode }) }
      )
      setWebhook(payload.webhook)
      setReplyMode(payload.webhook.replyMode)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsSavingWebhook(false)
    }
  }

  async function handleRedeliver(deliveryId: string) {
    setRedelivering(deliveryId)
    try {
      await apiRequest(`/api/channels/${channelId}/webhook-deliveries/${deliveryId}/redeliver`, { method: "POST" })
      await loadDeliveries()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRedelivering(null)
    }
  }

  async function handleRotateSecret() {
    try {
      const payload = await apiRequest<{ success: boolean; webhook: WebhookConfig }>(
        `/api/channels/${channelId}/webhook/rotate-secret`,
        { method: "POST" }
      )
      setWebhook(payload.webhook)
      setRevealedSecret(payload.webhook.secret || null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function handleDeleteWebhook() {
    try {
      await apiRequest(`/api/channels/${channelId}/webhook`, { method: "DELETE" })
      setWebhook(null)
      setWebhookUrl("")
      setDeliveries([])
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  function copyToClipboard(value: string, id: string = "default") {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(id)
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000)
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 py-16 text-muted-foreground">
        <Spinner />
        Loading channel...
      </div>
    )
  }

  if (!channel) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="p-6 text-sm text-destructive">{error || "Channel not found"}</CardContent>
      </Card>
    )
  }

  const meta = statusMeta(channel.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/channels">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{channel.name}</h1>
            <Badge className={meta.className}>{meta.label}</Badge>
          </div>
          <p className="text-muted-foreground">{channel.waNumber || channel.description || "Not linked yet"}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this channel?</AlertDialogTitle>
              <AlertDialogDescription>
                This unlinks the WhatsApp number, revokes its API keys, and stops delivering webhooks. This cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant="destructive" onClick={handleDeleteChannel}>
                  Delete
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Linking panel */}
      {channel.status === "unlinked" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-medium text-foreground">Link a WhatsApp number</h3>
              <p className="text-sm text-muted-foreground">Scan a QR code with WhatsApp to connect this channel.</p>
            </div>
            <Button onClick={handleStartLinking} disabled={isLinking}>
              {isLinking ? <Spinner className="mr-2" /> : null}
              {isLinking ? "Starting..." : "Start Linking"}
            </Button>
          </CardContent>
        </Card>
      )}

      {channel.status === "linking" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            {channel.session.qrPayload ? (
              <img
                src={channel.session.qrPayload}
                alt="WhatsApp QR code"
                className="h-64 w-64 rounded-lg border border-border"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-dashed border-border">
                <Spinner />
              </div>
            )}
            <div>
              <h3 className="font-medium text-foreground">Scan with WhatsApp</h3>
              <p className="text-sm text-muted-foreground">
                Open WhatsApp → Linked Devices → Link a Device, and scan this code.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {channel.status === "conflict" && (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-4 py-6">
            <AlertTriangle className="h-8 w-8 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Another device took over this session</p>
              <p className="text-sm text-muted-foreground">
                WhatsApp Web (or another linked device) replaced this connection. Relink to reconnect.
              </p>
            </div>
            <Button onClick={handleRelink} disabled={isLinking}>
              {isLinking ? <Spinner className="mr-2" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Relink
            </Button>
          </CardContent>
        </Card>
      )}

      {channel.status === "disconnected" && (
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <Spinner />
            <div className="flex-1">
              <p className="font-medium text-foreground">Reconnecting...</p>
              <p className="text-sm text-muted-foreground">
                The connection dropped — the worker is retrying automatically. No action needed unless this
                persists.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleUnlink}>
              <Unlink className="mr-2 h-4 w-4" />
              Unlink
            </Button>
          </CardContent>
        </Card>
      )}

      {channel.status === "linked" && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Linked {channel.linkedAt ? new Date(channel.linkedAt).toLocaleString() : ""}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRelink} disabled={isLinking}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Relink to a different number
              </Button>
              <Button variant="outline" size="sm" onClick={handleUnlink}>
                <Unlink className="mr-2 h-4 w-4" />
                Unlink
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys / Webhook / Activity */}
      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="webhook" className="gap-2">
            <WebhookIcon className="h-4 w-4" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create an API key</CardTitle>
              <CardDescription>Used to send messages and check status via the public API.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="key-name">Name (optional)</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. production"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="key-expiry">Expires in (days)</Label>
                <Input
                  id="key-expiry"
                  type="number"
                  min={30}
                  max={730}
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleCreateApiKey} disabled={isCreatingKey}>
                {isCreatingKey ? <Spinner className="mr-2" /> : null}
                Create Key
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {apiKeys.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No API keys yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-foreground">{key.keyPrefix}...</span>
                          {key.name ? <span className="text-sm text-muted-foreground">({key.name})</span> : null}
                          {key.isRevoked ? (
                            <Badge variant="secondary">Revoked</Badge>
                          ) : key.isExpired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Active</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(key.expiresAt).toLocaleDateString()}
                          {key.lastUsedAt ? ` · Last used ${new Date(key.lastUsedAt).toLocaleString()}` : " · Never used"}
                        </p>
                      </div>
                      {!key.isRevoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevokeApiKey(key.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TerminalSquare className="h-5 w-5" />
                Using this API key
              </CardTitle>
              <CardDescription>
                Every request carries the key in an <code className="rounded bg-secondary/50 px-1 py-0.5 text-xs">X-API-Key</code> header.
                {apiKeys.some((k) => !k.isRevoked && !k.isExpired)
                  ? " Swap in one of your active keys below."
                  : " Create a key above, then swap it into these."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                <span className="text-xs font-medium text-muted-foreground">Base URL</span>
                <code className="rounded bg-secondary/50 px-2 py-1 text-xs text-foreground">{apiBaseUrl()}</code>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Check the connection</h4>
                <CodeSnippet
                  id="snippet-account"
                  label="curl"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`curl ${apiBaseUrl()}/account \\\n  -H "X-API-Key: ${revealedKey?.apiKey || "YOUR_API_KEY"}"`}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Send a text message</h4>
                <CodeSnippet
                  id="snippet-text"
                  label="curl"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`curl -X POST ${apiBaseUrl()}/messages/text \\\n  -H "X-API-Key: ${revealedKey?.apiKey || "YOUR_API_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"to": "919876543210", "text": "Hello from BotForge"}'`}
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Send an image with a caption</h4>
                <p className="text-xs text-muted-foreground">
                  Two calls: upload the file to get a URL, then send that URL — WhatsApp fetches the image itself,
                  so <code className="rounded bg-secondary/50 px-1 py-0.5">messages/media</code> never takes a file directly.
                </p>
                <CodeSnippet
                  id="snippet-upload"
                  label="1. Upload — curl"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`curl -X POST ${apiBaseUrl()}/media/upload \\\n  -H "X-API-Key: ${revealedKey?.apiKey || "YOUR_API_KEY"}" \\\n  -F "file=@/path/to/image.png;type=image/png"`}
                />
                <CodeSnippet
                  id="snippet-media"
                  label="2. Send — curl"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`curl -X POST ${apiBaseUrl()}/messages/media \\\n  -H "X-API-Key: ${revealedKey?.apiKey || "YOUR_API_KEY"}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "to": "919876543210",\n    "type": "image",\n    "url": "<url from step 1>",\n    "caption": "Invoice for order #4471"\n  }'`}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Using Postman instead: set <code className="rounded bg-secondary/50 px-1 py-0.5">X-API-Key</code> as
                a header on the request (or on the collection, under Authorization → API Key), and use these same
                URLs and JSON bodies.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook" className="space-y-4">
          {/* ---------------------------------------------------------------
              How the loop works. This tab is the only place a customer is
              told how to actually answer a message, so it has to teach the
              whole round trip — not just take a URL.
          ---------------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>How replying works</CardTitle>
              <CardDescription>
                Your bot is just one HTTP endpoint. We POST each incoming message to it, and whatever JSON you
                return is sent straight back to that contact.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {[
                  {
                    n: "1",
                    title: "Someone messages your number",
                    body: `They send "hi" to ${channel.waNumber ? `+${channel.waNumber}` : "your linked number"}.`,
                  },
                  {
                    n: "2",
                    title: "We POST it to your URL",
                    body: "Immediately — usually under a second — signed with HMAC-SHA256 so you can prove it came from us.",
                  },
                  {
                    n: "3",
                    title: "You return a reply in the response body",
                    body: 'Answer with {"reply": {"type": "text", "text": "..."}} and we deliver it. Return nothing to stay silent.',
                  },
                ].map((step) => (
                  <li key={step.n} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {step.n}
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4 rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                The reply always goes back to whoever messaged you — there is no{" "}
                <code className="rounded bg-secondary/50 px-1 py-0.5">to</code> field, and one you add is ignored.
                To message someone else, or to answer slower than the 10-second timeout, use{" "}
                <code className="rounded bg-secondary/50 px-1 py-0.5">POST /v1/messages/text</code> with an API key
                instead.
              </p>
            </CardContent>
          </Card>

          {/* --- Configuration ------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Endpoint</CardTitle>
              <CardDescription>
                Where we send each incoming message. Must be{" "}
                <code className="rounded bg-secondary/50 px-1 py-0.5 text-xs">https://</code> and reachable from the
                internet — <code className="rounded bg-secondary/50 px-1 py-0.5 text-xs">http://localhost</code> works
                only while testing against a local server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="https://example.com/webhooks/whatsapp"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSaveWebhook} disabled={isSavingWebhook || !webhookUrl.trim()}>
                  {isSavingWebhook ? <Spinner className="mr-2" /> : null}
                  Save
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Reply mode</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    {
                      value: "sync" as const,
                      title: "Reply in the response",
                      body: "We read your JSON response and send the reply. Simplest — one round trip, no API key needed.",
                    },
                    {
                      value: "none" as const,
                      title: "Reply separately",
                      body: "We ignore your response body. Answer whenever you're ready via the API. Use this for slow work.",
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setReplyMode(option.value)}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        replyMode === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80 hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            replyMode === option.value ? "bg-primary" : "bg-muted-foreground/40"
                          }`}
                        />
                        <span className="text-sm font-medium text-foreground">{option.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{option.body}</p>
                    </button>
                  ))}
                </div>
                {webhook && webhook.replyMode !== replyMode ? (
                  <p className="text-xs text-chart-3">Press Save to apply the new reply mode.</p>
                ) : null}
              </div>

              {webhook ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleRotateSecret}>
                    Reveal / Rotate Signing Secret
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={handleDeleteWebhook}
                  >
                    Remove Webhook
                  </Button>
                </div>
              ) : null}
              {revealedSecret ? (
                <div className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Signing secret — store this now, it won&apos;t be shown again in full:
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 truncate text-sm text-foreground">{revealedSecret}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(revealedSecret, "webhook-secret")}>
                      {copied === "webhook-secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* --- The payloads, both directions ---------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>What we send, what you return</CardTitle>
              <CardDescription>The exact JSON on the wire, in both directions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">We POST this to your URL</h4>
                <CodeSnippet
                  id="snippet-wh-in"
                  label="request body"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`{\n  "event": "message.received",\n  "deliveryId": "3f2a9c1e-...",\n  "channelId": "${channelId}",\n  "message": {\n    "id": "8b1d...",\n    "waMessageId": "3EB0...",\n    "from": "919876543210@s.whatsapp.net",\n    "type": "text",\n    "content": "hi",\n    "mediaUrl": null,\n    "receivedAt": "${new Date().toISOString()}"\n  }\n}`}
                />
                <p className="text-xs text-muted-foreground">
                  Headers: <code className="rounded bg-secondary/50 px-1 py-0.5">X-Signature</code>,{" "}
                  <code className="rounded bg-secondary/50 px-1 py-0.5">X-Timestamp</code>,{" "}
                  <code className="rounded bg-secondary/50 px-1 py-0.5">X-Event</code>,{" "}
                  <code className="rounded bg-secondary/50 px-1 py-0.5">X-Delivery-Id</code>,{" "}
                  <code className="rounded bg-secondary/50 px-1 py-0.5">X-Channel-Id</code>,{" "}
                  <code className="rounded bg-secondary/50 px-1 py-0.5">X-Attempt</code>.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">You return one of these</h4>
                <CodeSnippet
                  id="snippet-wh-out"
                  label="response body"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`// a text reply\n{"reply": {"type": "text", "text": "Hello!"}}\n\n// shorthand — both of these work too\n{"reply": "Hello!"}\n{"text": "Hello!"}\n\n// an image or document (max 3 replies per response)\n{"reply": {"type": "image", "url": "https://.../invoice.png", "caption": "Your invoice"}}\n\n// several messages in order\n{"replies": [{"text": "Got it."}, {"text": "Looking that up now..."}]}\n\n// stay silent — still counts as a successful delivery, not an error\n{}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* --- Copy-paste starter --------------------------------------- */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>A complete bot to copy</CardTitle>
                  <CardDescription>Runs as-is. Replace the reply logic with your own.</CardDescription>
                </div>
                <div className="flex gap-1 rounded-lg border border-border p-0.5">
                  {(["node", "python"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setStarterLang(lang)}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                        starterLang === lang
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {starterLang === "node" ? (
                <CodeSnippet
                  id="snippet-wh-node"
                  label="server.js — npm i express"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`const express = require("express");\nconst crypto = require("crypto");\n\nconst SECRET = "${revealedSecret || "YOUR_SIGNING_SECRET"}";\nconst app = express();\n\n// Keep the RAW body — the signature is over the exact bytes we sent.\napp.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));\n\napp.post("/hook", (req, res) => {\n  // 1. Verify it really came from BotForge\n  const expected = "sha256=" + crypto\n    .createHmac("sha256", SECRET)\n    .update(req.get("X-Timestamp") + "." + req.rawBody)\n    .digest("hex");\n  if (expected !== req.get("X-Signature")) return res.status(401).send("bad signature");\n\n  // 2. Read the message\n  const text = (req.body.message.content || "").trim().toLowerCase();\n  console.log("from", req.body.message.from, ":", text);\n\n  // 3. Reply — your logic goes here\n  if (text === "hi") return res.json({ reply: "Hey! Send 'help' to see what I can do." });\n  if (text === "help") return res.json({ reply: "Commands: hi, help, price" });\n  if (text === "price") return res.json({ reply: "Plans start at Rs.499/month." });\n\n  return res.json({});  // no reply\n});\n\napp.listen(5000, () => console.log("bot listening on :5000"));`}
                />
              ) : (
                <CodeSnippet
                  id="snippet-wh-python"
                  label="bot.py — pip install fastapi uvicorn"
                  copiedId={copied}
                  onCopy={copyToClipboard}
                  code={`import hashlib, hmac, uvicorn\nfrom fastapi import FastAPI, Header, HTTPException, Request\n\nSECRET = "${revealedSecret || "YOUR_SIGNING_SECRET"}"\napp = FastAPI()\n\n@app.post("/hook")\nasync def hook(request: Request, x_signature: str = Header(""), x_timestamp: str = Header("")):\n    raw = await request.body()  # the signature is over the exact bytes we sent\n\n    # 1. Verify it really came from BotForge\n    expected = "sha256=" + hmac.new(\n        SECRET.encode(), x_timestamp.encode() + b"." + raw, hashlib.sha256\n    ).hexdigest()\n    if not hmac.compare_digest(expected, x_signature):\n        raise HTTPException(401, "bad signature")\n\n    # 2. Read the message\n    message = (await request.json())["message"]\n    text = (message.get("content") or "").strip().lower()\n    print("from", message["from"], ":", text)\n\n    # 3. Reply — your logic goes here\n    if text == "hi":\n        return {"reply": "Hey! Send 'help' to see what I can do."}\n    if text == "help":\n        return {"reply": "Commands: hi, help, price"}\n    if text == "price":\n        return {"reply": "Plans start at Rs.499/month."}\n\n    return {}  # no reply\n\nuvicorn.run(app, host="0.0.0.0", port=5000)`}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Testing on your own machine? Expose it with{" "}
                <code className="rounded bg-secondary/50 px-1 py-0.5">cloudflared tunnel --url http://localhost:5000</code>{" "}
                and paste the https URL it prints into the Endpoint box above.
              </p>
            </CardContent>
          </Card>

          {/* --- Delivery log --------------------------------------------- */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Delivery log</CardTitle>
                  <CardDescription>
                    Every attempt to reach your endpoint. Failures retry automatically — 10s, 1m, 5m, 30m, 2h.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={loadDeliveries}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {deliveries.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  {webhook
                    ? "No deliveries yet. Send a message to this number and it'll show up here."
                    : "Save an endpoint above to start receiving messages."}
                </p>
              ) : (
                <div className="divide-y divide-border border-t border-border">
                  {deliveries.map((delivery) => {
                    const meta = deliveryStatusMeta(delivery.status)
                    return (
                      <div key={delivery.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={meta.className}>
                              {meta.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {delivery.attemptCount} attempt{delivery.attemptCount === 1 ? "" : "s"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(delivery.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {delivery.lastError ? (
                            <p className="break-words font-mono text-xs text-destructive">{delivery.lastError}</p>
                          ) : null}
                          {delivery.status === "pending" && delivery.nextAttemptAt ? (
                            <p className="text-xs text-muted-foreground">
                              Next attempt {new Date(delivery.nextAttemptAt).toLocaleString()}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={redelivering === delivery.id}
                          onClick={() => handleRedeliver(delivery.id)}
                        >
                          {redelivering === delivery.id ? <Spinner className="mr-2" /> : null}
                          Redeliver
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {messages.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No messages received yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {messages.map((message) => (
                    <div key={message.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-foreground">{message.contactJid}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.receivedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{message.content || `[${message.messageType}]`}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New API key reveal dialog */}
      <Dialog open={!!revealedKey} onOpenChange={(open) => !open && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Store it now — you won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>
          {revealedKey?.apiKey ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3">
              <code className="flex-1 truncate text-sm text-foreground">{revealedKey.apiKey}</code>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(revealedKey.apiKey!, "revealed-key")}>
                {copied === "revealed-key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
