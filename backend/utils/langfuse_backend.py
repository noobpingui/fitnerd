class LangfuseTraceBackend:
    def __init__(self, public_key, secret_key, base_url, environment, client_factory=None, propagate_attributes=None):
        self.public_key = public_key
        self.secret_key = secret_key
        self.base_url = base_url
        self.environment = environment
        self.client_factory = client_factory
        self.propagate_attributes = propagate_attributes

    def start_trace(self, _name, _user_id, _input):
        raise NotImplementedError("not implemented")
