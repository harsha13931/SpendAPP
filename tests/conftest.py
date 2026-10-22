import pytest

from spend_engine.categorizer import Categorizer
from spend_engine.parser import SmsParser
from spend_engine.service import SpendService
from spend_engine.store import Store


@pytest.fixture(scope="session")
def parser() -> SmsParser:
    return SmsParser.from_file()


@pytest.fixture(scope="session")
def categorizer() -> Categorizer:
    return Categorizer.from_files()


@pytest.fixture
def service(parser, categorizer) -> SpendService:
    return SpendService(parser, categorizer, Store(":memory:"))
