export function canUserAddTemplates(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  const role = user?.app_metadata?.role;
  return user?.app_metadata?.can_add_templates === true || role === "admin" || role === "template_editor";
}

export function isTemplateAdmin(user: { app_metadata?: Record<string, unknown> } | null | undefined) {
  return user?.app_metadata?.role === "admin";
}

/** Admins can manage every template; other template editors only the ones they created. */
export function canManageTemplate(user: { id: string; app_metadata?: Record<string, unknown> } | null | undefined, createdBy: string | null | undefined) {
  return Boolean(user) && (isTemplateAdmin(user) || createdBy === user!.id);
}
