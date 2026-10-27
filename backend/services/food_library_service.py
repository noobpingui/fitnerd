from services.food_library_rules import LibraryFood


class FoodLibraryService:

    def __init__(
        self,
        catalog_repository,
        custom_food_repository,
        favorite_repository,
        meal_repository,
        user_repository,
        unit_of_work,
    ):
        self.catalog_repository = catalog_repository
        self.custom_food_repository = custom_food_repository
        self.favorite_repository = favorite_repository
        self.meal_repository = meal_repository
        self.user_repository = user_repository
        self.unit_of_work = unit_of_work

    def search(self, _user_id, _raw_query: str | None) -> list[LibraryFood]:
        raise NotImplementedError("not implemented")

    def recent(self, _user_id) -> list[LibraryFood]:
        raise NotImplementedError("not implemented")

    def favorites(self, _user_id) -> list[LibraryFood]:
        raise NotImplementedError("not implemented")

    def add_favorite(self, _user_id, _kind: str, _food_id: object) -> None:
        raise NotImplementedError("not implemented")

    def remove_favorite(self, _user_id, _kind: str, _food_id: object) -> None:
        raise NotImplementedError("not implemented")

    def delete_custom_food(self, _user_id, _custom_food_id: object) -> None:
        raise NotImplementedError("not implemented")
