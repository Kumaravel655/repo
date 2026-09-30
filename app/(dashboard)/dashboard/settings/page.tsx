"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { User, Shield } from "lucide-react"
import { apiRequest, setStoredUser, type AuthUser } from "@/lib/api"

type ProfileResponse = {
  success: boolean
  user: AuthUser
}

type StatusState = {
  kind: "success" | "error"
  message: string
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Request failed"
}

export default function SettingsPage() {
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [status, setStatus] = useState<StatusState | null>(null)

  const initials = useMemo(() => {
    const source = fullName.trim() || email.trim() || "User"
    const parts = source.split(" ").filter(Boolean)
    const first = parts[0]?.[0] || "U"
    const second = parts.length > 1 ? parts[1]?.[0] : ""
    return `${first}${second}`.toUpperCase()
  }, [email, fullName])

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      setIsLoadingProfile(true)
      try {
        const payload = await apiRequest<ProfileResponse>("/api/auth/me")
        if (!mounted) {
          return
        }

        const user = payload.user
        setFullName(user.name || "")
        setEmail(user.email)
        setCompany(user.company || "")
        setStoredUser(user)
      } catch (error) {
        if (mounted) {
          setStatus({ kind: "error", message: errorMessage(error) })
        }
      } finally {
        if (mounted) {
          setIsLoadingProfile(false)
        }
      }
    }

    loadProfile()
    return () => {
      mounted = false
    }
  }, [])

  async function handleSaveProfile() {
    const trimmedName = fullName.trim()
    if (trimmedName.length < 2) {
      setStatus({ kind: "error", message: "Full name must be at least 2 characters." })
      return
    }

    setIsSavingProfile(true)
    setStatus(null)

    try {
      const payload = await apiRequest<ProfileResponse>("/api/auth/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: trimmedName,
          company: company.trim() || null,
        }),
      })

      const user = payload.user
      setFullName(user.name || "")
      setCompany(user.company || "")
      setStoredUser(user)
      setStatus({ kind: "success", message: "Profile updated successfully." })
    } catch (error) {
      setStatus({ kind: "error", message: errorMessage(error) })
    } finally {
      setIsSavingProfile(false)
    }
  }

  async function handleUpdatePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({ kind: "error", message: "Please fill all password fields." })
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "New password and confirm password do not match." })
      return
    }

    setIsUpdatingPassword(true)
    setStatus(null)

    try {
      await apiRequest<{ success: boolean; message: string }>("/api/auth/me/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setStatus({ kind: "success", message: "Password updated successfully." })
    } catch (error) {
      setStatus({ kind: "error", message: errorMessage(error) })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      {status ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            status.kind === "success"
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {status.message}
        </div>
      ) : null}

      {isLoadingProfile ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <Spinner />
            Loading account settings...
          </CardContent>
        </Card>
      ) : null}

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-xl text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input id="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" value={email} readOnly disabled />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="company">Company (optional)</FieldLabel>
              <Input
                id="company"
                value={company}
                placeholder="Your company name"
                onChange={(event) => setCompany(event.target.value)}
              />
            </Field>
          </FieldGroup>

          <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="mt-6">
            {isSavingProfile ? <Spinner className="mr-2" /> : null}
            {isSavingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Manage your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="current-password">Current Password</FieldLabel>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
            </div>
          </FieldGroup>
          <Button variant="outline" onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
            {isUpdatingPassword ? <Spinner className="mr-2" /> : null}
            {isUpdatingPassword ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
