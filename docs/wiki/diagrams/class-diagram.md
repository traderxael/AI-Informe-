# Class Diagram

## Core Types (frontend, `src/lib/`)

```mermaid
classDiagram
    class ModelInfo {
        +ModelId id
        +string name
        +string org
        +Region region
        +number elo
        +number priceIn
        +number priceOut
        +string license
    }
    class Signal {
        +string id
        +string title
        +string summary
        +SourceKind source
        +Region region
        +string country
        +ModelId[] models
        +string published
    }
    class NoticiaDelDia {
        +string id
        +string titulo
        +string resumen
        +Categoria categoria
        +string idioma
    }
    class LiveRaw {
        +string id
        +string title
        +string summary
        +string[] models
        +string country
    }
    class LivePayload {
        +string generated_at
        +number count
        +string[] sources
        +LiveRaw[] signals
    }
    class DbState {
        +DbSource dbSource
        +getSql() Promise~Sql~
        +ensureDbReady() Promise~void~
    }
    ModelInfo "1" --> "*" Signal : detectado en
    Signal --> NoticiaDelDia : enrichSignals()
    LivePayload "1" *-- "*" LiveRaw
    LiveRaw --> Signal : mapLiveSignal()
```

## Pipeline Types (Python, implícitos en dicts)

```mermaid
classDiagram
    class Feed {
        +string nombre
        +string url
    }
    class Item {
        +string titulo
        +string resumen
        +string fuente
        +string fecha
        +seccion: string
        +pais: string
        +score: float
    }
    class Informe {
        +date day
        +Item[] items
        +render_markdown() string
        +export_web_json() void
    }
    class XItem {
        +string id
        +string texto
        +string handle
        +string etiqueta
        +int views
    }
    Feed "*" --> "*" Item : parse_feed()
    Informe "1" *-- "*" Item
    Informe "1" o-- "*" XItem : x_items()
```

## Notes

- El pipeline Python **no usa clases**: todo son `dict[str, Any]` con claves literales. Los diagramas son conceptuales, no tipos declarados.
- `ModelId` es un union type validado en runtime por `isModelId()`.
- `dbSource` es `"neon"` o `"pglite"` según haya `databaseUrl`; no es una clase, es una constante.
- `src/routeTree.gen.ts` es generado por TanStack Router; no editar a mano.
