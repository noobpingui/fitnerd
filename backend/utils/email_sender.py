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

    def __init__(self):
        self.outbox: list[EmailMessage] = []
        self.fail_with: Exception | None = None

    def send(self, _message: EmailMessage) -> None:
        raise NotImplementedError

    def clear(self) -> None:
        raise NotImplementedError


class ResendTransport:

    def __init__(self, api_key: str | None, timeout: int = 10):
        self.api_key = api_key
        self.timeout = timeout

    def send(self, _message: EmailMessage) -> None:
        raise NotImplementedError


class ConsoleTransport:

    def __init__(self, logger):
        self.logger = logger

    def send(self, _message: EmailMessage) -> None:
        raise NotImplementedError


class EmailSender:

    def __init__(self):
        self.transport = None
        self.sender = None

    def init_app(self, _app) -> None:
        raise NotImplementedError

    def send(self, _to: str, _subject: str, _text: str, _html: str) -> None:
        raise NotImplementedError
