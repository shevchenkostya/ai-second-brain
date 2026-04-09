from dataclasses import dataclass


@dataclass
class Chunk:
    index: int
    text: str
    char_count: int


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200,
) -> list[Chunk]:
    """
    Split text into overlapping chunks by character count.
    Tries to break at paragraph or sentence boundaries when possible.
    """
    text = text.strip()
    if not text:
        return []

    chunks: list[Chunk] = []
    start = 0
    index = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        # Try to end at a paragraph boundary within the last 20% of the chunk
        if end < len(text):
            search_start = start + int(chunk_size * 0.8)
            para_pos = text.rfind("\n\n", search_start, end)
            if para_pos != -1:
                end = para_pos + 2
            else:
                # Fall back to sentence boundary
                for delimiter in (". ", "! ", "? ", "\n"):
                    pos = text.rfind(delimiter, search_start, end)
                    if pos != -1:
                        end = pos + len(delimiter)
                        break

        chunk_text_content = text[start:end].strip()
        if chunk_text_content:
            chunks.append(Chunk(
                index=index,
                text=chunk_text_content,
                char_count=len(chunk_text_content),
            ))
            index += 1

        next_start = end - overlap
        if next_start <= start:
            break
        start = next_start

    return chunks
