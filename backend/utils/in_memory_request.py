"""Petición de Flask que guarda los archivos subidos en memoria (spec 024)."""

import io

import flask


class InMemoryUploadRequest(flask.Request):
    # Werkzeug llama a esta fábrica con argumentos con nombre: los nombres deben ser estos.
    def _get_file_stream(
        self, total_content_length, content_type, filename=None, content_length=None
    ):
        return io.BytesIO()
