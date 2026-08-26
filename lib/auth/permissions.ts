import type { User } from "@supabase/supabase-js";

export function canUserAddTemplates(user: User | null | undefined) {
  const role = user?.app_metadata?.role;
  return user?.app_metadata?.can_add_templates === true || role === "admin" || role === "template_editor";
}
