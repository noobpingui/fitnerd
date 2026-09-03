import { LegalPageLayout } from "@/features/legal/components/LegalPageLayout"

export function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Términos de servicio" updatedAt="2 de septiembre de 2026">
      <p>
        fitnerd es un proyecto personal, ofrecido de forma
        gratuita y "tal cual" (as-is), sin garantías formales. Al usar la
        app, aceptás estos términos.
      </p>

      <section>
        <h2 className="mb-2 text-lg font-semibold">
          No es asesoría médica
        </h2>
        <p>
          El catálogo de ejercicios y las respuestas del AI Coach son
          información general con fines educativos - no reemplazan el
          consejo de un profesional de la salud, entrenador certificado o
          médico. Consultá a un profesional antes de empezar cualquier
          programa de ejercicio, especialmente si tenés alguna condición
          médica preexistente. Vos sos responsable de las decisiones que
          tomes sobre tu entrenamiento y tu salud.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Tu cuenta</h2>
        <p>
          Sos responsable de mantener segura tu contraseña. La
          información que nos das al registrarte (email, fecha de
          nacimiento, etc.) debe ser real y tuya.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Uso aceptable</h2>
        <p>
          Pedimos que uses la app de buena fe - no intentes abusar del AI
          Coach (por ejemplo, saltarte los límites de uso), ni usar la
          app para nada que no sea su propósito: entrenar de forma
          informada.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Disponibilidad</h2>
        <p>
          Al ser un proyecto personal, no hay garantía de disponibilidad
          continua (uptime) ni de soporte formal. La app puede tener
          interrupciones o cambios sin aviso previo.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Cierre de cuenta</h2>
        <p>
          Podés pedir que se elimine tu cuenta en cualquier momento (ver{" "}
          <a href="/privacy" className="text-primary underline-offset-4 hover:underline">
            política de privacidad
          </a>
          ). Nos reservamos el derecho de suspender cuentas que hagan un
          uso indebido de la app.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Cambios a estos términos</h2>
        <p>
          Si estos términos cambian de forma importante, se va a reflejar
          en esta misma página con una nueva fecha de actualización.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Contacto</h2>
        <p>
          Dudas o consultas:{" "}
          <a
            href="mailto:albertofallas93@gmail.com"
            className="text-primary underline-offset-4 hover:underline"
          >
            albertofallas93@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPageLayout>
  )
}
