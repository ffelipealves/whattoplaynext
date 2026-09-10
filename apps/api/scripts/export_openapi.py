"""Emit the executable FastAPI contract without starting an HTTP server."""

import json
import sys

from whattoplaynext_api.openapi import build_openapi_schema


def main() -> None:
    """Write stable JSON to stdout for the contract generator."""
    json.dump(
        build_openapi_schema(),
        sys.stdout,
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
