import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as ChevronDown, i as Earth, n as Search, r as Landmark } from "../_libs/lucide-react.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DP3r5V8V.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WEST_MODELS = [
	{
		id: "claude",
		label: "Claude",
		lab: "Anthropic"
	},
	{
		id: "grok",
		label: "Grok",
		lab: "xAI"
	},
	{
		id: "gemini",
		label: "Gemini",
		lab: "Google"
	}
];
var CHINA_MODELS = [
	{
		id: "glm",
		label: "GLM",
		lab: "Zhipu"
	},
	{
		id: "qwen",
		label: "Qwen",
		lab: "Alibaba"
	},
	{
		id: "kimi",
		label: "Kimi",
		lab: "Moonshot"
	}
];
var ALL_MODELS = [...WEST_MODELS, ...CHINA_MODELS];
var WEEK_LABEL = "1 – 7 de septiembre 2026";
var SIGNALS = [
	{
		id: "claude-fable",
		title: "Claude Fable 5.1 llega al frente de razonamiento",
		summary: "Anthropic publica Fable 5.1. En evaluaciones de agentes y corrección de código sigue liderando frente a GPT y Gemini en casos límite.",
		detail: "Opus 5 y Fable 5.1 destacan en tareas de ingeniería con edge cases. El coste por token es más alto que Gemini Flash o GLM, pero la tasa de éxito en flujos largos justifica el premium para trabajo de producto. En X y HN el debate es calidad vs. precio, no si Claude sigue en el top.",
		region: "west",
		models: ["claude"],
		source: "lab",
		sourceLabel: "Anthropic"
	},
	{
		id: "grok-46",
		title: "Grok 4.6: más cerca del tope, más barato por token",
		summary: "xAI sitúa Grok 4.6 a pocos puntos del líder, con precio agresivo. Su ventaja clara: búsqueda en vivo y contexto actualizado.",
		detail: "En benchmarks de agosto queda cerca de GPT-5.6 Sol a un tercio del precio de salida. Sigue por detrás de Claude en generación de código y recall de contexto largo (>128k). Si el trabajo depende de la web en tiempo real, Grok es el modelo occidental más competitivo por coste.",
		region: "west",
		models: ["grok"],
		source: "lab",
		sourceLabel: "xAI"
	},
	{
		id: "gemini-flash",
		title: "Gemini 3.7 Flash: volumen y código a precio promocional",
		summary: "Google baja de precio Flash hasta fin de año. Es el modelo occidental más eficiente para volumen, con salto claro en código vs. 3.6.",
		detail: "Gemini 3.7 Flash mejora cuatro puntos a 3.6 Flash y Google lo deja en tarifa promocional. Equipos lo usan para generadores de sitios, simuladores y pipelines de agentes. Gemini 3.5 Pro sigue siendo la pieza de contexto ultra-largo (Deep Think). La conversación en Occidente: Flash para escala, Claude para precisión.",
		region: "west",
		models: ["gemini"],
		source: "lab",
		sourceLabel: "Google"
	},
	{
		id: "west-compare",
		title: "Occidente: Claude precisión, Gemini escala, Grok en vivo",
		summary: "El mapa occidental se estabiliza en tres roles. Nadie cierra el gap de agentes de Claude; Gemini gana volumen; Grok gana actualidad.",
		detail: "Suscripciones tope (Claude Max, SuperGrok Heavy, Google Ultra) se comparan sobre todo en coding. Claude gana calidad. Gemini gana coste por millón y contexto. Grok gana integración con X y datos en vivo. Elegir uno ya no es ranking único: es rol.",
		region: "west",
		models: [
			"claude",
			"grok",
			"gemini"
		],
		source: "market",
		sourceLabel: "Occidente"
	},
	{
		id: "glm-53",
		title: "GLM-5.3 iguala a Kimi K3 a menor coste por tarea",
		summary: "Zhipu publica GLM-5.3. Empata el score de Kimi K3 y sale más barato por tarea que Grok 4.6. GLM-5.3 Flash lidera preferencia de usuarios.",
		detail: "Artificial Analysis aún lo clasifica como API propietaria. GLM-5.2 MIT sigue siendo el open-weight más usable en hardware modesto (753B MoE, ~40B activos). En China el hilo dominante es inferencia barata y agentes locales, no el Elo de Arena.",
		region: "china",
		models: ["glm", "kimi"],
		source: "lab",
		sourceLabel: "Zhipu"
	},
	{
		id: "qwen-38",
		title: "Qwen 3.8 se parte en dos: Max cerrado y checkpoint abierto",
		summary: "Alibaba lanza Qwen3.8-Max (API multimodal, score 58) y un checkpoint 2.4T A95B descargable, texto-only y con licencia comercial restringida.",
		detail: "La familia Qwen es la más completa del año en China: Coder-Next para código, 3.6 para local, 3.8-Max para frontera, 3.8 Flash y 27B para latencia. Quien sigue un solo linaje chino, sigue Qwen. En Weibo y Zhihu el debate es licencia vs. rendimiento, no si Qwen está en el mapa.",
		region: "china",
		models: ["qwen"],
		source: "lab",
		sourceLabel: "Alibaba"
	},
	{
		id: "kimi-k3",
		title: "Kimi K3 open-weight: el más grande publicado hasta ahora",
		summary: "Moonshot suelta pesos de Kimi K3 (~2.8T). Lidera Frontend Code Arena. Hardware serio: cientos de GB en disco.",
		detail: "K3 sale el 26 de julio y sigue dominando conversación en septiembre. En agentes de UI queda por encima de Fable 5 en Frontend Code Arena. El coste por tarea en API sigue alto frente a DeepSeek o GLM Flash. En redes chinas: ‘¿quién puede hospedarlo?’ más que ‘¿quién gana el bench?’",
		region: "china",
		models: ["kimi"],
		source: "open-source",
		sourceLabel: "Moonshot"
	},
	{
		id: "china-compare",
		title: "China: Qwen cobertura, GLM agentes locales, Kimi peso bruto",
		summary: "Tres polos claros. Qwen cubre local + frontera. GLM es el agente que dejas corriendo. Kimi empuja el techo open-weight.",
		detail: "En Weibo, Zhihu y Bilibili la semana no gira alrededor de OpenAI. Gira alrededor de coste de inferencia, chips locales y si GLM-5.3 Flash o Qwen Flash ganan el día a día. Occidente actualiza; China comprime precio y open-weight al mismo tiempo.",
		region: "china",
		models: [
			"glm",
			"qwen",
			"kimi"
		],
		source: "social",
		sourceLabel: "Weibo / Zhihu"
	},
	{
		id: "arxiv-agents",
		title: "arXiv: planificación y memoria, no más chat",
		summary: "Los papers de cs.AI / cs.LG de la semana empujan agentes multi-paso. El chat plano ya no es el objeto de estudio.",
		detail: "Trabajos recientes se centran en planificar antes de actuar y en memoria de largo plazo. Eso alinea investigación con lo que Claude, GLM y Kimi venden en producto: sistemas que ejecutan, no que contestan. GitHub Trending sigue la misma línea (orquestación RAG + agentes).",
		region: "west",
		models: ["claude", "gemini"],
		source: "research",
		sourceLabel: "arXiv"
	},
	{
		id: "github-agents",
		title: "GitHub Trending: orquestación, no demos de chatbot",
		summary: "Los repos que suben son frameworks de agentes, RAG y observabilidad. El chatbot suelto ya no trending.",
		detail: "Tanto stacks occidentales (Claude / Grok tool-use) como chinos (Qwen-Coder, GLM agent loops) alimentan las mismas plantillas: plan → herramienta → verificación. Quien publique un wrapper de chat esta semana no entra en el ranking.",
		region: "west",
		models: [
			"claude",
			"grok",
			"qwen",
			"glm"
		],
		source: "open-source",
		sourceLabel: "GitHub"
	}
];
var SOURCE_LABEL = {
	lab: "Laboratorio",
	"open-source": "Open source",
	research: "Investigación",
	social: "Redes",
	market: "Mercado"
};
function filterSignals(region, model) {
	const westIds = [
		"claude",
		"grok",
		"gemini"
	];
	const chinaIds = [
		"glm",
		"qwen",
		"kimi"
	];
	return SIGNALS.filter((s) => {
		const regionOk = region === "all" || s.region === region || region === "west" && s.models.some((m) => westIds.includes(m)) || region === "china" && s.models.some((m) => chinaIds.includes(m));
		const modelOk = model === "all" || s.models.includes(model);
		return regionOk && modelOk;
	});
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function WeekView() {
	const [region, setRegion] = (0, import_react.useState)("all");
	const [model, setModel] = (0, import_react.useState)("all");
	const [query, setQuery] = (0, import_react.useState)("");
	const [openId, setOpenId] = (0, import_react.useState)("west-compare");
	const modelOptions = region === "west" ? WEST_MODELS : region === "china" ? CHINA_MODELS : ALL_MODELS;
	const signals = (0, import_react.useMemo)(() => {
		const base = filterSignals(region, model);
		const q = query.trim().toLowerCase();
		if (!q) return base;
		return base.filter((s) => s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q) || s.models.some((m) => m.includes(q)));
	}, [
		region,
		model,
		query
	]);
	function pickRegion(next) {
		setRegion(next);
		if (next === "all") return;
		if (model === "all") return;
		if (!(next === "west" ? WEST_MODELS : CHINA_MODELS).map((m) => m.id).includes(model)) setModel("all");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-10 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-xs font-medium tracking-[0.18em] text-subtle uppercase",
				children: "Informe semanal"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-[2rem] leading-tight tracking-tight text-fg sm:text-4xl",
				children: "Inteligencia artificial, por región y por modelo"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 max-w-xl text-sm text-muted sm:text-base",
				children: [
					"Occidente: Claude, Grok, Gemini. China: GLM, Qwen, Kimi. Semana del",
					" ",
					WEEK_LABEL,
					"."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid grid-cols-3 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						value: signals.length,
						label: "Señales"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						value: region === "china" ? "China" : region === "west" ? "West" : "Global",
						label: "Región"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						value: model === "all" ? "Todos" : ALL_MODELS.find((m) => m.id === model)?.label ?? "—",
						label: "Modelo"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-8 space-y-4",
				"aria-label": "Filtros",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs font-medium tracking-wide text-subtle uppercase",
						children: "Región"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								active: region === "all",
								onClick: () => pickRegion("all"),
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Earth, { className: "size-3.5" }),
								testId: "region-all",
								children: "Todo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								active: region === "west",
								onClick: () => pickRegion("west"),
								icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Landmark, { className: "size-3.5" }),
								testId: "region-west",
								children: "Occidente"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
								active: region === "china",
								onClick: () => pickRegion("china"),
								testId: "region-china",
								children: "China"
							})
						]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs font-medium tracking-wide text-subtle uppercase",
						children: region === "china" ? "Modelos chinos" : region === "west" ? "Modelos occidentales" : "Modelos"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
							active: model === "all",
							onClick: () => setModel("all"),
							testId: "model-all",
							children: "Todos"
						}), modelOptions.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Chip, {
							active: model === m.id,
							onClick: () => setModel(m.id),
							testId: `model-${m.id}`,
							children: [m.label, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-subtle",
								children: [" · ", m.lab]
							})]
						}, m.id))]
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "relative block",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sr-only",
								children: "Buscar en el informe"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: query,
								onChange: (e) => setQuery(e.target.value),
								placeholder: "Buscar en títulos y notas",
								className: "h-11 w-full rounded-xl border border-border bg-surface pr-3 pl-10 text-sm text-fg placeholder:text-subtle outline-none transition-colors duration-150 focus:border-accent"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 space-y-3",
				children: signals.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted",
					children: "Nada coincide con esos filtros. Prueba otra región o modelo."
				}) : signals.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalCard, {
					signal: s,
					open: openId === s.id,
					onToggle: () => setOpenId((cur) => cur === s.id ? null : s.id)
				}, s.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "mt-14 border-t border-border pt-6 text-xs text-subtle",
				children: "AI Informe · Fuentes públicas de la semana · No es ranking único, es mapa de roles."
			})
		]
	});
}
function Stat({ value, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-border bg-surface px-3 py-3 text-center",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-display text-lg tabular-nums text-fg",
			children: value
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[11px] tracking-wide text-subtle uppercase",
			children: label
		})]
	});
}
function Chip({ active, onClick, children, icon, testId }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		"data-testid": testId,
		onClick,
		"aria-pressed": active,
		className: cn("inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors duration-150", active ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted hover:border-accent hover:text-fg"),
		children: [icon, children]
	});
}
function SignalCard({ signal, open, onToggle }) {
	const regionLabel = signal.region === "china" ? "China" : "Occidente";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "overflow-hidden rounded-2xl border border-border bg-surface",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onToggle,
			"aria-expanded": open,
			className: "flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 flex flex-wrap gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase", signal.region === "china" ? "bg-elevated text-china" : "bg-elevated text-west"),
								children: regionLabel
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-subtle uppercase",
								children: SOURCE_LABEL[signal.source]
							}),
							signal.models.map((m) => {
								const meta = ALL_MODELS.find((x) => x.id === m);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded-md bg-elevated px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-fg uppercase",
									children: meta?.label ?? m
								}, m);
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg leading-snug text-fg",
						children: signal.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: signal.summary
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: cn("mt-1 size-5 shrink-0 text-subtle transition-transform duration-200 ease-[var(--ease-out-smooth)]", open && "rotate-180") })]
		}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "border-t border-border px-4 pt-3 pb-4 text-sm leading-relaxed text-muted sm:px-5",
			children: signal.detail
		}) : null]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WeekView, {});
}
//#endregion
export { Home as component };
