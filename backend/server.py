from __future__ import annotations

import json
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
COMPONENTS_PATH = DATA_DIR / "demo-components.json"
DEFAULT_PATH = DATA_DIR / "default-learning-path.json"
SAVED_DIR = DATA_DIR / "learning-paths"


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str):
        self.status = status
        self.message = message


def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug or "learning-path"


def require_fields(obj: dict[str, Any], fields: list[str], label: str) -> None:
    missing = [field for field in fields if field not in obj]
    if missing:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"{label} is missing: {', '.join(missing)}")


def validate_learning_path(payload: dict[str, Any]) -> None:
    require_fields(payload, ["name", "status", "nodes", "edges"], "Learning path")
    if payload["status"] not in {"draft", "published"}:
        raise ApiError(HTTPStatus.BAD_REQUEST, "status must be draft or published")
    if not isinstance(payload["nodes"], list) or len(payload["nodes"]) < 2:
        raise ApiError(HTTPStatus.BAD_REQUEST, "nodes must contain at least two nodes")
    if not isinstance(payload["edges"], list) or len(payload["edges"]) < 1:
        raise ApiError(HTTPStatus.BAD_REQUEST, "edges must contain at least one edge")

    node_ids: set[str] = set()
    for node in payload["nodes"]:
        require_fields(node, ["id", "componentId", "type", "label", "position"], "Node")
        if node["type"] not in {"start", "unit", "assessment", "end"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Unsupported node type: {node['type']}")
        if node["id"] in node_ids:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Duplicate node id: {node['id']}")
        node_ids.add(node["id"])
        position = node["position"]
        if not isinstance(position, dict) or "x" not in position or "y" not in position:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Node {node['id']} requires x and y position")

    for edge in payload["edges"]:
        require_fields(edge, ["id", "sourceNodeId", "targetNodeId", "conditions"], "Edge")
        if edge["sourceNodeId"] not in node_ids or edge["targetNodeId"] not in node_ids:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Edge {edge['id']} references an unknown node")
        conditions = edge["conditions"]
        if conditions.get("operator") not in {"AND", "OR"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Edge {edge['id']} requires AND or OR conditions")
        rules = conditions.get("rules")
        if not isinstance(rules, list):
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Edge {edge['id']} rules must be a list")
        for rule in rules:
            validate_rule(rule, node_ids)


def validate_rule(rule: dict[str, Any], node_ids: set[str]) -> None:
    require_fields(rule, ["id", "sourceType", "sourceNodeId", "metric", "operator"], "Rule")
    if rule["sourceNodeId"] not in node_ids:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"Rule {rule['id']} references an unknown source node")
    allowed_metrics = {
        "assessment": {"completion", "passed", "score", "score_range"},
        "unit": {"completion", "time_spent_minutes", "percentage_completion"},
    }
    source_type = rule["sourceType"]
    metric = rule["metric"]
    if source_type not in allowed_metrics or metric not in allowed_metrics[source_type]:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"Rule {rule['id']} uses an invalid metric")
    if rule["operator"] not in {"eq", "ne", "gt", "gte", "lt", "lte", "between"}:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"Rule {rule['id']} uses an invalid operator")
    if rule["operator"] == "between" or metric == "score_range":
        range_value = rule.get("range")
        if not isinstance(range_value, dict) or "min" not in range_value or "max" not in range_value:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Rule {rule['id']} requires a min/max range")
    elif "value" not in rule:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"Rule {rule['id']} requires a value")


def compare(actual: Any, operator: str, expected: Any, range_value: dict[str, Any] | None = None) -> bool:
    if operator == "eq":
        return actual == expected
    if operator == "ne":
        return actual != expected
    if operator == "gt":
        return actual > expected
    if operator == "gte":
        return actual >= expected
    if operator == "lt":
        return actual < expected
    if operator == "lte":
        return actual <= expected
    if operator == "between" and range_value:
        min_ok = actual >= range_value["min"] if range_value.get("minInclusive", True) else actual > range_value["min"]
        max_ok = actual <= range_value["max"] if range_value.get("maxInclusive", True) else actual < range_value["max"]
        return min_ok and max_ok
    return False


def evaluate_path(path_id: str, learner_context: dict[str, Any]) -> dict[str, Any]:
    learning_path = load_learning_path(path_id)
    current_node_id = learner_context.get("currentNodeId")
    if not current_node_id:
        raise ApiError(HTTPStatus.BAD_REQUEST, "currentNodeId is required")

    candidates = [
        edge for edge in learning_path["edges"] if edge["sourceNodeId"] == current_node_id
    ]
    candidates.sort(key=lambda edge: edge.get("priority", 999))
    for edge in candidates:
        rules = edge["conditions"]["rules"]
        operator = edge["conditions"]["operator"]
        results = [evaluate_rule(rule, learner_context) for rule in rules]
        matched = all(results) if operator == "AND" else any(results)
        if (not rules and edge.get("isDefault")) or matched:
            return {"edgeId": edge["id"], "nextNodeId": edge["targetNodeId"], "matched": True}

    default_edge = next((edge for edge in candidates if edge.get("isDefault")), None)
    if default_edge:
        return {"edgeId": default_edge["id"], "nextNodeId": default_edge["targetNodeId"], "matched": False}
    return {"edgeId": None, "nextNodeId": None, "matched": False}


def evaluate_rule(rule: dict[str, Any], learner_context: dict[str, Any]) -> bool:
    node_state = learner_context.get("nodes", {}).get(rule["sourceNodeId"], {})
    metric = rule["metric"]
    if metric == "score_range":
        actual = node_state.get("score")
        return actual is not None and compare(actual, "between", None, rule.get("range"))
    actual = node_state.get(metric)
    return actual is not None and compare(actual, rule["operator"], rule.get("value"), rule.get("range"))


def load_learning_path(path_id: str) -> dict[str, Any]:
    if path_id == "default":
        return read_json(DEFAULT_PATH)
    path = SAVED_DIR / f"{path_id}.json"
    if not path.exists():
        raise ApiError(HTTPStatus.NOT_FOUND, "Learning path not found")
    return read_json(path)


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.add_common_headers()
        self.end_headers()

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/health":
                self.send_json({"ok": True})
            elif parsed.path == "/api/components":
                self.send_json(read_json(COMPONENTS_PATH))
            elif parsed.path == "/api/learning-paths/default":
                self.send_json(load_learning_path("default"))
            elif parsed.path.startswith("/api/learning-paths/"):
                path_id = parsed.path.rsplit("/", 1)[-1]
                self.send_json(load_learning_path(path_id))
            else:
                raise ApiError(HTTPStatus.NOT_FOUND, "Route not found")
        except ApiError as error:
            self.send_error_json(error)

    def do_POST(self) -> None:
        try:
            parsed = urlparse(self.path)
            payload = self.read_body()
            if parsed.path == "/api/learning-paths":
                validate_learning_path(payload)
                path_id = payload.get("id") or f"lp-{slugify(payload['name'])}"
                payload["id"] = path_id
                write_json(SAVED_DIR / f"{path_id}.json", payload)
                self.send_json(payload, HTTPStatus.CREATED)
            elif parsed.path.endswith("/evaluate") and parsed.path.startswith("/api/learning-paths/"):
                path_id = parsed.path.split("/")[-2]
                self.send_json(evaluate_path(path_id, payload))
            else:
                raise ApiError(HTTPStatus.NOT_FOUND, "Route not found")
        except ApiError as error:
            self.send_error_json(error)
        except json.JSONDecodeError:
            self.send_error_json(ApiError(HTTPStatus.BAD_REQUEST, "Invalid JSON body"))

    def read_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def send_json(self, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.add_common_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, error: ApiError) -> None:
        self.send_json({"error": error.message}, error.status)

    def add_common_headers(self) -> None:
        origin = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    SAVED_DIR.mkdir(exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 8000), Handler)
    print("API server listening on http://127.0.0.1:8000")
    server.serve_forever()


if __name__ == "__main__":
    main()
