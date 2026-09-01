import redis


class RateLimiter:
    def __init__(self):
        #Bare instance, sin cliente todavia - mismo patron que JWTManager/EmbeddingClient
        self.client = None

    def init_app(self, app):
        #from_url en vez de armar Redis(host=..., port=..., db=...) a mano: parsea
        #REDIS_URL de una ("redis://host:puerto/db") - mismo espiritu que
        #SQLAlchemy usando directamente SQLALCHEMY_DATABASE_URI como string de conexion.
        #decode_responses=True: sin esto, redis-py devuelve bytes (b"5") en vez de
        #str/int usables directo - lo pedimos decodificado para no andar
        #convirtiendo a mano en cada uso.
        self.client = redis.Redis.from_url(app.config["REDIS_URL"], decode_responses=True)

    #Patron "fixed window counter", el mas simple y estandar para rate limiting con
    #Redis. key identifica QUE se esta limitando (ej: "ratelimit:coach:ask:<user_id>"),
    #limit es cuantas veces se permite dentro de la ventana, window_seconds es el
    #tamano de esa ventana en segundos.
    #
    #INCR crea la key en 1 si no existia, o la incrementa si ya existia - es atomico
    #(Redis procesa un comando a la vez, no hay forma de que dos requests simultaneas
    #lean el mismo valor viejo antes de escribir, a diferencia de un "leer, sumar 1,
    #guardar" hecho a mano en 3 pasos separados).
    #
    #Solo la PRIMERA vez que se crea la key (count == 1) le ponemos vencimiento -
    #eso es lo que hace que la ventana se "reinicie" sola despues de window_seconds,
    #sin necesitar ningun job de limpieza: Redis borra la key solo cuando vence.
    def check_and_increment(self, key: str, limit: int, window_seconds: int) -> bool:
        count = self.client.incr(key)

        if count == 1:
            self.client.expire(key, window_seconds)

        return count <= limit
