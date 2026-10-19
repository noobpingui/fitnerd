// Servidor de prueba con estado (spec 020, REQ-004, NFR-002): simula la API de
// mediciones y de perfil, pero guarda lo que se registra durante la prueba y
// responde en consecuencia, en lugar de devolver respuestas fijadas de
// antemano. Aplica la regla de `_sync_profile_weight` del backend (spec 016,
// REQ-006): el peso del perfil sigue a la medición de peso de FECHA más
// reciente, con tolerancia de 0,05 kg, conversión a lb con KG_PER_LB, redondeo a
// 0,1 hacia arriba (half-up) y límites 30–300 kg / 66–660 lb. Nunca toca la red.
// Se conecta a los mocks de api.ts, por ejemplo:
//   listMock.mockImplementation(server.listBodyMetrics)
import type {
  BodyMetric,
  CreateBodyMetricPayload,
} from "@/features/body-metrics/types"
import type {
  ProfileResponse,
  SaveProfilePayload,
} from "@/features/profile/types"

// Mismas constantes que backend/services/body_metric_service.py.
const KG_PER_LB = 0.45359237
const SYNC_TOLERANCE_KG = 0.05
const WEIGHT_LIMITS = { kg: [30, 300], lb: [66, 660] } as const

export type FakeMetricsServer = {
  listBodyMetrics(): Promise<BodyMetric[]>
  createBodyMetric(payload: CreateBodyMetricPayload): Promise<BodyMetric>
  getProfile(): Promise<ProfileResponse>
  saveProfile(payload: SaveProfilePayload): Promise<ProfileResponse>
}

// Redondeo a 1 decimal, half-up (como `_round1` del servidor).
function round1(value: number): number {
  return Math.floor(value * 10 + 0.5) / 10
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createFakeMetricsServer(initial: {
  profile: ProfileResponse
  metrics: BodyMetric[]
}): FakeMetricsServer {
  let profile: ProfileResponse = clone(initial.profile)
  let metrics: BodyMetric[] = clone(initial.metrics)
  let nextId = 1

  // Deja el peso del perfil igual a la medición con peso de fecha más reciente.
  function syncProfileWeight() {
    if (!profile.profile) return
    const withWeight = metrics.filter((m) => m.weight !== null)
    if (withWeight.length === 0) return
    const latest = withWeight.reduce((a, b) =>
      b.recorded_at > a.recorded_at ? b : a
    )
    const latestKg = latest.weight as number
    const unit = profile.profile.weight_unit
    const profileKg =
      unit === "kg" ? profile.profile.weight : profile.profile.weight * KG_PER_LB
    if (Math.abs(latestKg - profileKg) <= SYNC_TOLERANCE_KG) return

    const value = unit === "kg" ? latestKg : latestKg / KG_PER_LB
    const [low, high] = WEIGHT_LIMITS[unit]
    profile = {
      ...profile,
      profile: {
        ...profile.profile,
        weight: Math.min(Math.max(round1(value), low), high),
      },
    }
  }

  return {
    async listBodyMetrics() {
      return clone(
        [...metrics].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
      )
    },

    async createBodyMetric(payload) {
      const recordedAt = payload.recorded_at as string
      const existing = metrics.find((m) => m.recorded_at === recordedAt)
      let saved: BodyMetric
      if (existing) {
        // Una sola medición por día: los valores nuevos sustituyen y los
        // ausentes se conservan.
        if (payload.weight !== undefined) existing.weight = payload.weight
        if (payload.body_fat_percentage !== undefined)
          existing.body_fat_percentage = payload.body_fat_percentage
        if (payload.muscle_mass_percentage !== undefined)
          existing.muscle_mass_percentage = payload.muscle_mass_percentage
        saved = existing
      } else {
        saved = {
          id: `fake-${nextId++}`,
          weight: payload.weight ?? null,
          body_fat_percentage: payload.body_fat_percentage ?? null,
          muscle_mass_percentage: payload.muscle_mass_percentage ?? null,
          notes: payload.notes ?? null,
          recorded_at: recordedAt,
        }
        metrics = [...metrics, saved]
      }
      syncProfileWeight()
      return clone(saved)
    },

    async getProfile() {
      return clone(profile)
    },

    async saveProfile(payload) {
      const { date_of_birth, ...serverProfile } = payload
      profile = {
        onboarding_completed: true,
        onboarding_completed_at:
          profile.onboarding_completed_at ?? "2026-10-12T12:00:00+00:00",
        date_of_birth,
        profile: serverProfile,
      }
      return clone(profile)
    },
  }
}
