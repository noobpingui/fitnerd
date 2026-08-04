from functools import wraps

from flask import request, g

from extensions import jwt_manager
from exceptions.custom_exceptions import AuthenticationError, AuthorizationError

# g = Objeto de contexto de Flask que permite compartir datos entre funciones durante la peticion HTTP actual

# closure = Un closure es una funcion que recuerda las variables de la funcion donde fue creada,
# incluso despues de que esa funcion ya termino de ejecutarse
# Condiciones para que exista un closure:
# 1. La funcion hija esta anidada dentro de otra funcion.
# 2. La funcion hija usa una variable de la funcion padre.
# 3. La funcion hija sigue existiendo despues de que la funcion padre termina
# (normalmente porque se retorna o se guarda en algun lugar)


def _decode_request_token():
    #Shared by require_auth and require_admin: pull the Bearer token out of the request and decode it.
    #jwt_manager is a fixed singleton (imported straight from extensions.py), so neither decorator
    #needs it passed in as a parameter.
    auth_header = request.headers.get('Authorization')

    if auth_header is None:
        raise AuthenticationError("Authorization header is missing")

    header_parts = auth_header.split()

    if header_parts[0].lower() != 'bearer':
        raise AuthenticationError("Authorization header must start with 'Bearer'")
    elif len(header_parts) == 1:
        raise AuthenticationError("Token missing from Bearer header")
    elif len(header_parts) > 2:
        raise AuthenticationError("Authorization header must be 'Bearer <token>'")

    token = header_parts[1]

    #decode_token already raises AuthenticationError on an expired/invalid token - nothing to check here
    return jwt_manager.decode_token(token)


#Regular user-role
def require_auth(func): #Recibimos la funcion que se va a decorar. Su trabajo es crear el wrapper y devolverlo
    @wraps(func)  #Conserva los metadatos de la función original en el wrapper
    def wrapper(*args, **kwargs): # Ejecuta la logica de autenticacion antes de llamar a la funcion original
                                  # Usamos *args, **kwargs porque no sabemos los argumentos que recibe cada metodo

        #Utilizamos g para almacenar el token y poder utilizarlo despues dentro de la funcion original.
        #g solamente vive en la misma peticion http y despues muere
        g.decoded_token = _decode_request_token()

        #Llamamos a la funcion original y retornamos su resultado
        return func(*args, **kwargs)
    return wrapper


#Admin user-role
def require_admin(func):
    @wraps(func)
    def wrapper(*args, **kwargs):

        decoded_token = _decode_request_token()

        if decoded_token["user_role"] != "admin":
            raise AuthorizationError("Forbidden: admin access required")

        g.decoded_token = decoded_token

        return func(*args, **kwargs)
    return wrapper
