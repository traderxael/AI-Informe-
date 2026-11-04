import { useLang, type Lang } from "@/lib/i18n";

/** Toggle ES/EN — persiste en localStorage ("ai-informe-lang"). */
export function LangToggle() {
  const { lang, setLang } = useLang();
  const langs: Lang[] = ["es", "en"];
  return (
    <div
      className="inline-flex min-h-10 items-center rounded-full border border-border bg-bg/60 p-1 text-[11px] font-semibold text-muted"
      role="group"
      aria-label="Idioma / Language"
    >
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={
            lang === l
              ? "rounded-full bg-accent/20 px-3 py-1.5 text-accent"
              : "rounded-full px-3 py-1.5 transition hover:text-fg"
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
