from exceptions.base_exceptions import AppError


#custom_exceptions defines what casn go wrong and error_handlers defines what Flask does about it

#Exception rised when a resource conflict occurs(409), like a duplicate email
class ConflictError(AppError):
    def __init__(self, message: str = "Email already registered"):
        super().__init__(message, status_code=409)

#Exception raised when authenthication fails(401), like incorrect credentials                 
class AuthenticationError(AppError):
    def __init__(self, message: str = "Wrong credentials"):
        super().__init__(message, status_code=401)

class ResourceNotFoundError(AppError):
    def __init__(self, message: str = "User not Found"):
        super().__init__(message, status_code=404)

#Exception raised when an authenticated user lacks permission for an action (403), like a non-admin hitting an admin-only route
class AuthorizationError(AppError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, status_code=403)

#Exception raised when request data fails basic validation (400), like a missing/empty/too-long field
class ValidationError(AppError):
    def __init__(self, message: str = "Invalid request"):
        super().__init__(message, status_code=400)