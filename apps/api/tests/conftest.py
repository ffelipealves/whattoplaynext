"""Shared pytest configuration for the API suite."""

import sys
from pathlib import Path

# The browser fixture catalog doubles as a provider fake for cache tests; it
# lives beside the fixture server, which imports it the same way.
sys.path.insert(0, str(Path(__file__).resolve().parent / "e2e"))
