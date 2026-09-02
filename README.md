# AI Informe

Workspace de **Grok** para explorar y presentar un informe semanal sobre inteligencia artificial organizado por **región**, **modelo** y **tipo de fuente**. La aplicación ofrece una vista compacta y responsive con señales editoriales sobre los principales modelos occidentales y chinos, además de temas de investigación y del ecosistema open source.

> El proyecto funciona como un mapa de roles y tendencias de IA, no como un ranking único de modelos.

## Qué incluye

La interfaz principal, titulada **«Inteligencia artificial, por región y por modelo»**, permite consultar las señales de la semana mediante filtros y búsqueda local. Cada señal muestra un resumen y puede expandirse para leer el detalle completo.

| Área | Cobertura |
| --- | --- |
| Regiones | Todo, Occidente y China |
| Modelos | Claude, Grok, Gemini, GLM, Qwen y Kimi |
| Fuentes | Laboratorios, open source, investigación, redes y mercado |
| Interacción | Filtros por región y modelo, búsqueda por títulos y notas, y tarjetas desplegables |
| Presentación | Diseño responsive, tipografía editorial, tema oscuro y soporte PWA |

Los datos editoriales de la vista actual se encuentran en `src/lib/informe-data.ts`. Allí se definen los modelos, las regiones, las fuentes, la etiqueta de la semana y el conjunto de señales que alimenta la interfaz.

## Tecnologías

El workspace está construido con **React 19**, **TypeScript**, **Vite**, **TanStack Start/Router**, **Tailwind CSS v4**, **Zustand**, **Zod**, **Lucide React** y herramientas de calidad como **ESLint**, **Prettier**, **Playwright** y las pruebas nativas de Node.

La configuración incorpora además infraestructura preparada para autenticación, acceso a datos y despliegue. Estas capacidades son optativas y deben activarse o utilizarse de acuerdo con la configuración del entorno; la vista actual se centra en la presentación del informe y mantiene los datos editoriales en el código fuente.

## Estructura principal

```text
.
├── .grok/                  # Referencias y documentación del workspace
├── artifacts/              # Artefactos generados por el workspace
├── migrations/             # Migraciones disponibles para datos persistentes
├── public/                 # Recursos públicos, iconos y soporte PWA
├── scripts/                # Arranque, migraciones, QA y utilidades de desarrollo
├── server/                 # Middleware y piezas de integración del servidor
├── src/
│   ├── components/         # Componentes visuales, incluido el informe semanal
│   ├── lib/                # Datos, autenticación, utilidades y acceso a datos
│   ├── routes/             # Rutas de TanStack Router
│   └── styles.css          # Estilos globales y tokens visuales
├── startup.sh              # Contrato de arranque del entorno de preview
├── package.json            # Scripts y dependencias
├── tsconfig.json           # Configuración de TypeScript
└── vite.config.ts          # Configuración de Vite y TanStack
```

Los puntos de entrada de la aplicación son `src/routes/index.tsx` y `src/routes/__root.tsx`. La pantalla de inicio renderiza `WeekView`, que concentra la navegación por señales, los filtros y la búsqueda.

## Requisitos

Se requiere **Node.js 22** o una versión compatible con la configuración del proyecto, además de `npm`. Las dependencias se instalan a partir de `package-lock.json`.

## Desarrollo local

Instala las dependencias y levanta el servidor de desarrollo con:

```bash
npm install
npm run dev
```

El servidor de desarrollo se expone en `http://localhost:8080`. También puede utilizarse el contrato de arranque del workspace:

```bash
sh startup.sh
```

`startup.sh` comprueba si el preview ya está disponible y, cuando es necesario, inicia la aplicación de forma no bloqueante en el puerto `8080`.

## Comandos disponibles

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Inicia Vite en modo desarrollo en el puerto 8080 |
| `npm run build` | Genera la compilación de producción y ejecuta la migración configurada |
| `npm run preview` | Sirve la compilación para una revisión local |
| `npm run typecheck` | Comprueba los tipos de TypeScript sin emitir archivos |
| `npm run lint` | Ejecuta ESLint sobre el proyecto |
| `npm test` | Ejecuta las pruebas de scripts y de utilidades de la aplicación |
| `npm run check:auth` | Valida invariantes relacionadas con autenticación |
| `npm run format` | Formatea el código con Prettier |
| `npm run db:migrate` | Ejecuta las migraciones definidas para la capa de datos |

Una comprobación recomendada antes de publicar cambios es:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Actualizar el contenido del informe

Para cambiar la semana, los modelos o las señales editoriales, modifica `src/lib/informe-data.ts`. Cada señal utiliza la siguiente estructura conceptual:

```ts
type Signal = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  region: Region;
  models: ModelId[];
  source: SourceKind;
  sourceLabel: string;
};
```

Las señales se filtran en el cliente por región y modelo, y la búsqueda examina el título, el resumen, el detalle y los modelos asociados. Cuando no existen coincidencias, la interfaz muestra un estado vacío orientando al usuario a probar otros filtros.

## Despliegue y configuración

El workspace está preparado para un flujo de despliegue basado en Vercel. No se deben incluir secretos en el repositorio ni crear archivos `.env` dentro del workspace. Las variables de entorno deben configurarse en el entorno de ejecución correspondiente.

El proyecto conserva los recursos de plataforma ubicados en `public/__grok/`, el middleware de `server/` y los scripts de soporte de PWA. Estos archivos forman parte del contrato del workspace y no deben eliminarse al modificar la aplicación.

## Estado del proyecto

La versión actual presenta un **prototipo funcional del informe semanal** con datos editoriales definidos localmente, navegación por filtros y búsqueda, soporte responsive y estructura preparada para futuras integraciones de datos y autenticación.

## Licencia

Este repositorio no declara todavía una licencia open source. Antes de redistribuir el código, añade una licencia explícita y verifica las condiciones de uso de los recursos y dependencias incluidos.
