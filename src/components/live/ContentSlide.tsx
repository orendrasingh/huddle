import { MediaView } from "./Visuals";
import type { Question } from "@/lib/game";
import { cn } from "@/lib/utils";

export function ContentSlide({ q, compact }: { q: Question; compact?: boolean }) {
  const layout = q.layout ?? "center";
  const text = (
    <div className={cn("flex flex-col gap-4", layout === "center" && "items-center text-center")}>
      {q.prompt.trim() && <h1 className={cn("font-display font-extrabold leading-tight", compact ? "text-2xl" : "text-5xl sm:text-6xl")}>{q.prompt}</h1>}
      {q.body && <p className={cn("whitespace-pre-line", compact ? "text-base" : "text-xl sm:text-2xl")}>{q.body}</p>}
    </div>
  );
  if (layout === "full" && q.media)
    return (
      <div className="flex flex-col items-center gap-4 animate-pop">
        <MediaView media={q.media} className={compact ? "max-h-52" : "max-h-[65vh] w-full"} />
        {q.prompt.trim() && <h2 className={cn("text-center font-display font-extrabold", compact ? "text-xl" : "text-3xl")}>{q.prompt}</h2>}
      </div>
    );
  if ((layout === "left" || layout === "right") && q.media && !compact)
    return (
      <div className={cn("grid flex-1 items-center gap-10 md:grid-cols-2 animate-pop")}>
        <div className={layout === "right" ? "md:order-2" : ""}><MediaView media={q.media} className="max-h-[60vh] w-full" /></div>
        {text}
      </div>
    );
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 animate-pop">
      {text}
      <MediaView media={q.media} className={compact ? "max-h-52" : "max-h-[50vh]"} />
    </div>
  );
}

