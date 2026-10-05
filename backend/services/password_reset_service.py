class PasswordResetService:

    def __init__(self, user_repository, password_reset_repository, unit_of_work, email_sender,
                 frontend_base_url, clock=None):
        self.user_repository = user_repository
        self.password_reset_repository = password_reset_repository
        self.unit_of_work = unit_of_work
        self.email_sender = email_sender
        self.frontend_base_url = frontend_base_url
        self.clock = clock

    def request_reset(self, email, client_ip):
        raise NotImplementedError

    def reset_password(self, token, password):
        raise NotImplementedError
