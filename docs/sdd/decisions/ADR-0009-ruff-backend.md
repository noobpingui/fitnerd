# ADR-0009 — Añadir ruff como lint del backend

- **Estado:** Aceptada · 2026-09-23
- **Decidido por:** usuario

## Contexto
El backend no tiene ni lint ni typecheck (`00-discovery.md`), así que el `verifier` no tendría ningún gate estático en esa parte del repo.

## Decisión
- Añadir `ruff` en un `backend/requirements-dev.txt` nuevo. Así no entra en la imagen Docker de runtime.
- Añadir una configuración mínima en `backend/pyproject.toml`, con dos secciones: `[tool.ruff]` y `[tool.ruff.lint]`.
  - Reglas por defecto: `E` y `F`, más `I` para el orden de imports.
  - Longitud de línea: 100.
  - Se excluyen `migrations/` y `.venv/`.
- El `verifier` ejecuta `ruff check` **solo sobre los archivos .py cambiados en la rama** (`git diff --name-only main...HEAD`). El código existente no se toca ni se reformatea.
- Por ahora no se añade mypy: el tipado actual es parcial y generaría ruido.
- Momento de implementarlo: en la Fase 5, junto con la configuración del `verifier`, como archivos de configuración estrictamente necesarios para el harness.

## Consecuencias
- (+) El código nuevo del backend tendrá un gate estático desde la primera feature.
- (−) El CI todavía no ejecuta ruff. Añadirlo al workflow puede ser la primera feature real del flujo SDD, y así se evita tocar el CI fuera de él.
- (−) El usuario tendrá que ejecutar `pip install -r requirements-dev.txt` en su `.venv` una sola vez. La guía de uso lo incluirá entre los requisitos previos.
