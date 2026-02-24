"""
Gemini Pro + MCP Gateway.
- Gemini Pro Interactions API met server-side state (previous_interaction_id)
- MCP als universele router voor externe tools (GitHub, Gitee, etc.)
- Geen losse OAuth flows; Gemini roept tools aan via MCP
- Tool-call loop: bij function_call in response → MCP aanroepen → resultaat terugsturen → herhalen
"""
import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 5

# Lazy imports om startup te versnellen
_genai_client = None
_mcp_sessions = {}


def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        try:
            from google import genai
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY required")
            _genai_client = genai.Client(api_key=api_key)
        except ImportError:
            logger.warning("google-genai not installed; Gemini gateway disabled")
            return None
    return _genai_client


async def _get_mcp_tools() -> list[dict]:
    """Haal beschikbare tools op van geconfigureerde MCP-servers."""
    tools = []
    try:
        from mcp import StdioServerParameters
        from mcp.client.stdio import stdio_client
        from mcp import ClientSession
        from mcp.types import Tool

        # Voorbeeld: GitHub MCP server (als geconfigureerd)
        mcp_servers = os.getenv("MCP_SERVERS", "")
        if not mcp_servers:
            return tools

        for config in mcp_servers.split(";"):
            if not config.strip():
                continue
            parts = config.split(":", 2)
            name = parts[0].strip() if parts else "default"
            cmd = parts[1].strip() if len(parts) > 1 else "npx"
            args_str = parts[2].strip() if len(parts) > 2 else ""
            args = [a.strip() for a in args_str.split()] if args_str else []

            try:
                params = StdioServerParameters(command=cmd, args=args)
                async with stdio_client(params) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        mcp_tools = await session.list_tools()
                        for t in mcp_tools.tools:
                            tools.append({
                                "name": f"{name}_{t.name}",
                                "description": t.description or "",
                                "input_schema": t.inputSchema if hasattr(t, "inputSchema") else {},
                            })
            except Exception as e:
                logger.warning("MCP server %s failed: %s", name, e)
    except ImportError:
        logger.debug("MCP SDK not available for tool discovery")
    return tools


def _mcp_tools_to_genai(tools: list[dict]) -> list:
    """Converteer MCP tools naar Gemini function declarations."""
    try:
        from google.genai import types
    except ImportError:
        return []

    decls = []
    for t in tools:
        decls.append(
            types.FunctionDeclaration(
                name=t["name"],
                description=t.get("description", ""),
                parameters=t.get("input_schema", {}),
            )
        )
    return decls


def _extract_function_calls(response: Any) -> list[dict]:
    """
    Haal function_call parts uit een Interactions API response.
    Returns list of {"name": str, "args": dict, "id": str|None}.
    """
    out = []
    output = getattr(response, "output", None) or getattr(response, "outputs", None)
    if output is None:
        return out
    # response.output.parts of response.outputs[-1].content.parts
    parts = getattr(output, "parts", None)
    if parts is None and hasattr(output, "content"):
        parts = getattr(output.content, "parts", None)
    if not parts and hasattr(response, "outputs") and response.outputs:
        last = response.outputs[-1]
        parts = getattr(last, "parts", None) or getattr(getattr(last, "content", None), "parts", None)
    if not parts:
        return out
    for part in parts:
        fc = getattr(part, "function_call", None)
        if fc is None:
            continue
        name = getattr(fc, "name", None) or (fc.get("name") if isinstance(fc, dict) else None)
        args = getattr(fc, "args", None)
        if args is None and isinstance(fc, dict):
            args = fc.get("args", {})
        if args is None:
            args = {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except json.JSONDecodeError:
                args = {}
        call_id = getattr(fc, "id", None) or (fc.get("id") if isinstance(fc, dict) else None)
        if name:
            out.append({"name": name, "args": args or {}, "id": call_id})
    return out


def _parse_mcp_tool_name(qualified_name: str) -> tuple[str, str]:
    """
    qualified_name is "server_toolname" (zoals in _get_mcp_tools).
    Returns (server_name, tool_name).
    """
    if "_" in qualified_name:
        idx = qualified_name.index("_")
        return qualified_name[:idx], qualified_name[idx + 1 :]
    return "default", qualified_name


def _text_from_response(response: Any) -> Optional[str]:
    """Haal alle tekst uit een interaction response."""
    output = getattr(response, "output", None)
    if output is None and getattr(response, "outputs", None):
        outputs = response.outputs
        output = outputs[-1] if outputs else None
    if output is None:
        return None
    parts = getattr(output, "parts", None) or getattr(getattr(output, "content", None), "parts", None)
    if not parts:
        if hasattr(output, "text"):
            return output.text
        return None
    texts = [getattr(p, "text", None) or (p.get("text") if isinstance(p, dict) else None) for p in parts]
    texts = [t for t in texts if t]
    return "\n".join(texts) if texts else None


async def create_interaction(
    input_text: str,
    system_instruction: Optional[str] = None,
    previous_interaction_id: Optional[str] = None,
    model: str = "gemini-2.5-flash",
) -> dict[str, Any]:
    """
    Maak een Gemini-interactie. Server-side state via previous_interaction_id.
    Tool-call loop: bij function_call → MCP aanroepen → resultaat terugsturen → herhalen.
    NUC hoeft geen zware conversatiegeschiedenis in geheugen te houden.
    """
    client = _get_genai_client()
    if not client:
        return {"error": "Gemini client not available", "output": None}

    try:
        mcp_tools = await _get_mcp_tools()
        tool_decls = []
        if mcp_tools:
            try:
                from google.genai import types
                tool_decls = _mcp_tools_to_genai(mcp_tools)
            except Exception as e:
                logger.warning("Could not add MCP tools to Gemini: %s", e)

        def build_create_kwargs(input_value: Any, prev_id: Optional[str] = None) -> dict:
            kwargs = {"model": model, "input": input_value}
            if system_instruction:
                kwargs["system_instruction"] = system_instruction
            if prev_id:
                kwargs["previous_interaction_id"] = prev_id
            if tool_decls:
                try:
                    from google.genai import types
                    kwargs["tools"] = [types.Tool(function_declarations=tool_decls)]
                except Exception:
                    pass
            return kwargs

        response = client.interactions.create(**build_create_kwargs(input_text, previous_interaction_id))
        interaction_id = getattr(response, "id", None)

        for _ in range(MAX_TOOL_ROUNDS):
            function_calls = _extract_function_calls(response)
            if not function_calls:
                break

            # Bouw function_response parts voor de volgende create
            result_parts = []
            for fc in function_calls:
                server_name, tool_name = _parse_mcp_tool_name(fc["name"])
                try:
                    tool_result = await call_mcp_tool(server_name, tool_name, fc["args"])
                except Exception as e:
                    logger.exception("MCP tool execution failed for %s", fc["name"])
                    tool_result = f"Error: {e}"
                result_parts.append({
                    "function_response": {
                        "name": fc["name"],
                        "response": {"result": tool_result},
                    }
                })
                if fc.get("id"):
                    result_parts[-1]["function_response"]["id"] = fc["id"]

            # Volgende turn: stuur tool resultaten terug (zelfde model/tools/system)
            tool_input = {"parts": result_parts}

            response = client.interactions.create(
                **build_create_kwargs(tool_input, interaction_id)
            )
            interaction_id = getattr(response, "id", None) or interaction_id

        output = _text_from_response(response)
        return {
            "id": interaction_id,
            "output": output,
            "error": None,
        }
    except Exception as e:
        logger.exception("Gemini interaction failed")
        return {"error": str(e), "output": None, "id": None}


async def call_mcp_tool(server_name: str, tool_name: str, arguments: dict) -> str:
    """
    Roep een MCP-tool aan. Wordt gebruikt wanneer Gemini een tool-call teruggeeft.
    """
    try:
        from mcp import StdioServerParameters
        from mcp.client.stdio import stdio_client
        from mcp import ClientSession

        mcp_servers = os.getenv("MCP_SERVERS", "")
        for config in mcp_servers.split(";"):
            if not config.strip():
                continue
            parts = config.split(":", 2)
            name = parts[0].strip() if parts else "default"
            if name != server_name:
                continue
            cmd = parts[1].strip() if len(parts) > 1 else "npx"
            args_str = parts[2].strip() if len(parts) > 2 else ""
            args = [a.strip() for a in args_str.split()] if args_str else []

            params = StdioServerParameters(command=cmd, args=args)
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    result = await session.call_tool(tool_name, arguments)
                    if hasattr(result, "content") and result.content:
                        return result.content[0].text if result.content else ""
                    return str(result)
    except Exception as e:
        logger.exception("MCP tool call failed")
        return f"Error: {e}"
