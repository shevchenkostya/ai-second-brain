import pytest
from services.chunking import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_short_text_produces_single_chunk():
    """Text shorter than chunk_size should yield exactly one chunk, not loop forever."""
    text = "Hello world. This is a short document."
    chunks = chunk_text(text, chunk_size=1000, overlap=200)
    assert len(chunks) == 1
    assert chunks[0].index == 0
    assert chunks[0].text == text.strip()
    assert chunks[0].char_count == len(text.strip())


def test_long_text_produces_multiple_chunks():
    # 3000 chars → should produce at least 3 chunks with default settings
    text = "A" * 3000
    chunks = chunk_text(text, chunk_size=1000, overlap=200)
    assert len(chunks) >= 3


def test_chunks_are_indexed_sequentially():
    text = "word " * 600  # 3000 chars
    chunks = chunk_text(text, chunk_size=1000, overlap=200)
    for i, chunk in enumerate(chunks):
        assert chunk.index == i


def test_overlap_means_content_is_repeated():
    """The end of chunk N should appear at the start of chunk N+1."""
    text = "sentence one. sentence two. sentence three. " * 50
    chunks = chunk_text(text, chunk_size=200, overlap=50)
    assert len(chunks) >= 2
    # Last part of chunk 0 should appear somewhere in chunk 1
    tail = chunks[0].text[-30:]
    assert tail in chunks[1].text


def test_char_count_matches_text_length():
    text = "This is a test. " * 100
    chunks = chunk_text(text, chunk_size=500, overlap=100)
    for chunk in chunks:
        assert chunk.char_count == len(chunk.text)


def test_no_empty_chunks():
    text = "\n\n".join(["paragraph " + str(i) for i in range(50)])
    chunks = chunk_text(text)
    for chunk in chunks:
        assert chunk.text.strip() != ""


def test_breaks_at_paragraph_boundary():
    """Chunker should prefer \n\n over mid-word splits when within the last 20% of chunk."""
    # Two distinct paragraphs, total > chunk_size so a split must happen
    first_para = "alpha " * 160   # ~960 chars
    second_para = "ZZZZ " * 160   # ~960 chars — distinct content
    text = first_para + "\n\n" + second_para
    chunks = chunk_text(text, chunk_size=1000, overlap=100)
    # The paragraph boundary at ~960 chars is within the last 20% window (800..1000),
    # so the first chunk should NOT contain any "ZZZZ" content from the second paragraph.
    assert "ZZZZ" not in chunks[0].text
    # The second paragraph content should appear in a later chunk.
    assert any("ZZZZ" in c.text for c in chunks[1:])


def test_no_infinite_loop_on_text_shorter_than_overlap():
    """Regression: chunk_size < overlap used to loop forever."""
    text = "short"
    chunks = chunk_text(text, chunk_size=100, overlap=200)
    assert len(chunks) == 1
