import { redirect } from "next/navigation";

// The real settings UI lives inside the "Settings" dropdown on
// /owner/profile (see settings-dropdown.tsx). This route is kept so
// any existing links to /owner/settings still land somewhere useful.
export default function SettingsPage() {
  redirect("/owner/profile");
}
