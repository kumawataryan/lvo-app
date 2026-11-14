// Shown instantly when a template is opened from Manage, while the edit page's data loads on the server.
export default function EditTemplateLoading() {
  return (
    <main aria-busy="true" aria-label="Loading template" className="flex h-dvh flex-col overflow-hidden bg-white text-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 pt-8">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-[#f2f2f2]" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-[#f2f2f2]" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-[#f2f2f2]" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-[#f2f2f2]" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="aspect-[9/16] animate-pulse rounded-xl bg-[#f2f2f2]" />
          ))}
        </div>
      </div>
    </main>
  );
}
