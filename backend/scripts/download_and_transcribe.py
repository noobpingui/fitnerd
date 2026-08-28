"""
Descarga el audio de uno o mas videos (YouTube, Instagram, o cualquier
sitio que yt-dlp soporte), los transcribe con Whisper (corriendo
localmente, sin costo por uso) y sube la transcripcion a S3 bajo el
prefijo "transcripts/" - el mismo lugar de donde
scripts/ingest_transcripts.py despues lee para meterlos en la base de
conocimiento del coach (pgvector).

Uso:
    python -m scripts.download_and_transcribe <url> [<url> ...]
    python -m scripts.download_and_transcribe <url> --title "Titulo manual"

El --title es opcional y solo se puede usar con una unica URL a la vez -
util para sitios como Instagram/TikTok, que a diferencia de YouTube no
siempre traen un titulo descriptivo real (yt-dlp cae a un generico tipo
"Video by <cuenta>", que no sirve para identificar el contenido despues).

Flujo por cada video:
  1. yt-dlp descarga SOLO el audio (no el video completo) a un archivo
     temporal, convertido a mp3 via ffmpeg.
  2. faster-whisper transcribe ese audio a texto.
  3. El texto se sube directo a S3 (transcripts/<slug-del-titulo>.txt).
  4. El archivo de audio temporal se borra - no nos interesa conservarlo,
     solo el texto (y evita acumular archivos pesados en disco).

Requiere ffmpeg instalado y en el PATH (lo usan tanto yt-dlp para
extraer el audio como whisper para leerlo).

Nota sobre la primera corrida: faster-whisper descarga los pesos del
modelo la primera vez que se usa cada tamano (unos cientos de MB), y los
cachea en disco para las siguientes corridas - la primera va a tardar
mas por eso, ademas de la transcripcion en si.
"""
import argparse
import re
import tempfile
from pathlib import Path

import boto3
import yt_dlp
from faster_whisper import WhisperModel

from config import Config

# "small" es un punto medio razonable entre velocidad y precision corriendo
# en CPU. Si el resultado no convence, "medium" es mas preciso pero mas
# lento; "base" es mas rapido pero comete mas errores en terminologia
# especifica de fitness.
WHISPER_MODEL_SIZE = "small"


def slugify(title: str) -> str:
    # "How to Squat Properly!" -> "how-to-squat-properly"
    # A proposito simetrico con derive_title_from_key() en
    # ingest_transcripts.py, que hace el camino inverso al leer de S3 y
    # reconstruir el titulo para guardarlo en la tabla Video.
    slug = title.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def download_audio(url: str, output_dir: Path, title_override: str | None) -> tuple[Path, str]:
    # Le pedimos a yt-dlp el mejor audio disponible (sin video) y que lo
    # convierta a mp3 con ffmpeg (postprocessor) - asi whisper siempre
    # recibe un formato que puede leer, sin importar el formato nativo
    # del video original.
    output_template = str(output_dir / "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",
        }],
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        # El titulo manual (--title) pisa el que trae la plataforma - pensado
        # para sitios como Instagram/TikTok, donde yt-dlp suele devolver un
        # generico tipo "Video by <cuenta>" en vez de algo descriptivo.
        title = title_override or info["title"]
        audio_path = output_dir / f"{info['id']}.mp3"

    return audio_path, title


def transcribe(audio_path: Path, model: WhisperModel) -> str:
    segments, _info = model.transcribe(str(audio_path))
    # transcribe() devuelve un generador de segmentos (frases con
    # timestamps) - para el RAG solo nos interesa el texto plano, sin
    # marcas de tiempo.
    return " ".join(segment.text.strip() for segment in segments)


def upload_transcript(s3_client, bucket: str, slug: str, text: str) -> str:
    key = f"transcripts/{slug}.txt"
    s3_client.put_object(Bucket=bucket, Key=key, Body=text.encode("utf-8"))
    return key


def process_video(
    url: str, model: WhisperModel, s3_client, bucket: str, title_override: str | None = None
) -> None:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)

        print(f"Descargando audio de {url}...")
        audio_path, title = download_audio(url, tmp_path, title_override)

        print(f"Transcribiendo '{title}' (puede tardar varios minutos)...")
        text = transcribe(audio_path, model)

        slug = slugify(title)
        key = upload_transcript(s3_client, bucket, slug, text)
        print(f"  -> Subido a s3://{bucket}/{key} ({len(text)} caracteres)\n")
        # El audio temporal se borra solo al salir de este "with" -
        # ya cumplio su proposito.


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Descarga audio, transcribe con Whisper y sube el resultado a S3."
    )
    parser.add_argument("urls", nargs="+", help="Una o mas URLs de video")
    parser.add_argument(
        "--title",
        help="Titulo manual, solo valido si se pasa una unica URL (pisa el que trae la plataforma)",
    )
    args = parser.parse_args()

    if args.title and len(args.urls) > 1:
        parser.error("--title solo se puede usar con una unica URL a la vez.")

    return args


def main():
    args = parse_args()

    print(f"Cargando modelo Whisper ({WHISPER_MODEL_SIZE})... esto pasa una sola vez por corrida.")
    model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")

    s3_client = boto3.client("s3")
    bucket = Config.S3_BUCKET_NAME

    for url in args.urls:
        try:
            process_video(url, model, s3_client, bucket, title_override=args.title)
        except Exception as error:
            # Un video con problemas (privado, borrado, formato raro) no
            # deberia tirar abajo el resto del lote - mismo criterio que
            # ingest_transcripts.py.
            print(f"Error procesando {url}: {error}\n")


if __name__ == "__main__":
    main()
