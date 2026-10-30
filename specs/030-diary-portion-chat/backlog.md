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

## verify · verifier
- [ ] backend/tests/test_services/test_llm_client.py L27, L41, L55, L66 usan marcadores sin el número de la spec (`SDD: REQ-004 AC-004.1`, `AC-004.4`, `AC-005.3`); son preexistentes, fuera del diff, y AC-004.4 no existe en la spec 030. Revisar en una tarea de limpieza, no en esta feature.

## review · reviewer
- [ ] F1 (MENOR, test-author): FakeStructuredLLMClient se añadió a backend/tests/fakes.py con `cat >>` desde la shell, algo que el Art. B2.4 prohíbe. Lo declaró él mismo y no hay que rehacerlo; se anota para que el usuario lo vea en el gate.
- [ ] F2 (MENOR, implementer): en backend/utils/llm_client.py:113, el comentario nuevo dice «configuracion» sin tilde (Art. P2.General.1).
- [ ] F3 (NIT, test-author): ningún test comprueba que LLMClient.__init__ pase timeout y max_retries a anthropic.Anthropic.
- [ ] F4 (NIT, implementer): en backend/utils/llm_client.py:55, la anotación de retorno va entre comillas sin necesidad.
- [ ] F5 (NIT, test-author): el test de la nota de 180 caracteres (test_portion_estimate_rules.py:215) no ejercita el rstrip tras recortar.
- [ ] F6 (NIT, planner): no hay un límite global de tamaño del cuerpo JSON (MAX_CONTENT_LENGTH). Afecta a todos los endpoints JSON, no solo a este.
- [ ] Pendiente de la sesión principal: aceptar ADR-0037, que sigue en «Propuesta», con la aprobación del usuario (Art. P5.2).

## plan (rework desde review) · planner
- [ ] Unificar también `_build_progress_analysis_service()` (body_metric_routes) con un LazyLLMClient.
- [ ] Hacer que RateLimiter ponga incr y expire en una sola operación (pipeline o SET NX EX) para que la clave nunca quede sin caducidad.
- [ ] Decidir si el coach y el análisis de foto también deben fallar cerrados (503) cuando Redis no está disponible; hoy dan 500.
- [ ] Paso manual: añadir el precio de Haiku en Langfuse si no aparece en su tabla (etapa docs, runbook).
- [ ] Etapa docs: documentar PORTION_ESTIMATE_MODEL en backend/.env.example y docs/deploy-runbook.md.
- [ ] Sesión principal: aceptar ADR-0037 con la aprobación del usuario (P5.2).
