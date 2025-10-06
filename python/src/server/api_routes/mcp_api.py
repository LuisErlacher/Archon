"""
MCP API endpoints for Archon

Provides status and configuration endpoints for the MCP service.
Supports both Docker Compose and Kubernetes deployment modes.
"""

import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

# Import unified logging
from ..config.logfire_config import api_logger, safe_set_attribute, safe_span

router = APIRouter(prefix="/api/mcp", tags=["mcp"])


def get_container_status() -> dict[str, Any]:
    """Get MCP container status - supports both Docker Compose and Kubernetes."""

    # Detect environment via SERVICE_DISCOVERY_MODE
    service_discovery = os.getenv("SERVICE_DISCOVERY_MODE", "docker_compose")

    if service_discovery == "kubernetes":
        return get_k8s_mcp_status()
    else:
        return get_docker_mcp_status()


def get_k8s_mcp_status() -> dict[str, Any]:
    """Get MCP status via HTTP health check (for Kubernetes)."""
    try:
        # Get MCP service URL from environment
        mcp_url = os.getenv("MCP_SERVICE_URL", "http://archon-mcp-service.archon.svc.cluster.local:8051")

        # Try to connect to MCP via HTTP health check
        with httpx.Client(timeout=5.0) as client:
            response = client.get(f"{mcp_url}/health")

            if response.status_code == 200:
                api_logger.debug(f"MCP health check successful (Kubernetes mode)")
                return {
                    "status": "running",
                    "uptime": None,  # K8s doesn't expose container uptime easily
                    "logs": [],
                    "container_status": "running",
                    "mode": "kubernetes"
                }
            else:
                api_logger.warning(f"MCP health check returned {response.status_code}")
                return {
                    "status": "unhealthy",
                    "uptime": None,
                    "logs": [],
                    "container_status": f"http_{response.status_code}",
                    "mode": "kubernetes"
                }

    except httpx.ConnectError:
        api_logger.error("MCP service not reachable (Kubernetes mode)")
        return {
            "status": "not_found",
            "uptime": None,
            "logs": [],
            "container_status": "not_reachable",
            "message": "MCP service not reachable. Check if archon-mcp pod is running.",
            "mode": "kubernetes"
        }
    except Exception as e:
        api_logger.error(f"Failed to check MCP status (Kubernetes) - error={str(e)}", exc_info=True)
        return {
            "status": "error",
            "uptime": None,
            "logs": [],
            "container_status": "error",
            "error": str(e),
            "mode": "kubernetes"
        }


def get_docker_mcp_status() -> dict[str, Any]:
    """Get MCP status via Docker API (for Docker Compose)."""
    docker_client = None
    try:
        import docker
        from docker.errors import NotFound

        docker_client = docker.from_env()
        container = docker_client.containers.get("archon-mcp")

        # Get container status
        container_status = container.status

        # Map Docker statuses to simple statuses
        if container_status == "running":
            status = "running"
            # Try to get uptime from container info
            try:
                from datetime import datetime
                started_at = container.attrs["State"]["StartedAt"]
                started_time = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                uptime = int((datetime.now(started_time.tzinfo) - started_time).total_seconds())
            except Exception:
                uptime = None
        else:
            status = "stopped"
            uptime = None

        return {
            "status": status,
            "uptime": uptime,
            "logs": [],  # No log streaming anymore
            "container_status": container_status,
            "mode": "docker_compose"
        }

    except NotFound:
        return {
            "status": "not_found",
            "uptime": None,
            "logs": [],
            "container_status": "not_found",
            "message": "MCP container not found. Run: docker compose up -d archon-mcp",
            "mode": "docker_compose"
        }
    except Exception as e:
        api_logger.error("Failed to get container status (Docker)", exc_info=True)
        return {
            "status": "error",
            "uptime": None,
            "logs": [],
            "container_status": "error",
            "error": str(e),
            "mode": "docker_compose"
        }
    finally:
        if docker_client is not None:
            try:
                docker_client.close()
            except Exception:
                pass


@router.get("/status")
async def get_status():
    """Get MCP server status."""
    with safe_span("api_mcp_status") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/status")
        safe_set_attribute(span, "method", "GET")

        try:
            status = get_container_status()
            api_logger.debug(f"MCP server status checked - status={status.get('status')}")
            safe_set_attribute(span, "status", status.get("status"))
            safe_set_attribute(span, "uptime", status.get("uptime"))
            return status
        except Exception as e:
            api_logger.error(f"MCP server status API failed - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_mcp_config():
    """Get MCP server configuration."""
    with safe_span("api_get_mcp_config") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/config")
        safe_set_attribute(span, "method", "GET")

        try:
            api_logger.info("Getting MCP server configuration")

            # Get actual MCP port from environment or use default
            mcp_port = int(os.getenv("ARCHON_MCP_PORT", "8051"))

            # Configuration for streamable-http mode with actual port
            config = {
                "host": os.getenv("ARCHON_HOST", "localhost"),
                "port": mcp_port,
                "transport": "streamable-http",
            }

            # Get only model choice from database (simplified)
            try:
                from ..services.credential_service import credential_service

                model_choice = await credential_service.get_credential(
                    "MODEL_CHOICE", "gpt-4o-mini"
                )
                config["model_choice"] = model_choice
            except Exception:
                # Fallback to default model
                config["model_choice"] = "gpt-4o-mini"

            api_logger.info("MCP configuration (streamable-http mode)")
            safe_set_attribute(span, "host", config["host"])
            safe_set_attribute(span, "port", config["port"])
            safe_set_attribute(span, "transport", "streamable-http")
            safe_set_attribute(span, "model_choice", config.get("model_choice", "gpt-4o-mini"))

            return config
        except Exception as e:
            api_logger.error("Failed to get MCP configuration", exc_info=True)
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail={"error": str(e)})


@router.get("/clients")
async def get_mcp_clients():
    """Get connected MCP clients with type detection."""
    with safe_span("api_mcp_clients") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/clients")
        safe_set_attribute(span, "method", "GET")

        try:
            # TODO: Implement real client detection in the future
            # For now, return empty array as expected by frontend
            api_logger.debug("Getting MCP clients - returning empty array")

            return {
                "clients": [],
                "total": 0
            }
        except Exception as e:
            api_logger.error(f"Failed to get MCP clients - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            return {
                "clients": [],
                "total": 0,
                "error": str(e)
            }


@router.get("/sessions")
async def get_mcp_sessions():
    """Get MCP session information."""
    with safe_span("api_mcp_sessions") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/sessions")
        safe_set_attribute(span, "method", "GET")

        try:
            # Basic session info for now
            status = get_container_status()

            session_info = {
                "active_sessions": 0,  # TODO: Implement real session tracking
                "session_timeout": 3600,  # 1 hour default
            }

            # Add uptime if server is running
            if status.get("status") == "running" and status.get("uptime"):
                session_info["server_uptime_seconds"] = status["uptime"]

            api_logger.debug(f"MCP session info - sessions={session_info.get('active_sessions')}")
            safe_set_attribute(span, "active_sessions", session_info.get("active_sessions"))

            return session_info
        except Exception as e:
            api_logger.error(f"Failed to get MCP sessions - error={str(e)}")
            safe_set_attribute(span, "error", str(e))
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def mcp_health():
    """Health check for MCP API - used by bug report service and tests."""
    with safe_span("api_mcp_health") as span:
        safe_set_attribute(span, "endpoint", "/api/mcp/health")
        safe_set_attribute(span, "method", "GET")

        # Simple health check - no logging to reduce noise
        result = {"status": "healthy", "service": "mcp"}
        safe_set_attribute(span, "status", "healthy")

        return result
