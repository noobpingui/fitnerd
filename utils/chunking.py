
def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> list[str]:
    #Sliding window: partimos el texto en palabras, y avanzamos con un "paso(step)" mas chico
    #que el tamano del chunk, para que el final de un chunk se repita al principio del siguiente

    if overlap >= chunk_size:
        raise ValueError("overlap must be minor than the chunk_size, otherwise the 'step' does not go forward")

    words = text.split()
    if not words:
        return []

    step = chunk_size - overlap
    chunks = []

    start = 0
    while start < len(words):
        end = start + chunk_size
        piece = words[start:end]
        chunks.append(" ".join(piece))
        start += step

    return chunks
