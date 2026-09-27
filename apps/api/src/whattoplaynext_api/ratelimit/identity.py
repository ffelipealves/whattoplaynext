"""Who a request counts against, without ever keeping the address."""

import hmac
from collections.abc import Mapping
from hashlib import sha256
from ipaddress import IPv6Address, IPv6Network, ip_address

# Sent by the web server on every call it makes for a visitor. They belong to
# the trust boundary, not the public contract, so OpenAPI does not list them.
CLIENT_ADDRESS_HEADER = "X-WTPN-Client-Address"
EDGE_TOKEN_HEADER = "X-WTPN-Edge-Token"


def client_address(
    headers: Mapping[str, str],
    peer: str | None,
    *,
    edge_token: str | None,
    trusted_proxy_hops: int,
) -> str | None:
    """Return the normalized address a request is limited by.

    A forwarded visitor address counts only with the matching edge token, so a
    direct caller cannot choose its identity. Otherwise the address is the
    socket peer, or the ``X-Forwarded-For`` entry added by the last trusted
    proxy hop when the API itself sits behind one. Headers use lowercase keys.
    """
    supplied_token = headers.get(EDGE_TOKEN_HEADER.lower(), "")
    if (
        edge_token
        and supplied_token
        and hmac.compare_digest(supplied_token.encode(), edge_token.encode())
    ):
        forwarded = _normalize(headers.get(CLIENT_ADDRESS_HEADER.lower(), ""))
        if forwarded is not None:
            return forwarded
    if trusted_proxy_hops > 0:
        chain = [
            entry.strip()
            for entry in headers.get("x-forwarded-for", "").split(",")
            if entry.strip()
        ]
        if chain:
            candidate = _normalize(chain[max(0, len(chain) - trusted_proxy_hops)])
            if candidate is not None:
                return candidate
    return _normalize(peer or "")


def _normalize(value: str) -> str | None:
    """IPv4 as-is; IPv6 as its /64, the unit one subscriber usually holds."""
    try:
        address = ip_address(value.strip())
    except ValueError:
        return None
    if isinstance(address, IPv6Address) and address.ipv4_mapped is None:
        return str(IPv6Network(f"{address}/64", strict=False))
    if isinstance(address, IPv6Address) and address.ipv4_mapped is not None:
        return str(address.ipv4_mapped)
    return str(address)


class IdentityDigester:
    """Replace an address with a keyed digest before it reaches any store."""

    def __init__(self, key: bytes) -> None:
        self._key = key

    def digest(self, address: str) -> str:
        return hmac.new(self._key, address.encode(), sha256).hexdigest()[:32]
