"""Consolidación de mediciones duplicadas por usuario y día (spec 008, ADR-0020).

MÓDULO CONGELADO: lo usa una migración de Alembic, así que su SQL no debe
cambiar una vez aplicada. Si hace falta otra lógica, se crea un módulo nuevo.
"""

from sqlalchemy import text

# La fila que se conserva es la registrada más tarde del grupo; cada columna
# toma, por separado, el valor no nulo más reciente del grupo.
_UPDATE_KEPT_ROW = text(
    """
    UPDATE public.body_metrics AS keep
    SET
        weight = (
            SELECT d.weight FROM public.body_metrics d
            WHERE d.user_id = keep.user_id AND d.recorded_at = keep.recorded_at
              AND d.weight IS NOT NULL
            ORDER BY d.created_at DESC, d.id DESC LIMIT 1
        ),
        body_fat_percentage = (
            SELECT d.body_fat_percentage FROM public.body_metrics d
            WHERE d.user_id = keep.user_id AND d.recorded_at = keep.recorded_at
              AND d.body_fat_percentage IS NOT NULL
            ORDER BY d.created_at DESC, d.id DESC LIMIT 1
        ),
        muscle_mass_percentage = (
            SELECT d.muscle_mass_percentage FROM public.body_metrics d
            WHERE d.user_id = keep.user_id AND d.recorded_at = keep.recorded_at
              AND d.muscle_mass_percentage IS NOT NULL
            ORDER BY d.created_at DESC, d.id DESC LIMIT 1
        ),
        notes = (
            SELECT d.notes FROM public.body_metrics d
            WHERE d.user_id = keep.user_id AND d.recorded_at = keep.recorded_at
              AND d.notes IS NOT NULL
            ORDER BY d.created_at DESC, d.id DESC LIMIT 1
        )
    WHERE keep.id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id, recorded_at
                       ORDER BY created_at DESC, id DESC
                   ) AS rn,
                   COUNT(*) OVER (PARTITION BY user_id, recorded_at) AS total
            FROM public.body_metrics
        ) ranked
        WHERE ranked.rn = 1 AND ranked.total > 1
    )
    """
)

_DELETE_OTHERS = text(
    """
    DELETE FROM public.body_metrics
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id, recorded_at
                       ORDER BY created_at DESC, id DESC
                   ) AS rn
            FROM public.body_metrics
        ) ranked
        WHERE ranked.rn > 1
    )
    """
)


def consolidate_duplicate_body_metrics(connection):
    connection.execute(_UPDATE_KEPT_ROW)
    connection.execute(_DELETE_OTHERS)
