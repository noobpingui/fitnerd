# Idea original · 033-profile-first-name

2026-11-02T20:27:02.039Z

El registro deja de pedir la fecha de nacimiento (queda solo en el onboarding);
/profile muestra y permite editar first_name, sin permitir vaciarlo; /home saluda con «Hola de nuevo {first_name}». Decisiones ya tomadas: /register ignora date_of_birth si llega; first_name usa la regla del registro (1 a 100 caracteres, sin espacios en los extremos) compartida; si first_name falta, /profile lo muestra vacío y exige valor al guardar sin bloquear acceso ni onboarding; /home saluda «Hola de nuevo» a secas si falta; GET/PUT /api/profile incluyen first_name, opcional en el PUT (si viene no puede estar vacío, si no viene no se toca); last_name fuera de alcance; sin migración ni variables nuevas.
