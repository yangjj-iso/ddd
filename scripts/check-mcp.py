"""End-to-end smoke check against a running PartsBox API; revokes its temporary key."""

import asyncio
import os
from pathlib import Path
import sys
import httpx
from dotenv import dotenv_values
from mcp import Client
from mcp.client.stdio import StdioServerParameters

root = Path(__file__).resolve().parents[1]
config = dotenv_values(root / ".env")


async def main():
    async with httpx.AsyncClient(
        base_url="http://127.0.0.1:8000", trust_env=False
    ) as api:
        response = await api.post(
            "/api/auth/login",
            json={
                "username": config["ADMIN_USERNAME"],
                "password": config["ADMIN_PASSWORD"],
            },
        )
        response.raise_for_status()
        response = await api.post(
            "/api/v1/keys",
            json={"name": "MCP smoke check (temporary)", "scope": "read"},
        )
        response.raise_for_status()
        key = response.json()
        try:
            params = StdioServerParameters(
                command=sys.executable,
                args=[str(root / "integrations/mcp_server.py")],
                env={
                    **os.environ,
                    "PARTSBOX_URL": "http://127.0.0.1:8000",
                    "PARTSBOX_API_KEY": key["token"],
                },
            )
            async with Client(params, raise_exceptions=True) as client:
                tools_result = await client.list_tools()
                tools = tools_result.tools
                print("MCP tools:", ", ".join(tool.name for tool in tools))
                assert len(tools) == 6
                result = await client.call_tool("search_parts", {"query": "STM32"})
                assert not result.is_error, result
                print("MCP search_parts: success")
                result = await client.call_tool("inventory_summary", {})
                assert not result.is_error, result
                print("MCP inventory_summary: success")
                for name in ("list_locations", "list_project_boms"):
                    result = await client.call_tool(name, {})
                    assert not result.is_error, result
                    print(f"MCP {name}: success")
                rows = (await api.get("/api/v1/parts", params={"page_size": 1})).json()[
                    "items"
                ]
                if rows:
                    for name in ("get_part", "stock_history"):
                        result = await client.call_tool(
                            name, {"part_id": rows[0]["id"]}
                        )
                        assert not result.is_error, result
                        print(f"MCP {name}: success")
        finally:
            response = await api.delete(f"/api/v1/keys/{key['id']}")
            response.raise_for_status()
            print("Temporary MCP credential revoked.")


if __name__ == "__main__":
    asyncio.run(main())
