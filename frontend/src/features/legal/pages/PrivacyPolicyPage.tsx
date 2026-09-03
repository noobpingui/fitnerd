import { LegalPageLayout } from "@/features/legal/components/LegalPageLayout"

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Política de privacidad" updatedAt="2 de septiembre de 2026">
      <p>
        fitnerd es un proyecto personal, desarrollado y
        mantenido por una sola persona - no una empresa con un equipo
        legal dedicado. Aun así, nos tomamos en serio proteger tus datos.
        Esta página explica, en lenguaje simple, qué información
        recolectamos, para qué la usamos y con quién se comparte.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Qué información recolectamos
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Datos de tu cuenta:</strong> email, nombre, apellido y
            fecha de nacimiento. Si te registrás con email/contraseña, tu
            contraseña se guarda de forma encriptada (hasheada) - nunca en
            texto plano, ni siquiera nosotros podemos verla.
          </li>
          <li>
            <strong>Google Sign-In:</strong> si iniciás sesión con Google,
            recibimos tu nombre, email y foto de perfil directamente de
            Google - no tu contraseña de Google ni acceso a tu cuenta más
            allá de eso.
          </li>
          <li>
            <strong>Métricas corporales:</strong> peso, altura, y demás
            datos que decidas registrar vos mismo en la sección de
            métricas.
          </li>
          <li>
            <strong>Actividad en la app:</strong> tus ejercicios
            favoritos, tu plan semanal, y las preguntas que le hacés al AI
            Coach (para poder responderte y por límites de uso).
          </li>
          <li>
            <strong>Feedback:</strong> lo que escribas en el formulario de
            feedback dentro de la app.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Para qué usamos tu información
        </h2>
        <p>
          Únicamente para que la app funcione: autenticarte, mostrarte tu
          catálogo/favoritos/plan, guardar tu progreso, y darle contexto
          al AI Coach para que te responda. No usamos tus datos con fines
          publicitarios, ni los vendemos ni los compartimos con terceros
          para marketing.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Con quién se comparte
        </h2>
        <p>Algunos datos pasan por proveedores externos, necesarios para que la app funcione:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Anthropic (Claude):</strong> las preguntas que le
            hacés al AI Coach se envían a Anthropic para generar la
            respuesta.
          </li>
          <li>
            <strong>Google:</strong> si usás Google Sign-In, para
            verificar tu identidad.
          </li>
          <li>
            <strong>Supabase, Vercel y AWS:</strong> son quienes alojan la
            base de datos, el frontend y el backend de la app,
            respectivamente - la infraestructura técnica detrás de
            fitnerd.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Seguridad</h2>
        <p>
          Toda la comunicación entre tu navegador y nuestros servidores
          viaja encriptada (HTTPS). Las contraseñas se guardan hasheadas,
          nunca en texto plano. Aun así, ningún sistema es 100% infalible
          - usá una contraseña que no reutilices en otros sitios
          importantes.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Tus derechos</h2>
        <p>
          Podés pedir que eliminemos tu cuenta y todos tus datos en
          cualquier momento, escribiendo a{" "}
          <a
            href="mailto:albertofallas93@gmail.com"
            className="text-primary underline-offset-4 hover:underline"
          >
            albertofallas93@gmail.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Cambios a esta política</h2>
        <p>
          Si esta política cambia de forma importante, se va a reflejar
          en esta misma página con una nueva fecha de actualización.
        </p>
      </section>
    </LegalPageLayout>
  )
}
