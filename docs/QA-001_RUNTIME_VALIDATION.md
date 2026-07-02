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
npm run db:setup: OK contra SSORIANO\SQLEXPRESS.
npm run dev:api: OK
npm run dev:web: OK
npm run smoke:local: OK
```

Endpoints verificados con API local:

```text
GET /api/health: 200
GET /api/version: 200
GET /api/health/db: 200, {"success":true,"data":{"connected":true}}
```

## Bugs encontrados y corregidos

- El runtime Node no soportaba instancia nombrada de SQL Server. Se agrego soporte para `SQLSERVER_INSTANCE` y para `SQLSERVER_HOST` con formato `SERVIDOR\INSTANCIA`.
- La migracion `012_domain_event_processor.sql` fallaba en SQL Server al concatenar `QUOTENAME()` dentro de `EXEC(...)`. Se cambio a SQL dinamico con `sp_executesql`.
- Las rutas de autenticacion existian pero no estaban montadas en `/api/auth`; se agrego `authRouter` al router principal.
- La validacion de parametros usaba `z.uuid()`, que rechaza algunos `uniqueidentifier` validos devueltos por SQL Server. Se cambio a validacion GUID compatible con SQL Server.
- El smoke reenviaba campos no editables devueltos por SQL al actualizar cliente; ahora envia solo payload editable.

## Evidencia frontend

Con API encendida y SQL Server disponible, las rutas:

```text
/master-data/customers
/master-data/suppliers
/master-data/items
/master-data/categories
/master-data/brands
```

mostraron `API conectada`, formulario, grid y datos seed reales (`CLI-DEMO`, `SUP-DEMO`, `ART-DEMO`, `GENERAL`, `DOBLES`) sin `Failed to fetch` y sin carga infinita.

Con API apagada, se verifico fallback local en `customers`, `items` y `brands`; la pantalla mostro `API no disponible`, `Vista local`, formulario y grid usable.
