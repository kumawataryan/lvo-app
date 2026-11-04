export function canUserAddTemplates(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  const role = user?.app_metadata?.role;
  return user?.app_metadata?.can_add_templates === true || role === "admin" || role === "template_editor";
}
