"use client"

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserPlus, Copy, Check } from "lucide-react"
import { apiRequest, getStoredUser } from "@/lib/api"

type AdminUser = {
  id: string
  name?: string | null
  email: string
  isAdmin: boolean
  createdAt?: string | null
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return "Request failed"
}

export default function AdminPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored?.isAdmin) {
      router.replace("/dashboard")
      return
    }
    setIsAuthorized(true)
    loadUsers()
  }, [router])

  async function loadUsers() {
    setIsLoading(true)
    try {
      const payload = await apiRequest<{ success: boolean; users: AdminUser[] }>("/api/admin/users")
      setUsers(payload.users)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsCreating(true)
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      })
      setCreatedCredentials({ email, password })
      setName("")
      setEmail("")
      setPassword("")
      await loadUsers()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsCreating(false)
    }
  }

  function copyCredentials() {
    if (!createdCredentials) return
    navigator.clipboard
      .writeText(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
  }

  if (!isAuthorized) {
    return null
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin</h1>
        <p className="text-muted-foreground">Create and manage customer accounts. There is no public signup.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create customer account
          </CardTitle>
          <CardDescription>
            You set the password directly and hand it to the customer out of band — there&apos;s no email delivery
            on this tool.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="password">Initial password</FieldLabel>
                <Input
                  id="password"
                  type="text"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </Field>
            </FieldGroup>
            <Button type="submit" className="mt-4" disabled={isCreating}>
              {isCreating ? <Spinner className="mr-2" /> : null}
              Create Account
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center gap-3 p-6 text-muted-foreground">
              <Spinner />
              Loading...
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{user.name || user.email}</span>
                      {user.isAdmin ? <Badge>Admin</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!createdCredentials} onOpenChange={(open) => !open && setCreatedCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account created</DialogTitle>
            <DialogDescription>Share these credentials with the customer through a secure channel.</DialogDescription>
          </DialogHeader>
          {createdCredentials ? (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="font-mono text-foreground">{createdCredentials.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Password: </span>
                <span className="font-mono text-foreground">{createdCredentials.password}</span>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyCredentials}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              Copy
            </Button>
            <Button onClick={() => setCreatedCredentials(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
