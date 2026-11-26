import { createContext } from "react";

export type Lang = "es" | "en";

export type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

export const LangContext = createContext<LangContextValue>({
  lang: "es",
  setLang: () => {},
  t: (k) => k,
});
