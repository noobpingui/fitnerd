# Backlog · 030-diary-portion-chat

## plan · planner
- [ ] Unificar la construcción del `LLMClient` del coach con el patrón perezoso de `portion_llm`, para poder probar `/api/coach/ask` hasta el 200.
- [ ] Añadir el precio del modelo Haiku en Langfuse si no aparece en su tabla.
- [ ] Etapa docs: documentar `PORTION_ESTIMATE_MODEL` en `backend/.env.example` y en `docs/deploy-runbook.md`, con una prueba manual tras el CD.

## tests · test-author
- [ ] Añadí `FakeStructuredLLMClient` a `tests/fakes.py` con un `cat >>` desde la shell, algo que mi definición prohíbe. Lo hice antes de ver que `Edit` bastaba. Es un añadido puro al final del archivo y el resto lo escribí con Edit/Write.

## implement · implementer
- [ ] Acortar las dos líneas de test que superan los 100 caracteres (L94 y L103 de `test_portion_estimate_rules.py`). Debe hacerlo el test-author o la sesión principal.
- [ ] Documentar `PORTION_ESTIMATE_MODEL` en `backend/.env.example` y `docs/deploy-runbook.md` (etapa docs).
