# QA-001 Runtime Validation

Fecha: 2026-07-02

## Alcance validado

- API local, Web local y rutas base del runtime.
- Health checks publicos y health check controlado de SQL Server.
- Smoke test local para login demo, sesion, metadata, listados seed y CRUD minimo del Master Data Engine cuando SQL Server esta disponible.
- Fallback local de catálogos cuando API o SQL Server no estan disponibles.

No se implementaron inventario real, compras, ventas, facturacion, POS, DGII ni modulos nuevos.

## Scripts

- `npm run smoke:local`: valida `GET /health`, `GET /version`, `GET /health/db`, login demo, `GET /auth/me`, metadata y listados de `customers`, `suppliers`, `items`, `categories` y `brands`, mas CRUD minimo soportado por el Master Data Engine.
- Si API o SQL Server no estan disponibles, el script falla con mensaje claro.

## Resultados locales

```text
npm install: OK
npm run typecheck: OK
npm run build: OK
npm run db:setup: FAIL - Login failed for user 'sa'.
npm run dev:api: OK
npm run dev:web: OK
npm run smoke:local: FAIL controlado - SQL Server unavailable for smoke.
```

Endpoints verificados con API local:

```text
GET /api/health: 200
GET /api/version: 200
GET /api/health/db: 503 controlado, {"success":false,"message":"Database unavailable","data":{"connected":false}}
```

## Evidencia frontend

Con API encendida pero SQL Server no disponible, las rutas:

```text
/master-data/customers
/master-data/suppliers
/master-data/items
/master-data/categories
/master-data/brands
```

mostraron Vista local, formulario y grid sin `Failed to fetch` y sin carga infinita.

Con API apagada, se verifico fallback local en `customers`, `items` y `brands`; la pantalla mostro `API no disponible`, `Vista local`, formulario y grid usable.

## Evidencia pendiente por ambiente

La validacion de catalogos con API real y datos seed requiere SQL Server local disponible con credenciales correctas en `.env`. En este ambiente `npm run db:setup` no pudo autenticar el usuario `sa`, por lo que no fue posible validar login demo, metadata autenticada, listados seed ni CRUD real contra base de datos.
