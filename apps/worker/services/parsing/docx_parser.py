from .base import BaseParser, ParseResult


class DocxParser(BaseParser):
    def parse(self, file_path: str) -> ParseResult:
        from docx import Document

        doc = Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        full_text = "\n\n".join(paragraphs)
        return ParseResult(
            text=full_text,
            metadata={"format": "docx", "paragraph_count": len(paragraphs)},
        )
