from .base import BaseParser, ParseResult


class MarkdownParser(BaseParser):
    def parse(self, file_path: str) -> ParseResult:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        return ParseResult(text=text, metadata={"format": "markdown"})
