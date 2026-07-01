# API Modules

Cada modulo debe mantener separadas sus responsabilidades:

- `api`: rutas, controladores y DTOs.
- `application`: casos de uso y orquestacion.
- `domain`: entidades, reglas e invariantes.
- `infrastructure`: integraciones, repositorios y servicios externos.
- `database`: migraciones, modelos de persistencia o scripts propios del modulo.

No se debe acceder directamente a la estructura interna de otro modulo. Usar servicios de aplicacion, contratos publicos o eventos internos.

