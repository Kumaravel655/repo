"use client"

import { useState, type ChangeEvent, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft } from "lucide-react"
import { apiRequest } from "@/lib/api"

type Channel = { id: string }

export default function NewChannelPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      const payload = await apiRequest<{ success: boolean; channel: Channel }>("/api/channels", {
        method: "POST",
        body: JSON.stringify({ name, description: description.trim() || null }),
      })
      router.push(`/dashboard/channels/${payload.channel.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel")
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/channels">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">New Channel</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel details</CardTitle>
          <CardDescription>
            You&apos;ll link a WhatsApp number to this channel by scanning a QR code on the next step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  placeholder="e.g. Support Line"
                  value={name}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  required
                  minLength={2}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
                <Textarea
                  id="description"
                  placeholder="What is this number used for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </Field>
            </FieldGroup>

            <Button type="submit" className="mt-6 w-full" disabled={isLoading}>
              {isLoading ? <Spinner className="mr-2" /> : null}
              {isLoading ? "Creating..." : "Create Channel"}
            </Button>

            {error ? (
              <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
