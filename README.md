# Doble S ERP

Doble S ERP sera un ERP SaaS moderno, modular, multiempresa y multiusuario, preparado para operar con reglas fiscales de Republica Dominicana y adaptable a distintos tipos de negocio.

## Stack oficial

- Backend: Node.js + Express + TypeScript.
- Frontend: React + Vite + TypeScript.
- Base de datos: SQL Server.
- Autenticacion: JWT.
- Arquitectura: modular monolith SaaS.

## Backend base

La API inicial incluye:

- Express con TypeScript.
- Seguridad HTTP basica.
- JWT.
- Conexion preparada para SQL Server.
- Middleware de contexto tenant/empresa.
- Auditoria tecnica de solicitudes.
- Migracion inicial SaaS en `database/sqlserver/migrations`.

No contiene modulos grandes de negocio todavia.

## Ejecutar backend

1. Instalar dependencias:

```bash
npm install
```

2. Copiar `.env.example` a `.env` y completar las variables reales.

3. Ejecutar la migracion inicial en SQL Server:

```text
database/sqlserver/migrations/001_initial_saas_foundation.sql
```

4. Iniciar la API:

```bash
npm run dev:api
```

5. Verificar salud:

```text
GET http://localhost:3000/health
```

## Fase 1

Detalle de la fundacion SaaS implementada:

- [Fase 1 - Fundacion SaaS](docs/PHASE_1_FOUNDATION.md)
- [Fase 1.1 - Endurecimiento de Fundacion SaaS](docs/PHASE_1_1_FOUNDATION_HARDENING.md)
