from .base import BaseParser, ParseResult


class PdfParser(BaseParser):
    def parse(self, file_path: str) -> ParseResult:
        import pdfplumber

        pages_text = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text.strip())

        full_text = "\n\n".join(pages_text)
        return ParseResult(
            text=full_text,
            metadata={"format": "pdf", "page_count": len(pages_text)},
        )
