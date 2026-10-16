# Tareas 015 — Migrar los formularios de onboarding y de datos físicos a react-hook-form con zod

- **Plan:** [plan.md](plan.md) (aprobado el 2026-10-16)

## Fase A0 — Andamiaje (implementer, modo scaffold)
Esqueletos con `throw new Error("not implemented");` y parámetros con prefijo `_` (Art. P1 frontend 5). `validation.ts` sigue intacto hasta la fase B.

- [ ] T-001 [REQ-001, REQ-003, REQ-004] (scaffold) Crear el módulo con los exports `genderSchema`, `heightUnitSchema`, `weightUnitSchema`, `activityLevelSchema`, `goalSchema`, `DOB_REQUIRED_MESSAGE`, `DOB_FUTURE_MESSAGE`, `DOB_AGE_RANGE_MESSAGE`, el tipo `PhysicalDataErrorKey`, `heightRangeMessage`, `weightRangeMessage`, `isHeightValid`, `isWeightValid`, `dateOfBirthMessage`, `physicalDataShape`, `addPhysicalDataIssues`, `makePhysicalDataSchema(_today?)` y `fieldMessages(_schema, _values)` con las firmas del plan 3.2; las funciones lanzan "not implemented" y las constantes de mensaje y los enums llevan su valor definitivo (no son lógica) — `frontend/src/features/onboarding/schemas.ts`
- [ ] T-002 [REQ-005, REQ-002] (scaffold) Añadir `makeProfileFormSchema(_today?)` (lanza "not implemented") y el tipo `ProfileFormErrorKey` — `frontend/src/features/profile/schemas.ts`
- [ ] T-003 [REQ-005, REQ-009] (scaffold) Añadir los tipos `BodyComposition` y `PhysicalDataFormValues` (solo tipos, sin runtime) — `frontend/src/features/profile/types.ts`

## Fase A — Tests (test-author)
Los marcadores nuevos llevan `// SDD: 015 REQ-… AC-…`. Los tests de caracterización (marcados "caracterización") describen comportamiento que ya existe y pueden pasar antes de implementar; el rojo legítimo lo dan los unitarios sobre los símbolos nuevos y los AC-003.5.

- [ ] T-010 [REQ-001, AC-001.1, AC-001.2, AC-001.3] (test) Esquema compartido: fecha de nacimiento válida en los límites 14 y 100 años, futura y fuera de rango, con hoy fijo `new Date(2026, 9, 11)` — `frontend/src/features/onboarding/schemas.test.ts`
- [ ] T-011 [REQ-002, AC-002.1] (test) Esquema compartido: fecha vacía da "Indica tu fecha de nacimiento" — `frontend/src/features/onboarding/schemas.test.ts`
- [ ] T-012 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (test) Traslado íntegro de los casos de `validation.test.ts` (Q1, Art. B5.3): mismos valores, mismo hoy fijo y mismas aserciones sobre `fieldMessages(makePhysicalDataSchema(TODAY), …)`, con los marcadores de la 006 con prefijo (`// SDD: 006 REQ-009 AC-009.1…AC-009.4`, `006 REQ-011 AC-011.4`) — `frontend/src/features/onboarding/schemas.test.ts`
- [ ] T-013 [REQ-003, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5] (test) Esquema compartido: clave `height` y mensajes en cm y ft/in (pulgadas vacías = 0, 12 in, decimales en ft o in) e invariante de que todo valor válido produce un cuerpo aceptado por `saveProfilePayloadSchema` — `frontend/src/features/onboarding/schemas.test.ts`
- [ ] T-014 [REQ-004, AC-004.1, AC-004.2, AC-004.3] (test) Esquema compartido: clave `weight` y mensajes en kg y lb, con decimales y vacío — `frontend/src/features/onboarding/schemas.test.ts`
- [ ] T-015 [REQ-005, REQ-002, AC-005.1, AC-005.2, AC-005.3, AC-002.1] (test) Esquema del perfil: grasa y músculo opcionales (claves `fat` y `muscle`) y herencia de las reglas compartidas (fecha vacía, altura y peso) — `frontend/src/features/profile/schemas.test.ts`
- [ ] T-016 [REQ-006, AC-006.1, AC-006.2, AC-006.3, AC-006.4, AC-003.5] (test) Conversión de unidades: 175 cm ↔ 5 ft 9 in, 182 cm → 6 ft 0 in, 72 kg → 158.7 lb, 160 lb → 72.6 kg, valores no válidos solo cambian la unidad y `5.5` ft no se convierte — `frontend/src/features/onboarding/units.test.ts`
- [ ] T-017 [REQ-001, AC-001.1, AC-001.2, AC-001.3, AC-001.4] (test) Onboarding, pregunta de la fecha: límites válidos, futura, 13 y 101 años y campo vacío sin mensaje, con "Siguiente" habilitado o no (caracterización) — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [ ] T-018 [REQ-003, REQ-004, AC-003.2, AC-003.4, AC-003.5, AC-004.2, AC-004.3] (test) Onboarding: altura y peso no válidos (incluido `5.5` ft) dejan "Siguiente" deshabilitado sin ningún texto "Entre …"; AC-003.5 es el rojo legítimo — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [ ] T-019 [REQ-003, REQ-004, AC-003.1, AC-003.3, AC-004.1] (test) Onboarding: valores válidos de altura (cm y 5 ft sin pulgadas) y peso habilitan "Siguiente" (caracterización) — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [ ] T-020 [REQ-006, AC-006.1, AC-006.4] (test) Onboarding: conversión de unidades por la interfaz, valor válido y no válido (caracterización) — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [ ] T-021 [REQ-007, AC-007.1, AC-007.2, AC-007.3, AC-007.4, AC-007.5] (test) Onboarding: avance automático en género, Enter en la altura, "Atrás" conserva `175` con "Siguiente" habilitado, meta sin avance automático y fecha prerrellenada (`1995-05-20` válida; `1900-01-01` con aviso visible sin tocar) (caracterización) — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [ ] T-022 [REQ-008, AC-008.1, AC-008.2, AC-008.3] (test) Onboarding: cuerpo enviado con ft/lb (pulgadas `0`, sin `age`) y con cm/kg, y un solo envío con "Guardando…" deshabilitado al pulsar dos veces (caracterización) — `frontend/src/features/onboarding/pages/OnboardingPage.test.tsx`
- [ ] T-023 [REQ-001, REQ-002, AC-001.1, AC-001.2, AC-001.3, AC-002.1, AC-002.2] (test) Perfil: fecha válida en los límites, futura, fuera de rango y vacía con `aria-invalid="true"`, el mensaje aparece y desaparece y "Guardar cambios" se deshabilita y habilita — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-024 [REQ-003, REQ-004, AC-003.1, AC-003.2, AC-003.3, AC-003.4, AC-003.5, AC-004.1, AC-004.2, AC-004.3] (test) Perfil: mensajes "Entre 100 y 250 cm", "Entre 3 y 8 ft" (incluido `5.5` ft, rojo legítimo), "Entre 30 y 300 kg" y "Entre 66 y 660 lb" con "Guardar cambios" deshabilitado — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-025 [REQ-005, AC-005.1, AC-005.2, AC-005.3] (test) Perfil: grasa y músculo opcionales, valores límite sin mensaje y fuera de rango con "Entre 3 y 60 %" / "Entre 10 y 70 %" (caracterización) — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-026 [REQ-006, AC-006.3, AC-006.1] (test) Perfil: conversión de unidades por la interfaz (`72` kg → `158.7` lb) (caracterización) — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-027 [REQ-009, AC-009.1, AC-009.2, AC-009.3, AC-009.4] (test) Perfil: sin cambios no hay "Descartar", descartar restaura, solo unidad de peso envía `weight_unit: "lb"` sin medición, y músculo `40` con grasa `20` envía la medición sin `body_fat_percentage` (caracterización) — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-028 [REQ-009, AC-009.5, AC-009.6] (test) Perfil: "Cambios guardados" desaparece a los 3 s o al editar, y segunda medición `79.5` tras guardar `80` (caracterización) — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-029 [REQ-010, AC-010.1, AC-010.2] (test) Perfil: aviso de fecha ya visible al cargar un perfil sin fecha y "Entre 30 y 300 kg" visible al escribir `500` sin guardar (caracterización) — `frontend/src/features/profile/pages/ProfilePage.test.tsx`
- [ ] T-030 [REQ-001] (test) Eliminar el archivo de tests del módulo antiguo, cuyos casos ya están trasladados íntegros por T-012 (traslado, no borrado; Q1, Art. B5.3) — `frontend/src/features/onboarding/validation.test.ts`

## Fase B — Implementación (implementer)
Orden: reglas → unidades → tipos y esquema del perfil → formularios → limpieza.

- [ ] T-040 [REQ-001, REQ-002, REQ-003, REQ-004] (impl) Implementar las reglas compartidas: `dateOfBirthMessage` (portada de `dateOfBirthError`, vacía = `DOB_REQUIRED_MESSAGE`), `isHeightValid` (ft/in enteros), `isWeightValid`, mensajes de rango, `physicalDataShape`, `addPhysicalDataIssues`, `makePhysicalDataSchema` y `fieldMessages` — `frontend/src/features/onboarding/schemas.ts`
- [ ] T-041 [REQ-003, REQ-006] (impl) Cambiar el import de `isHeightValid`/`isWeightValid` a `schemas.ts` — `frontend/src/features/onboarding/units.ts`
- [ ] T-042 [REQ-005, REQ-009] (impl) Completar `BodyComposition` y `PhysicalDataFormValues` (moviendo `BodyComposition` desde `PhysicalDataForm.tsx`) — `frontend/src/features/profile/types.ts`
- [ ] T-043 [REQ-002, REQ-005] (impl) Implementar `makeProfileFormSchema` con grasa y músculo (`FAT_LIMITS`, `MUSCLE_LIMITS`) y pasar `profileResponseSchema`/`saveProfilePayloadSchema` a los enums compartidos sin cambiar su comportamiento — `frontend/src/features/profile/schemas.ts`
- [ ] T-044 [REQ-001, REQ-003, REQ-004, REQ-006, REQ-007, REQ-008] (impl) Migrar el asistente a `useForm` + `zodResolver` con validez de cada paso desde `fieldMessages`, aviso de fecha sin el de vacía, `handleSubmit` con guardia de envío único — `frontend/src/features/onboarding/pages/OnboardingPage.tsx`
- [ ] T-045 [REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-009, REQ-010] (impl) Migrar el formulario Datos físicos a `useForm` + `zodResolver` con mensajes síncronos desde el esquema, `saved` + `reset`, `onSave` con la secuencia actual y sin `optionalInRange` — `frontend/src/features/profile/components/PhysicalDataForm.tsx`
- [ ] T-046 [REQ-001] (impl) Eliminar el módulo de validación propio, ya sin uso — `frontend/src/features/onboarding/validation.ts`

## Matriz de cobertura
| REQ / NFR | AC | Tareas test | Tareas impl |
|---|---|---|---|
| REQ-001 | AC-001.1 | T-010, T-012, T-017, T-023 | T-040, T-044, T-045 |
| REQ-001 | AC-001.2 | T-010, T-012, T-017, T-023 | T-040, T-044, T-045 |
| REQ-001 | AC-001.3 | T-010, T-012, T-017, T-023 | T-040, T-044, T-045 |
| REQ-001 | AC-001.4 | T-012, T-017 | T-040, T-044 |
| REQ-002 | AC-002.1 | T-011, T-015, T-023 | T-040, T-043, T-045 |
| REQ-002 | AC-002.2 | T-023 | T-045 |
| REQ-003 | AC-003.1 | T-013, T-019, T-024 | T-040, T-044, T-045 |
| REQ-003 | AC-003.2 | T-013, T-018, T-024 | T-040, T-044, T-045 |
| REQ-003 | AC-003.3 | T-013, T-019, T-024 | T-040, T-044, T-045 |
| REQ-003 | AC-003.4 | T-013, T-018, T-024 | T-040, T-044, T-045 |
| REQ-003 | AC-003.5 | T-013, T-016, T-018, T-024 | T-040, T-041, T-044, T-045 |
| REQ-004 | AC-004.1 | T-014, T-019, T-024 | T-040, T-044, T-045 |
| REQ-004 | AC-004.2 | T-014, T-018, T-024 | T-040, T-044, T-045 |
| REQ-004 | AC-004.3 | T-014, T-018, T-024 | T-040, T-044, T-045 |
| REQ-005 | AC-005.1 | T-015, T-025 | T-043, T-045 |
| REQ-005 | AC-005.2 | T-015, T-025 | T-043, T-045 |
| REQ-005 | AC-005.3 | T-015, T-025 | T-043, T-045 |
| REQ-006 | AC-006.1 | T-016, T-020, T-026 | T-041, T-044, T-045 |
| REQ-006 | AC-006.2 | T-016 | T-041 |
| REQ-006 | AC-006.3 | T-016, T-026 | T-041, T-045 |
| REQ-006 | AC-006.4 | T-016, T-020 | T-041, T-044 |
| REQ-007 | AC-007.1 | T-021 | T-044 |
| REQ-007 | AC-007.2 | T-021 | T-044 |
| REQ-007 | AC-007.3 | T-021 | T-044 |
| REQ-007 | AC-007.4 | T-021 | T-044 |
| REQ-007 | AC-007.5 | T-021 | T-044 |
| REQ-008 | AC-008.1 | T-022 | T-044 |
| REQ-008 | AC-008.2 | T-022 | T-044 |
| REQ-008 | AC-008.3 | T-022 | T-044 |
| REQ-009 | AC-009.1 | T-027 | T-045 |
| REQ-009 | AC-009.2 | T-027 | T-045 |
| REQ-009 | AC-009.3 | T-027 | T-045 |
| REQ-009 | AC-009.4 | T-027 | T-045 |
| REQ-009 | AC-009.5 | T-028 | T-045 |
| REQ-009 | AC-009.6 | T-028 | T-045 |
| REQ-010 | AC-010.1 | T-029 | T-045 |
| REQ-010 | AC-010.2 | T-029 | T-045 |
