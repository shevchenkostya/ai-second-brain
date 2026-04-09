from dataclasses import dataclass, field


@dataclass
class ParseResult:
    text: str
    metadata: dict = field(default_factory=dict)


class BaseParser:
    def parse(self, file_path: str) -> ParseResult:
        raise NotImplementedError
