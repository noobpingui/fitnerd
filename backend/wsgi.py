import os
from app import create_app

# "production" como default (no "development", a diferencia de app.py) -
# este archivo es especificamente el punto de entrada para produccion/
# contenedores. Si alguna vez se corre sin FLASK_ENV seteado (un olvido),
# mejor que falle "seguro" (produccion, sin DEBUG) que exponer un server
# con debug activado por accidente.
env = os.environ.get("FLASK_ENV", "production")
app = create_app(env)



# app.py solo crea app dentro de if __name__ == '__main__':, así que gunicorn (que necesita
# importar esa variable, no ejecutar el archivo) no la puede encontrar. Este archivo nuevo resuelve eso sin tocar
# app.py