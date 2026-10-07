def format_error(_exc):
    raise NotImplementedError("not implemented")


class NullStepHandle:
    def end(self, _output=None, _usage=None):
        raise NotImplementedError("not implemented")

    def fail(self, _exc):
        raise NotImplementedError("not implemented")


class NullTraceRecorder:
    def start_step(self, _name, _kind, _input, _model=None):
        raise NotImplementedError("not implemented")

    def add_score(self, _name, _value, _data_type):
        raise NotImplementedError("not implemented")

    def finish(self, _output):
        raise NotImplementedError("not implemented")


class SafeStepHandle:
    def __init__(self, backend_step, logger):
        self.backend_step = backend_step
        self.logger = logger

    def end(self, _output=None, _usage=None):
        raise NotImplementedError("not implemented")

    def fail(self, _exc):
        raise NotImplementedError("not implemented")


class SafeTraceRecorder:
    def __init__(self, backend_trace, logger):
        self.backend_trace = backend_trace
        self.logger = logger

    def start_step(self, _name, _kind, _input, _model=None):
        raise NotImplementedError("not implemented")

    def add_score(self, _name, _value, _data_type):
        raise NotImplementedError("not implemented")

    def finish(self, _output):
        raise NotImplementedError("not implemented")


class Tracer:
    def __init__(self, backend=None, logger=None, client_factory=None, propagate_attributes=None):
        self.backend = backend
        self.logger = logger
        self.client_factory = client_factory
        self.propagate_attributes = propagate_attributes

    @property
    def enabled(self):
        raise NotImplementedError("not implemented")

    def init_app(self, _app):
        raise NotImplementedError("not implemented")

    def start_trace(self, _name, _user_id, _input):
        raise NotImplementedError("not implemented")
