LOCAL_HOSTS: frozenset[str] = frozenset({"localhost", "127.0.0.1", "::1", "postgres"})
CONFIRM_PROMPT = "La base de datos NO es local. ¿Escribir en ella? [s/N]: "
AFFIRMATIVE_ANSWERS: frozenset[str] = frozenset({"s", "si", "sí", "y", "yes"})


def is_local_host(host: str | None) -> bool:
    # Ante la duda (sin host, host desconocido) se trata como no local.
    return host is not None and host.lower() in LOCAL_HOSTS


def confirm_remote_write() -> bool:
    try:
        answer = input(CONFIRM_PROMPT)
    except EOFError:
        return False
    return answer.strip().lower() in AFFIRMATIVE_ANSWERS
