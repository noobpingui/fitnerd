# Idea original · 012-remove-catalog

Fecha: 2026-10-14

Eliminar del todo el catálogo de ejercicios (región → categoría → ejercicio), los favoritos y el plan semanal, que están ocultos desde el rediseño con CATALOG_ENABLED = false. Quitar del frontend las features exercises y weekly-plan, el interruptor CATALOG_ENABLED y sus usos (router, secciones, Navbar, BottomTabBar, AuthHero), y del backend sus rutas, servicios, repositorios, modelos, tests y el script migrate_catalog_to_prod.py. Las tablas body_regions, exercise_categories, exercises, exercise_favorites y weekly_plan_entries en local y en producción - borrarlas con una migración, con backup previo y actualizar la documentación. El resto de la app (perfil, métricas, macros, coach, auth) debe seguir funcionando igual.
