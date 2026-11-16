# ADR-008: Calidad, lint, formato y puertas de CI

- **Estado:** Aceptado
- **Fecha:** 2026-11-15
- **Contexto:** Fase 4.4 del plan de ejecución.

## Contexto

El repositorio ya tenía `strict: true` en TypeScript y un pipeline de CI que ejecutaba `typecheck`, tests y build. Sin embargo:

- No existía una configuración de ESLint; `npm run lint` no ejecutaba ninguna regla.
- No había formato automatizado, por lo que el estilo dependía de cada editor.
- Los tests de frontend eran un placeholder (`exit 0`).
- La verificación de integración vivía en un script temporal fuera del repositorio.

## Decisión

1. **ESLint flat config en la raíz** (`eslint.config.mjs`) con `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `globals` y reglas de React Hooks para `apps/web`.
2. **Prettier** como única herramienta de formato (`.prettierrc`, `.prettierignore`), con scripts `format` y `format:check` en la raíz y en los workspaces.
3. **Vitest + React Testing Library + jsdom** para el frontend, reemplazando el placeholder por pruebas reales de `apiClient`, `AuthContext`, `zodResolver` y `DisbursementForm`.
4. **Separación estricta de suites:** `npm run test` ejecuta solo pruebas unitarias y de fundación; `npm run test:integration` levanta PostgreSQL, aplica migraciones, siembra y arranca la API compilada.
5. **CI bloqueante:** `format:check`, `lint`, `typecheck`, tests unitarios, build e integración contra PostgreSQL 16 como servicio. Los escaneos de seguridad (Gitleaks, Semgrep, `npm audit`) continúan como informativos hasta completar su triage.

## Consecuencias

- Un cambio con errores de lint, formato, tipos o tests no puede integrarse.
- Los tests de integración no dependen de Docker local: usan `docker-compose.test.yml` en desarrollo y un servicio de CI en GitHub Actions.
- Las advertencias actuales de ESLint (variables no usadas en código legado) no bloquean el pipeline; se documentan como deuda menor y no como excepción permanente.
- El rate limiter en memoria se mantiene aceptado para una instancia; si el sistema escala horizontalmente deberá migrarse a un almacén compartido.

## Alternativas consideradas

- **Solo Prettier, sin ESLint:** descartado porque no detecta hooks mal usados, imports sin usar ni patrones peligrosos.
- **Testcontainers para integración:** descartado por requerir Docker-in-Docker en CI y mayor tiempo de arranque. El servicio PostgreSQL de GitHub Actions es equivalente y más simple.
- **Mantener el script temporal de integración:** descartado por no ser reproducible, no versionado y no bloqueante.
