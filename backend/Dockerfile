FROM python:3.13-slim

  WORKDIR /app

  # Copiar SOLO requirements.txt primero, instalar, y recien despues copiar
  # el resto del codigo (no "COPY . ." de una) es a proposito - Docker
  # cachea cada instruccion por separado. Mientras requirements.txt no
  # cambie, este paso (el mas lento, instalar todas las dependencias) se
  # reusa del cache en las proximas construcciones, en vez de reinstalar
  # todo de cero solo porque editaste una linea de un archivo .py.
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt

  COPY . .

  EXPOSE 5000

  # gunicorn en vez de "python app.py" - servidor WSGI real pensado para
  # produccion (varios workers, mucho mas robusto), a diferencia del
  # servidor de desarrollo de Flask que nos viene avisando en cada arranque
  # local ("This is a development server. Do not use it in production").
  # wsgi:app = "importa wsgi.py, usa la variable app de ahi".
  CMD ["gunicorn", "--bind", "0.0.0.0:5000", "wsgi:app"]