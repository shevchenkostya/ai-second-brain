import os
import tempfile
import pytest

from services.parsing.registry import get_parser
from services.parsing.md_parser import MarkdownParser
from services.parsing.txt_parser import TextParser


def write_temp_file(suffix: str, content: str) -> str:
    f = tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False, encoding="utf-8")
    f.write(content)
    f.flush()
    f.close()
    return f.name


def test_markdown_parser_returns_text():
    path = write_temp_file(".md", "# Title\n\nSome content here.")
    try:
        result = MarkdownParser().parse(path)
        assert "Title" in result.text
        assert "Some content here." in result.text
        assert result.metadata.get("format") == "markdown"
    finally:
        os.unlink(path)


def test_txt_parser_returns_text():
    path = write_temp_file(".txt", "Plain text content.")
    try:
        result = TextParser().parse(path)
        assert "Plain text content." in result.text
    finally:
        os.unlink(path)


def test_registry_returns_markdown_parser_for_md():
    parser = get_parser("md")
    assert isinstance(parser, MarkdownParser)


def test_registry_returns_text_parser_for_txt():
    parser = get_parser("txt")
    assert isinstance(parser, TextParser)


def test_registry_returns_text_parser_for_json():
    parser = get_parser("json")
    assert isinstance(parser, TextParser)


def test_registry_returns_text_parser_for_yaml():
    parser = get_parser("yaml")
    assert isinstance(parser, TextParser)


def test_registry_returns_text_parser_for_html():
    parser = get_parser("html")
    assert isinstance(parser, TextParser)


def test_registry_returns_none_for_unknown_type():
    assert get_parser("xyz") is None
    assert get_parser("py") is None
    assert get_parser("") is None


def test_registry_is_case_insensitive():
    assert get_parser("MD") is not None
    assert get_parser("TXT") is not None


def test_parse_result_has_text_and_metadata():
    path = write_temp_file(".md", "Hello")
    try:
        result = MarkdownParser().parse(path)
        assert hasattr(result, "text")
        assert hasattr(result, "metadata")
        assert isinstance(result.text, str)
        assert isinstance(result.metadata, dict)
    finally:
        os.unlink(path)
