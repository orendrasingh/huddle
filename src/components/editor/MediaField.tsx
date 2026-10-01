import { ImagePlus, Link2, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { youtubeId, type Media } from "@/lib/game";
import { uploadMedia } from "@/lib/media";
import { cn } from "@/lib/utils";

function kindFor(url: string, mime?: string): Media["kind"] {
  if (youtubeId(url)) return "youtube";
  if (mime?.startsWith("video/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return "video";
  return "image";
}

function useUpload(canUpload: boolean) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function handle(file: File | undefined, done: (url: string, mime: string) => void) {
    if (!file) return;
    setBusy(true);
    try {
      done(await uploadMedia(file), file.type);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  const open = () => {
    if (!canUpload) { toast("Sign in to upload files — or paste a link instead"); return; }
    ref.current?.click();
  };
  return { ref, busy, handle, open };
}

/** Image / video / YouTube attachment for a slide. */
export function MediaField({ value, onChange, canUpload }: { value?: Media | null | undefined; onChange: (m: Media | null) => void; canUpload: boolean }) {
  const up = useUpload(canUpload);
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  if (value?.url)
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-secondary p-2">
        {value.kind === "image" ? <img src={value.url} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <span className="grid h-14 w-20 place-items-center rounded-lg bg-card text-2xl">🎬</span>}
        <span className="flex-1 truncate text-sm font-semibold">{value.kind === "youtube" ? "YouTube video" : value.kind === "video" ? "Video" : "Image"}</span>
        <button onClick={() => onChange(null)} className="rounded-full p-2 hover:bg-card" aria-label="Remove media"><X size={16} /></button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={up.ref} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => up.handle(e.target.files?.[0], (url, mime) => onChange({ url, kind: kindFor(url, mime) }))} />
      <button onClick={up.open} disabled={up.busy} className="flex items-center gap-2 rounded-full border-2 border-dashed border-ink px-4 py-2 text-sm font-bold hover:bg-secondary">
        {up.busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Add image or video
      </button>
      {showLink ? (
        <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (link.trim()) { onChange({ url: link.trim(), kind: kindFor(link.trim()) }); setLink(""); setShowLink(false); } }}>
          <input autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste image or YouTube link" className="min-w-0 flex-1 rounded-full border-2 border-ink bg-background px-4 py-2 text-sm outline-none" />
          <button className="rounded-full bg-ink px-4 text-sm font-bold text-background">Add</button>
        </form>
      ) : (
        <button onClick={() => setShowLink(true)} className="flex items-center gap-2 rounded-full border-2 border-dashed border-ink px-4 py-2 text-sm font-bold hover:bg-secondary">
          <Link2 size={16} /> Link / YouTube
        </button>
      )}
    </div>
  );
}

/** Compact image picker (answer images, logo, backgrounds). */
export function ImageField({ value, onChange, canUpload, label = "Image", className }: { value?: string | undefined; onChange: (url: string) => void; canUpload: boolean; label?: string; className?: string }) {
  const up = useUpload(canUpload);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input ref={up.ref} type="file" accept="image/*" className="hidden" onChange={(e) => up.handle(e.target.files?.[0], (url) => onChange(url))} />
      {value ? (
        <span className="relative">
          <img src={value} alt="" className="h-10 w-10 rounded-lg border-2 border-ink object-cover" />
          <button onClick={() => onChange("")} aria-label={`Remove ${label}`} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-ink bg-card text-foreground"><X size={12} /></button>
        </span>
      ) : (
        <button onClick={up.open} disabled={up.busy} title={`Add ${label}`} aria-label={`Add ${label}`} className="grid h-10 w-10 place-items-center rounded-lg border-2 border-dashed border-current bg-card/60 text-foreground">
          {up.busy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        </button>
      )}
    </div>
  );
}

export function ImageUrlField({ value, onChange, canUpload, label }: { value: string; onChange: (url: string) => void; canUpload: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <ImageField value={value} onChange={onChange} canUpload={canUpload} label={label} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image link" className="min-w-0 flex-1 rounded-xl border-2 border-ink bg-background px-3 py-2 text-sm outline-none" />
    </div>
  );
}
