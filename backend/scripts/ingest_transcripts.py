
import boto3

from app import create_app
from extensions import db, embedding_client
from repositories.video_repository import VideoRepository
from repositories.transcript_chunk_repository import TranscriptChunkRepository
from unit_of_work.unit_of_work import UnitOfWork
from models.video import Video
from models.transcript import TranscriptChunk
from utils.chunking import chunk_text

#To run execute python -m scripts.ingest_transcripts


def derive_title_from_key(source_key: str) -> str:
    #"transcripts/how-to-squat-properly.txt" -> "How To Squat Properly"
    filename = source_key.rsplit("/", 1)[-1]         #Nos quedamos solo con el nombre de archivo, sin el prefijo/carpeta
    name_without_ext = filename.rsplit(".", 1)[0]     #Le sacamos la extension

    words = name_without_ext.replace("_", " ").replace("-", " ").split()
    return " ".join(word.capitalize() for word in words)


def read_text_from_s3(s3_client, bucket: str, key: str) -> str:
    response = s3_client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read().decode("utf-8")


def ingest():
    app = create_app()

    with app.app_context():
        s3 = boto3.client("s3")
        bucket = app.config["S3_BUCKET_NAME"]

        video_repository = VideoRepository(db.session)
        chunk_repository = TranscriptChunkRepository(db.session)
        unit_of_work = UnitOfWork(db.session)

        #A esta escala (100-400 archivos) list_objects_v2 alcanza en una sola llamada -
        #devuelve maximo 1000 objetos. Si el bucket llega a superar eso, haria falta paginar.
        response = s3.list_objects_v2(Bucket=bucket, Prefix="transcripts/")
        objects = response.get("Contents", [])

        if not objects:
            print("No se encontraron archivos en S3.")
            return

        for obj in objects:
            source_key = obj["Key"]

            if source_key.endswith("/"):
                #S3 no tiene carpetas reales - esto es el objeto "marcador" de tamano cero
                #que la consola crea para representar la carpeta "transcripts/" en si misma.
                continue

            if video_repository.get_by_source_key(source_key):
                print(f"Saltando {source_key}, ya fue ingresado.")
                continue

            print(f"Procesando {source_key}...")

            try:
                text = read_text_from_s3(s3, bucket, source_key)
                title = derive_title_from_key(source_key)

                video = Video(title=title, source_key=source_key)
                video_repository.create(video)
                db.session.flush()  #Genera video.id sin cerrar la transaccion todavia - lo necesitamos para las FK de los chunks

                pieces = chunk_text(text)
                if not pieces:
                    #Segunda barrera de seguridad: si un archivo real termina sin generar chunks
                    #(ej. quedo vacio), evitamos mandarle una lista vacia a la API de Voyage.
                    unit_of_work.rollback()
                    print(f"  -> {source_key} no produjo chunks, se omite.")
                    continue

                embeddings = embedding_client.embed_documents(pieces)

                for index, (piece, embedding) in enumerate(zip(pieces, embeddings)):
                    transcript_chunk = TranscriptChunk(
                        video_id=video.id,
                        chunk_index=index,
                        chunk_text=piece,
                        embedding=embedding,
                    )
                    chunk_repository.create(transcript_chunk)

                unit_of_work.commit()  #Recien aca se guarda todo junto: el video Y sus chunks, atomicamente
                print(f"  -> {len(pieces)} chunks guardados para '{title}'")

            except Exception as error:
                unit_of_work.rollback()
                print(f"Error procesando {source_key}: {error}")


if __name__ == "__main__":
    ingest()
