# Mentevia Hub · LAB IA Aplicada

Aplicación para facilitar sesiones en vivo de aprendizaje aplicado de IA. Coordina las vistas de facilitación, presentación y participantes para recorrer actividades, registrar retos, agruparlos, conformar equipos y construir Tarjetas Reto.

## Qué incluye

- Sesión en vivo con momentos, subsecciones y navegación sincronizada.
- Vistas diferenciadas para facilitación, presentación y participantes.
- Muro de retos, agrupación asistida, equipos y Tarjetas Reto.
- Panel administrativo **Datos del LAB**.
- Integración con Google Sheets mediante Google Apps Script para participantes, retos, clústers, equipos, ejercicios de *Aprende a pedir* y Tarjetas Reto.
- Código del endpoint de Apps Script en [apps-script/Code.gs](apps-script/Code.gs).

## Arquitectura

```text
Sitio web (React / Vinext)
        │
        ├── Google Apps Script API ── Google Sheets
        │
        └── Estado y configuración de la experiencia (D1)
```

Las credenciales nunca forman parte del repositorio. El sitio lee la URL del endpoint y la clave desde variables de entorno configuradas en el proveedor de hosting. Apps Script obtiene su clave desde la propiedad `LAB_API_KEY`.

## Tecnologías

- React 19 y TypeScript
- Vinext / Vite
- Cloudflare Workers y D1
- Google Apps Script y Google Sheets
- Drizzle ORM
- Lucide React

## Ejecutar localmente

### Requisitos

- Node.js 22.13 o superior
- npm

### Instalación

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

### Compilar

```bash
npm run build
```

## Variables de entorno

Para conectar el sitio con la base operativa, configura estas variables únicamente en el entorno seguro de hosting:

```text
LAB_SHEET_ENDPOINT=
LAB_SHEET_API_KEY=
```

No subas archivos `.env`, claves de Apps Script ni tokens de acceso. El archivo `.gitignore` ya excluye esas rutas.

## Apps Script

El archivo [apps-script/Code.gs](apps-script/Code.gs) contiene el endpoint que atiende:

- `session_snapshot`
- `prompt_exercise`
- `challenge_card`
- `sync_session_data`
- operaciones administrativas de crear, editar, eliminar y restablecer

Para instalarlo, pégalo en el proyecto de Apps Script vinculado a la hoja operativa y configura la Script Property `LAB_API_KEY`. La URL desplegada y las claves se administran fuera de este repositorio.

## Estructura principal

```text
app/                 interfaz y rutas API
apps-script/         endpoint para Google Sheets
components/          componentes reutilizables
db/                  acceso y esquema de D1
lib/                 lógica de sesión, equipos e integración operativa
drizzle/             migraciones de D1
public/              recursos estáticos
```

## Estado del proyecto

Este repositorio contiene el código fuente de la aplicación. Los datos operativos de sesiones y participantes se administran fuera del repositorio en la base operativa configurada para cada entorno.
