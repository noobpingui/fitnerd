LOCAL_HOSTS: frozenset[str] = frozenset({"localhost", "127.0.0.1", "::1", "postgres"})
CONFIRM_PROMPT = "La base de datos NO es local. ¿Escribir en ella? [s/N]: "
AFFIRMATIVE_ANSWERS: frozenset[str] = frozenset({"s", "si", "sí", "y", "yes"})


def is_local_host(_host: str | None) -> bool:
    raise NotImplementedError("not implemented")


def confirm_remote_write() -> bool:
    raise NotImplementedError("not implemented")
