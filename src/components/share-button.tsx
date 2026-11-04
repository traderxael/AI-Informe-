import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Comparte la página actual: Web Share API en móvil, portapapeles en desktop. */
export function ShareButton({ title, text }: { title: string; text?: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url =
      typeof window !== "undefined" ? window.location.href : "https://ai-informe.vercel.app";
    const shareText = text ?? t("hero.sub");
    try {
      if (navigator.share) {
        await navigator.share({ title, text: shareText, url });
        return;
      }
    } catch {
      // el usuario canceló o el navegador no permite share() — cae al portapapeles
    }
    try {
      await navigator.clipboard.writeText(`${title}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // portapapeles no disponible — nada más que hacer
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label={t("share.label")}
      title={t("share.label")}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-bg/60 px-3 py-1.5 text-[11px] font-semibold text-muted transition hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {copied ? <Check className="size-4 text-accent" /> : <Share2 className="size-4" />}
      <span className="hidden sm:inline">{copied ? t("share.done") : t("share.label")}</span>
    </button>
  );
}
