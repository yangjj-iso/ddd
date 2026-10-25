"""Read-only MCP stdio adapter. The API remains the single data/authorization boundary."""

import os
from urllib.parse import urlparse
import httpx
from mcp.server import MCPServer

BASE_URL = os.environ.get("PARTSBOX_URL", "http://127.0.0.1:8000").rstrip("/")
API_KEY = os.environ.get("PARTSBOX_API_KEY", "")
parsed = urlparse(BASE_URL)
if (
    parsed.scheme not in ("http", "https")
    or not parsed.hostname
    or parsed.username
    or parsed.password
):
    raise RuntimeError(
        "PARTSBOX_URL must be an HTTP(S) origin without embedded credentials"
    )
if (
    parsed.scheme == "http"
    and parsed.hostname not in ("localhost", "127.0.0.1", "::1")
    and os.environ.get("PARTSBOX_ALLOW_INSECURE_HTTP", "").lower() not in ("true", "1")
):
    raise RuntimeError(
        "Use HTTPS or an SSH tunnel; for an explicitly chosen HTTP deployment, set PARTSBOX_ALLOW_INSECURE_HTTP=true"
    )
if not API_KEY:
    raise RuntimeError(
        "Create a read-only API key in PartsBox and set PARTSBOX_API_KEY"
    )

server = MCPServer("PartsBox")


async def get(path: str, params: dict | None = None):
    async with httpx.AsyncClient(
        timeout=20, follow_redirects=False, trust_env=False
    ) as client:
        response = await client.get(
            BASE_URL + path, params=params, headers={"X-API-Key": API_KEY}
        )
        if response.status_code in (401, 403):
            raise ValueError("API key is invalid, revoked, or lacks permission")
        response.raise_for_status()
        return response.json()


@server.tool()
async def search_parts(
    query: str = "",
    category: str = "",
    low_stock_only: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Search components by model, name, manufacturer, package or electrical specification.

    Categories: 电阻, 电容, 电感, 集成电路, 二极管, 晶体管, 连接器, 模块, 其他.
    Results include pagination; continue through pages when a full inventory is needed.
    This tool only reads data and never changes inventory.
    """
    if page < 1 or not 1 <= page_size <= 100:
        raise ValueError("page >= 1, page_size between 1 and 100")
    return await get(
        "/api/v1/parts",
        {
            "q": query,
            "category": category,
            "stock": "low" if low_stock_only else "",
            "page": page,
            "page_size": page_size,
        },
    )


@server.tool()
async def get_part(part_id: int) -> dict:
    """Read a component's live quantity, storage location, specifications and datasheet URL."""
    return await get(f"/api/v1/parts/{int(part_id)}")


@server.tool()
async def inventory_summary() -> dict:
    """Read total component types, total quantity, CNY valuation, low stock alerts and 14-day trends."""
    return await get("/api/v1/summary")


@server.tool()
async def list_locations() -> list[dict]:
    """Read storage boxes/shelves, location codes, number of component types and quantities."""
    return await get("/api/v1/locations")


@server.tool()
async def list_project_boms() -> list[dict]:
    """Read project BOMs with required quantities and shortages. BOMs do not reserve stock."""
    return await get("/api/v1/projects")


@server.tool()
async def stock_history(part_id: int, page: int = 1, page_size: int = 20) -> dict:
    """Read paginated incoming/outgoing movements and their reasons, actors, balances and UTC timestamps."""
    if page < 1 or not 1 <= page_size <= 100:
        raise ValueError("page >= 1, page_size between 1 and 100")
    return await get(
        "/api/v1/movements",
        {"part_id": int(part_id), "page": page, "page_size": page_size},
    )


if __name__ == "__main__":
    server.run(transport="stdio")
