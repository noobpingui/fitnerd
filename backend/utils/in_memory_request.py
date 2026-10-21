"""Petición de Flask que guarda los archivos subidos en memoria (spec 024)."""

import flask


class InMemoryUploadRequest(flask.Request):
    def _get_file_stream(
        self, _total_content_length, _content_type, _filename=None, _content_length=None
    ):
        raise NotImplementedError("not implemented")
