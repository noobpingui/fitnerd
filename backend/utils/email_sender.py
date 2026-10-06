import json
import urllib.error
import urllib.request
from dataclasses import dataclass


class EmailSendError(Exception):
    pass


@dataclass
class EmailMessage:
    sender: str
    to: str
    subject: str
    text: str
    html: str


class InMemoryTransport:
    """Transporte de tests: guarda los correos en memoria y puede simular fallos."""

    def __init__(self):
        self.outbox: list[EmailMessage] = []
        self.fail_with: Exception | None = None

    def send(self, message: EmailMessage) -> None:
        if self.fail_with is not None:
            raise self.fail_with
        self.outbox.append(message)

    def clear(self) -> None:
        self.outbox.clear()
        self.fail_with = None


class ResendTransport:
    """Envía el correo con la API HTTP de Resend (ADR-0014)."""

    URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str | None, timeout: int = 10):
        self.api_key = api_key
        self.timeout = timeout

    def send(self, message: EmailMessage) -> None:
        if not self.api_key:
            raise EmailSendError("Falta RESEND_API_KEY")

        body = json.dumps({
            "from": message.sender,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
            "html": message.html,
        }).encode("utf-8")
        request = urllib.request.Request(
            self.URL,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout):
                pass
        except urllib.error.HTTPError as exc:
            raise EmailSendError(f"Resend respondió con HTTP {exc.code}") from None
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise EmailSendError(f"No se pudo contactar a Resend: {type(exc).__name__}") from None


class ConsoleTransport:
    """Solo para desarrollo: escribe el correo en el log."""

    def __init__(self, logger):
        self.logger = logger

    def send(self, message: EmailMessage) -> None:
        self.logger.info("Correo para %s | %s\n%s", message.to, message.subject, message.text)


class EmailSender:

    def __init__(self):
        self.transport = None
        self.sender = None

    def init_app(self, app) -> None:
        backend = app.config["MAIL_BACKEND"]
        if backend == "resend":
            self.transport = ResendTransport(app.config.get("RESEND_API_KEY"))
        elif backend == "console":
            self.transport = ConsoleTransport(app.logger)
        elif backend == "memory":
            self.transport = InMemoryTransport()
        else:
            raise ValueError(f"MAIL_BACKEND desconocido: {backend}")
        self.sender = app.config["MAIL_FROM"]

    def send(self, to: str, subject: str, text: str, html: str) -> None:
        message = EmailMessage(sender=self.sender, to=to, subject=subject, text=text, html=html)
        self.transport.send(message)
