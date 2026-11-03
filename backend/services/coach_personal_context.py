from dataclasses import dataclass
from datetime import date
from typing import Any

from utils.clock import utc_now

NAME_PLACEHOLDER = "[nombre]"
MAX_MACRO_GRAMS = 2000
PERSONAL_CONTEXT_OPEN_TAG = "<datos_del_usuario>"
PERSONAL_CONTEXT_CLOSE_TAG = "</datos_del_usuario>"


@dataclass(frozen=True)
class CoachMacros:
    maintenance_kcal: int
    target_kcal: int
    protein_g: int
    carbs_g: int
    fat_g: int


@dataclass(frozen=True)
class ClientCoachContext:
    today: date
    macros: CoachMacros
    indicators: dict | None
    pace_status: str | None


@dataclass(frozen=True)
class PersonalContext:
    first_name: str | None
    profile: Any | None
    age: int | None
    client: ClientCoachContext | None


def parse_use_personal_context(_value: Any) -> bool:
    raise NotImplementedError("not implemented")


def parse_client_context(_data: Any, _server_today: date) -> ClientCoachContext | None:
    raise NotImplementedError("not implemented")


def sanitize_first_name(_value: Any) -> str | None:
    raise NotImplementedError("not implemented")


def build_personal_context_block(_context: PersonalContext) -> str:
    raise NotImplementedError("not implemented")


def redact_name(_value: Any, _first_name: str | None) -> Any:
    raise NotImplementedError("not implemented")


class CoachPersonalContextReader:
    def __init__(self, user_repository, user_profile_repository, clock=utc_now):
        self.user_repository = user_repository
        self.user_profile_repository = user_profile_repository
        self.clock = clock

    def read(self, _user_id: Any, _client_data: Any) -> PersonalContext:
        raise NotImplementedError("not implemented")
