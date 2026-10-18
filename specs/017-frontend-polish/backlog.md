
## spec-writer · backlog
- [ ] Si algún chunk de pantalla (por ejemplo Métricas, con las gráficas) sigue pasando de 500 kB, partirlo más.

## plan · planner
- [ ] Si el chunk propio de Métricas (recharts) supera 500 kB, partirlo (fuera de alcance según la spec).
- [ ] Distinguir en el boundary un error de render de un fallo de descarga, si hiciera falta.
- [ ] Comentarios sin tilde y con voseo en router.tsx, router.test.tsx, AppLayout.tsx, ProtectedRoute.tsx y setup.ts (fuera de alcance; solo se corrigen los que se toquen).
- [ ] Valorar LazyMotion de motion si el chunk de entrada vuelve a crecer.

## tasks · task-breaker
- [ ] Si el chunk de entrada sigue por encima de 500 kB tras T-039, el implementer no debe tocar `vite.config.ts`. Debe informar del desglose y el orquestador lo escala (riesgo recogido en el plan).
- [ ] Anotar en el backlog, si hace falta, la separación del mensaje del error boundary entre fallo de descarga y error de render.
