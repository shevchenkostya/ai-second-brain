from .base import BaseParser
from .md_parser import MarkdownParser
from .txt_parser import TextParser
from .pdf_parser import PdfParser
from .docx_parser import DocxParser

_REGISTRY: dict[str, BaseParser] = {
    "md": MarkdownParser(),
    "txt": TextParser(),
    "pdf": PdfParser(),
    "docx": DocxParser(),
    "json": TextParser(),
    "yaml": TextParser(),
    "html": TextParser(),
}


def get_parser(source_type: str) -> BaseParser | None:
    return _REGISTRY.get(source_type.lower())
