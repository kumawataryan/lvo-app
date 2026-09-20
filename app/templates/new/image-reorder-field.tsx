"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type TemplateImage =
  | { id: string; kind: "new"; file: File; previewUrl: string }
  | { id: string; kind: "existing"; path: string; url: string };

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function imageFilename(path: string) {
  return path.split("/").pop() || path;
}

function SortableImageRow({ image, featured, onRemove }: { image: TemplateImage; featured: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const src = image.kind === "new" ? image.previewUrl : image.url;
  const title = image.kind === "new" ? image.file.name : imageFilename(image.path);
  const subtitle = image.kind === "new" ? formatFileSize(image.file.size) : "Already uploaded";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border border-black/10 bg-white py-2.5 pl-1.5 pr-3 ${isDragging ? "z-10 opacity-70 shadow-lg" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="flex h-9 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-black/30 transition active:cursor-grabbing active:bg-black/5"
      >
        <GripVertical className="h-4.5 w-4.5" />
      </button>
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#f2f2f2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{title}</span>
          {featured ? <span className="shrink-0 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">Featured</span> : null}
        </span>
        <span className="mt-0.5 block text-xs text-black/40">{subtitle}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-black/40 transition hover:bg-black/5 active:scale-90"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ImageReorderField({
  images,
  onChange,
  onError,
  maxImages,
}: {
  images: TemplateImage[];
  onChange: (images: TemplateImage[]) => void;
  onError: (message: string) => void;
  maxImages: number;
}) {
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    images.forEach((image) => { if (image.kind === "new") objectUrls.current.add(image.previewUrl); });
  }, [images]);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
      onError("Each image must be smaller than 15 MB.");
      return;
    }
    onError("");
    const room = Math.max(0, maxImages - images.length);
    const accepted: TemplateImage[] = files.slice(0, room).map((file) => ({ id: crypto.randomUUID(), kind: "new", file, previewUrl: URL.createObjectURL(file) }));
    onChange([...images, ...accepted]);
  };

  const removeImage = (id: string) => {
    const target = images.find((image) => image.id === id);
    if (target?.kind === "new") {
      URL.revokeObjectURL(target.previewUrl);
      objectUrls.current.delete(target.previewUrl);
    }
    onChange(images.filter((image) => image.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((image) => image.id === active.id);
    const newIndex = images.findIndex((image) => image.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(images, oldIndex, newIndex));
  };

  return (
    <div>
      <DndContext id="template-images" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map((image) => image.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {images.map((image, index) => (
              <SortableImageRow key={image.id} image={image} featured={index === 0} onRemove={() => removeImage(image.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {images.length < maxImages ? (
        <label className={`flex h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/20 text-black/40 transition hover:border-black/35 active:scale-[0.99] ${images.length ? "mt-2" : ""}`}>
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Add images</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={addImages} className="sr-only" />
        </label>
      ) : null}
    </div>
  );
}
