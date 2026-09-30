import { redirect } from "next/navigation"

export default function RootPage() {
  // Internal tool, admin-created accounts only — there's no public marketing
  // funnel to land on, so the root path just goes straight to login.
  redirect("/login")
}
