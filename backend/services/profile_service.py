from dataclasses import dataclass


@dataclass
class ProfileState:
    user: object
    profile: object


class ProfileService:
    def __init__(self, user_repository, user_profile_repository, unit_of_work, clock=None):
        self.user_repository = user_repository
        self.user_profile_repository = user_profile_repository
        self.unit_of_work = unit_of_work
        self.clock = clock

    def get_profile(self, _user_id):
        raise NotImplementedError

    def save_profile(self, _user_id, _data):
        raise NotImplementedError
