import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FolderIcon from "@mui/icons-material/Folder";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import MouseIcon from "@mui/icons-material/Mouse";
import CodeIcon from "@mui/icons-material/Code";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

type ComponentType = "unit" | "assessment";
type NodeType = "start" | "unit" | "assessment" | "end";
type Selection = { kind: "node"; id: string } | { kind: "edge"; id: string } | null;

type ContentComponent = {
  id: string;
  title: string;
  shortDescription: string;
  type: ComponentType;
  approximateDurationMinutes: number;
  metadata?: {
    assessment?: { maxScore: number; passingScore: number };
    unit?: { recommendedMinutes?: number };
  };
};

type LearningNode = {
  id: string;
  componentId: string;
  type: NodeType;
  label: string;
  description?: string;
  position: { x: number; y: number };
  config?: {
    approximateDurationMinutes?: number;
    assessment?: { maxScore: number; passingScore: number };
  };
};

type Rule = {
  id: string;
  sourceType: "assessment" | "unit";
  sourceNodeId: string;
  metric: "completion" | "passed" | "score" | "score_range" | "time_spent_minutes" | "percentage_completion";
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "between";
  value?: boolean | number | string;
  range?: { min: number; max: number; minInclusive?: boolean; maxInclusive?: boolean };
};

type LearningEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  priority?: number;
  isDefault?: boolean;
  conditions: { operator: "AND" | "OR"; rules: Rule[] };
};

type LearningPath = {
  id?: string;
  name: string;
  description?: string;
  status: "draft" | "published";
  version?: number;
  canvas?: { zoom?: number; offsetX?: number; offsetY?: number };
  nodes: LearningNode[];
  edges: LearningEdge[];
};

const NODE_WIDTH = 240;
const NODE_HEIGHT = 76;
const API_BASE_URL = "http://localhost:8000";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    background: { default: "#f5f7fb", paper: "#ffffff" },
  },
  typography: {
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
    fontSize: 13,
  },
  shape: { borderRadius: 8 },
});

const fallbackComponents: ContentComponent[] = [
  { id: "cmp-section", title: "Section", shortDescription: "Add a new section to the learning path.", type: "assessment", approximateDurationMinutes: 0, metadata: { assessment: { maxScore: 100, passingScore: 50 } } },
  { id: "cmp-group", title: "Group", shortDescription: "Add a new group to the learning path.", type: "unit", approximateDurationMinutes: 0, metadata: { unit: { recommendedMinutes: 0 } } },
];

const fallbackPath: LearningPath = {
  id: "lp-sat-adaptive-001",
  name: "SAT Adaptive Path",
  description: "Routes learners based on math and reading performance.",
  status: "draft",
  version: 1,
  canvas: { zoom: 0.7, offsetX: 0, offsetY: 0 },
  nodes: [
    { id: "node-start", componentId: "system-start", type: "start", label: "Start Assessment", position: { x: 420, y: 40 } },
    { id: "node-math-1", componentId: "cmp-assess-math-1", type: "assessment", label: "Math Module 1", position: { x: 420, y: 150 }, config: { approximateDurationMinutes: 35, assessment: { maxScore: 100, passingScore: 50 } } },
    { id: "node-math-2-easy", componentId: "cmp-unit-math-2-easy", type: "unit", label: "Math Module 2 - Easy", position: { x: 270, y: 330 }, config: { approximateDurationMinutes: 35 } },
    { id: "node-math-2-advanced", componentId: "cmp-unit-math-2-advanced", type: "unit", label: "Math Module 2 - Advanced", position: { x: 590, y: 330 }, config: { approximateDurationMinutes: 35 } },
    { id: "node-reading-1", componentId: "cmp-assess-reading-1", type: "assessment", label: "Reading and Writing Module 1", position: { x: 420, y: 500 }, config: { approximateDurationMinutes: 32, assessment: { maxScore: 100, passingScore: 50 } } },
    { id: "node-reading-easy", componentId: "cmp-unit-reading-easy", type: "unit", label: "R&W Module 2 - Easy", position: { x: 270, y: 680 }, config: { approximateDurationMinutes: 32 } },
    { id: "node-reading-advanced", componentId: "cmp-unit-reading-advanced", type: "unit", label: "R&W Module 2 - Advanced", position: { x: 590, y: 680 }, config: { approximateDurationMinutes: 32 } },
    { id: "node-end", componentId: "system-end", type: "end", label: "Complete Assessment", position: { x: 420, y: 850 } },
  ],
  edges: [
    { id: "edge-start-math1", sourceNodeId: "node-start", targetNodeId: "node-math-1", label: "Start assessment", priority: 1, isDefault: true, conditions: { operator: "AND", rules: [] } },
    { id: "edge-math1-easy", sourceNodeId: "node-math-1", targetNodeId: "node-math-2-easy", label: "Score below 50", priority: 1, isDefault: false, conditions: { operator: "AND", rules: [{ id: "rule-math1-low", sourceType: "assessment", sourceNodeId: "node-math-1", metric: "score_range", operator: "between", range: { min: 0, max: 49, minInclusive: true, maxInclusive: true } }] } },
    { id: "edge-math1-advanced", sourceNodeId: "node-math-1", targetNodeId: "node-math-2-advanced", label: "Passed", priority: 2, isDefault: false, conditions: { operator: "AND", rules: [{ id: "rule-math1-passed", sourceType: "assessment", sourceNodeId: "node-math-1", metric: "passed", operator: "eq", value: true }] } },
    { id: "edge-math-advanced-reading", sourceNodeId: "node-math-2-advanced", targetNodeId: "node-reading-1", label: "Continue", priority: 1, isDefault: true, conditions: { operator: "AND", rules: [] } },
    { id: "edge-reading-easy", sourceNodeId: "node-reading-1", targetNodeId: "node-reading-easy", label: "Score below 50", priority: 1, isDefault: false, conditions: { operator: "AND", rules: [{ id: "rule-reading-low", sourceType: "assessment", sourceNodeId: "node-reading-1", metric: "score_range", operator: "between", range: { min: 0, max: 49, minInclusive: true, maxInclusive: true } }] } },
    { id: "edge-reading-advanced", sourceNodeId: "node-reading-1", targetNodeId: "node-reading-advanced", label: "Passed", priority: 2, isDefault: false, conditions: { operator: "AND", rules: [{ id: "rule-reading-passed", sourceType: "assessment", sourceNodeId: "node-reading-1", metric: "passed", operator: "eq", value: true }] } },
    { id: "edge-reading-end", sourceNodeId: "node-reading-advanced", targetNodeId: "node-end", label: "Finish", priority: 1, isDefault: true, conditions: { operator: "AND", rules: [] } },
  ],
};

function App() {
  const [components, setComponents] = useState<ContentComponent[]>(fallbackComponents);
  const [path, setPath] = useState<LearningPath>(fallbackPath);
  const [selection, setSelection] = useState<Selection>({ kind: "node", id: "node-math-2-easy" });
  const [dragNode, setDragNode] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/components`).then((res) => res.json()),
      fetch(`${API_BASE_URL}/api/learning-paths/default`).then((res) => res.json()),
    ])
      .then(([componentResponse, learningPath]) => {
        setComponents(componentResponse.items);
        setPath(learningPath);
        setZoom(learningPath.canvas?.zoom ?? 0.7);
      })
      .catch(() => {
        setComponents(fallbackComponents);
        setPath(fallbackPath);
      });
  }, []);

  const selectedNode = selection?.kind === "node" ? path.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedEdge = selection?.kind === "edge" ? path.edges.find((e) => e.id === selection.id) : undefined;
  const startNodes = path.nodes.filter((n) => n.type === "assessment" || n.type === "unit");

  function canvasPoint(event: React.DragEvent | React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: (event.clientX - (rect?.left ?? 0)) / zoom - NODE_WIDTH / 2 - pan.x / zoom,
      y: (event.clientY - (rect?.top ?? 0)) / zoom - NODE_HEIGHT / 2 - pan.y / zoom,
    };
  }

  function addNode(component: ContentComponent, point: { x: number; y: number }) {
    const count = path.nodes.filter((n) => n.componentId === component.id).length + 1;
    const node: LearningNode = {
      id: `node-${component.id}-${Date.now()}`,
      componentId: component.id,
      type: component.type,
      label: count > 1 ? `${component.title} ${count}` : component.title.replace(" Assessment", ""),
      description: component.shortDescription,
      position: { x: Math.max(40, point.x), y: Math.max(40, point.y) },
      config: { approximateDurationMinutes: component.approximateDurationMinutes, assessment: component.metadata?.assessment },
    };
    setPath((c) => ({ ...c, nodes: [...c.nodes, node] }));
    setSelection({ kind: "node", id: node.id });
  }

  function updateNode(id: string, patch: Partial<LearningNode>) {
    setPath((c) => ({ ...c, nodes: c.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  }

  function updateEdge(id: string, patch: Partial<LearningEdge>) {
    setPath((c) => ({ ...c, edges: c.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }

  function removeSelection() {
    if (!selection) return;
    if (selection.kind === "node" && selection.id !== "node-start") {
      setPath((c) => ({
        ...c,
        nodes: c.nodes.filter((n) => n.id !== selection.id),
        edges: c.edges.filter((e) => e.sourceNodeId !== selection.id && e.targetNodeId !== selection.id),
      }));
    }
    if (selection.kind === "edge") {
      setPath((c) => ({ ...c, edges: c.edges.filter((e) => e.id !== selection.id) }));
    }
    setSelection(null);
  }

  function createOrSelectEdge(targetNodeId: string) {
    if (!pendingSourceId || pendingSourceId === targetNodeId) {
      setPendingSourceId(null);
      return;
    }
    const existing = path.edges.find((e) => e.sourceNodeId === pendingSourceId && e.targetNodeId === targetNodeId);
    if (existing) {
      setSelection({ kind: "edge", id: existing.id });
      setPendingSourceId(null);
      return;
    }
    const sourceNode = path.nodes.find((n) => n.id === pendingSourceId);
    const edge: LearningEdge = {
      id: `edge-${pendingSourceId}-${targetNodeId}-${Date.now()}`,
      sourceNodeId: pendingSourceId,
      targetNodeId,
      label: "New condition",
      priority: 1,
      isDefault: false,
      conditions: { operator: "AND", rules: sourceNode && sourceNode.type !== "start" && sourceNode.type !== "end" ? [defaultRule(sourceNode)] : [] },
    };
    setPath((c) => ({ ...c, edges: [...c.edges, edge] }));
    setSelection({ kind: "edge", id: edge.id });
    setPendingSourceId(null);
  }

  async function save(status: "draft" | "published") {
    const payload = { ...path, status, canvas: { zoom, offsetX: 0, offsetY: 0 } };
    try {
      const response = await fetch(`${API_BASE_URL}/api/learning-paths`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setToast({ open: true, message: data.error ?? "Save failed", severity: "error" });
        return;
      }
      setPath(data);
      setToast({ open: true, message: status === "published" ? "Published and persisted" : "Draft saved", severity: "success" });
    } catch {
      setToast({ open: true, message: "Save failed", severity: "error" });
    }
  }

  const graphBounds = useMemo(() => {
    const maxY = Math.max(...path.nodes.map((n) => n.position.y), 900);
    return { height: maxY + 180 };
  }, [path.nodes]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <AppBar position="static" color="default" elevation={1} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Toolbar sx={{ gap: 1, minHeight: 64 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Adaptive Learning Path Builder</Typography>
              <Typography variant="caption" color="text.secondary">Create conditional quiz flows with adaptive sections</Typography>
            </Box>
            <Chip icon={<CodeIcon sx={{ fontSize: 14 }} />} label={API_BASE_URL + "/"} size="small" variant="outlined" sx={{ fontFamily: "monospace", fontSize: 11 }} />
            <Button size="small" startIcon={<MouseIcon />} variant="contained" sx={{ textTransform: "none" }}>Builder</Button>
            <Button size="small" startIcon={<VisibilityIcon />} sx={{ textTransform: "none" }}>Preview</Button>
            <Divider orientation="vertical" flexItem />
            <Button size="small" startIcon={<SaveIcon />} onClick={() => save("draft")} sx={{ textTransform: "none" }}>Save Draft</Button>
            <Button size="small" startIcon={<PlayArrowIcon />} variant="contained" color="primary" onClick={() => save("published")} sx={{ textTransform: "none" }}>Publish</Button>
          </Toolbar>
        </AppBar>

        {/* Workspace */}
        <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: "220px 1fr 280px", minHeight: 0, overflow: "hidden" }}>
          {/* Left Panel */}
          <Paper elevation={0} square sx={{ borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box sx={{ p: 1.5, pb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Add Components</Typography>
              <Typography variant="caption" color="text.secondary">Drag or click to add to canvas</Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: "auto", px: 1.5, pb: 1 }}>
              <Stack spacing={1}>
                {components.map((component) => (
                  <Card
                    key={component.id}
                    draggable
                    elevation={0}
                    onClick={() => addNode(component, { x: 420, y: 240 + path.nodes.length * 28 })}
                    onDragStart={(e) => e.dataTransfer.setData("component", JSON.stringify(component))}
                    sx={{ cursor: "grab", border: 1, borderColor: "divider", "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" } }}
                  >
                    <CardContent sx={{ p: 1, "&:last-child": { pb: 1 }, display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "white", bgcolor: component.type === "assessment" ? "primary.main" : "purple" }}>
                        {component.type === "assessment" ? <AssessmentIcon sx={{ fontSize: 16 }} /> : <FolderIcon sx={{ fontSize: 16 }} />}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{component.title}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 10 }}>{component.shortDescription}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
            <Box sx={{ p: 1.5, borderTop: 1, borderColor: "divider" }}>
              <Paper variant="outlined" sx={{ p: 1.2, bgcolor: "grey.50" }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>How it works</Typography>
                <Stack spacing={0.5}>
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}><FiberManualRecordIcon sx={{ fontSize: 8 }} /> Drag content onto the canvas.</Typography>
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}><FiberManualRecordIcon sx={{ fontSize: 8 }} /> Drag from a node connector to another node.</Typography>
                  <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}><FiberManualRecordIcon sx={{ fontSize: 8 }} /> Select an edge to define rules.</Typography>
                </Stack>
              </Paper>
            </Box>
          </Paper>

          {/* Canvas */}
          <Box
            sx={{
              position: "relative",
              overflow: "hidden",
              cursor: panning ? "grabbing" : "grab",
              bgcolor: "grey.100",
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(101,116,139,0.13) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const component = JSON.parse(e.dataTransfer.getData("component")) as ContentComponent;
              addNode(component, canvasPoint(e));
            }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("[data-node-id]") || (e.target as HTMLElement).closest(".zoom-controls")) return;
              setPanning({ startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y });
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (connecting) {
                const rect = canvasRef.current?.getBoundingClientRect();
                setConnecting({ ...connecting, x: (e.clientX - (rect?.left ?? 0)) / zoom - pan.x / zoom, y: (e.clientY - (rect?.top ?? 0)) / zoom - pan.y / zoom });
              }
              if (panning) {
                setPan({ x: panning.originX + (e.clientX - panning.startX), y: panning.originY + (e.clientY - panning.startY) });
              }
            }}
            onPointerUp={(e) => {
              if (connecting) {
                const target = (e.target as HTMLElement).closest("[data-node-id]");
                if (target) {
                  const targetNode = path.nodes.find((n) => n.id === target.getAttribute("data-node-id"));
                  if (targetNode && targetNode.id !== connecting.sourceId) createOrSelectEdge(targetNode.id);
                }
                setConnecting(null);
              }
              setPanning(null);
            }}
          >
            {/* Zoom Controls */}
            <Box className="zoom-controls" sx={{ position: "absolute", top: 12, right: 12, zIndex: 5, display: "flex", alignItems: "center", gap: 0.5, bgcolor: "rgba(255,255,255,0.9)", border: 1, borderColor: "divider", borderRadius: 1, px: 0.5, boxShadow: 1 }}>
              <IconButton size="small" onClick={() => setZoom((v) => Math.max(0.35, v - 0.1))}><ZoomOutIcon fontSize="small" /></IconButton>
              <Typography variant="caption" sx={{ minWidth: 36, textAlign: "center" }}>{Math.round(zoom * 100)}%</Typography>
              <IconButton size="small" onClick={() => setZoom((v) => Math.min(1.4, v + 0.1))}><ZoomInIcon fontSize="small" /></IconButton>
            </Box>

            {/* Canvas Content */}
            <Box ref={canvasRef} sx={{ position: "relative", width: "100%", height: "100%" }}>
              <Box sx={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "top left", height: graphBounds.height, position: "relative" }}>
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: graphBounds.height, overflow: "visible" }}>
                  {path.edges.map((edge) => (
                    <EdgePath key={edge.id} edge={edge} nodes={path.nodes} selected={selection?.kind === "edge" && selection.id === edge.id} onSelect={() => setSelection({ kind: "edge", id: edge.id })} />
                  ))}
                  {connecting &&
                    (() => {
                      const source = path.nodes.find((n) => n.id === connecting.sourceId);
                      if (!source) return null;
                      const sx = source.position.x + NODE_WIDTH / 2;
                      const sy = source.position.y + NODE_HEIGHT;
                      const midY = (sy + connecting.y) / 2;
                      return <path d={`M ${sx} ${sy} C ${sx} ${midY}, ${connecting.x} ${midY}, ${connecting.x} ${connecting.y}`} fill="none" stroke="#1976d2" strokeWidth={2} strokeDasharray="6 4" opacity={0.7} />;
                    })()}
                </svg>
                {path.nodes.map((node) => (
                  <NodeCard
                    key={node.id}
                    node={node}
                    selected={selection?.kind === "node" && selection.id === node.id}
                    pending={pendingSourceId === node.id}
                    onPointerDown={(e) => {
                      if ((e.target as HTMLElement).closest(".connector")) return;
                      e.stopPropagation();
                      const point = canvasPoint(e);
                      setDragNode({ id: node.id, dx: point.x - node.position.x, dy: point.y - node.position.y });
                      setSelection({ kind: "node", id: node.id });
                    }}
                    onPointerMove={(e) => {
                      if (dragNode?.id !== node.id) return;
                      const point = canvasPoint(e);
                      updateNode(node.id, { position: { x: point.x - dragNode.dx, y: point.y - dragNode.dy } });
                    }}
                    onPointerUp={() => setDragNode(null)}
                    onConnect={(e) => {
                      const rect = canvasRef.current?.getBoundingClientRect();
                      setPendingSourceId(node.id);
                      setConnecting({ sourceId: node.id, x: (e.clientX - (rect?.left ?? 0)) / zoom - pan.x / zoom, y: (e.clientY - (rect?.top ?? 0)) / zoom - pan.y / zoom });
                    }}
                    onClick={() => (pendingSourceId ? createOrSelectEdge(node.id) : setSelection({ kind: "node", id: node.id }))}
                  />
                ))}
              </Box>
            </Box>
          </Box>

          {/* Right Panel */}
          <Paper elevation={0} square sx={{ borderLeft: 1, borderColor: "divider", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Properties</Typography>
                <Typography variant="caption" color="text.secondary">{selection?.kind === "edge" ? "Connection" : "Section"}</Typography>
              </Box>
              <IconButton size="small" color="error" onClick={removeSelection} title="Delete selected"><DeleteIcon fontSize="small" /></IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: "auto" }}>
              {selectedNode && <NodeProperties node={selectedNode} onChange={(patch) => updateNode(selectedNode.id, patch)} />}
              {selectedEdge && <EdgeProperties edge={selectedEdge} nodes={startNodes} onChange={(patch) => updateEdge(selectedEdge.id, patch)} />}
            </Box>
          </Paper>
        </Box>

        {/* Toast */}
        <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "left" }}>
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ width: "100%" }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

function defaultRule(sourceNode: LearningNode): Rule {
  if (sourceNode.type === "assessment") {
    return { id: `rule-${Date.now()}`, sourceType: "assessment", sourceNodeId: sourceNode.id, metric: "score", operator: "gte", value: sourceNode.config?.assessment?.passingScore ?? 50 };
  }
  return { id: `rule-${Date.now()}`, sourceType: "unit", sourceNodeId: sourceNode.id, metric: "percentage_completion", operator: "gte", value: 80 };
}

function EdgePath({ edge, nodes, selected, onSelect }: { edge: LearningEdge; nodes: LearningNode[]; selected: boolean; onSelect: () => void }) {
  const source = nodes.find((n) => n.id === edge.sourceNodeId);
  const target = nodes.find((n) => n.id === edge.targetNodeId);
  if (!source || !target) return null;
  const sx = source.position.x + NODE_WIDTH / 2;
  const sy = source.position.y + NODE_HEIGHT;
  const tx = target.position.x + NODE_WIDTH / 2;
  const ty = target.position.y;
  const midY = (sy + ty) / 2;
  const d = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
  return (
    <g onClick={onSelect} style={{ cursor: "pointer" }}>
      <path d={d} fill="none" stroke="transparent" strokeWidth={18} />
      <path d={d} fill="none" stroke={selected ? "#9c27b0" : "#72829b"} strokeWidth={selected ? 3 : 2} strokeDasharray={selected ? "5 5" : "none"} />
      <circle cx={tx} cy={ty} r={4} fill="#1976d2" stroke="#fff" strokeWidth={2} />
      {edge.label && <text x={(sx + tx) / 2 + 8} y={midY - 8} fill="#51617a" fontSize={11} style={{ paintOrder: "stroke", stroke: "#f6f8fb", strokeWidth: 4 }}>{edge.label}</text>}
    </g>
  );
}

function NodeCard(props: {
  node: LearningNode;
  selected: boolean;
  pending: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onConnect: (e: React.PointerEvent) => void;
  onClick: () => void;
}) {
  const { node } = props;
  const duration = node.config?.approximateDurationMinutes;
  const borderColor = node.type === "start" ? "#00c853" : node.type === "end" ? "#9e9e9e" : props.selected ? "#9c27b0" : "#1976d2";
  const bgcolor = node.type === "start" ? "#e8f5e9" : node.type === "end" ? "#f5f5f5" : "#e3f2fd";
  return (
    <Paper
      data-node-id={node.id}
      elevation={props.selected ? 4 : 2}
      sx={{
        position: "absolute",
        left: node.position.x,
        top: node.position.y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        border: 2,
        borderColor,
        bgcolor,
        borderRadius: 1,
        display: "grid",
        gridTemplateColumns: "28px 1fr 24px",
        alignItems: "center",
        gap: 1,
        p: 1,
        cursor: "grab",
        userSelect: "none",
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:active": { cursor: "grabbing" },
      }}
      onPointerDown={props.onPointerDown}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onClick={props.onClick}
    >
      <Box sx={{ width: 28, height: 28, borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "white", bgcolor: node.type === "start" ? "#00c853" : node.type === "end" ? "#9e9e9e" : node.type === "assessment" ? "#1976d2" : "#9c27b0" }}>
        {node.type === "assessment" ? <AssessmentIcon sx={{ fontSize: 16 }} /> : node.type === "unit" ? <FolderIcon sx={{ fontSize: 16 }} /> : <FiberManualRecordIcon sx={{ fontSize: 16 }} />}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 10 }}>
          {duration ? `${node.type === "assessment" ? "Assessment" : "Unit"} - ${duration} min` : node.description ?? "System section"}
        </Typography>
      </Box>
      {node.type !== "end" && (
        <Box
          className="connector"
          onPointerDown={(e) => { e.stopPropagation(); props.onConnect(e as unknown as React.PointerEvent); }}
          sx={{ width: 22, height: 22, borderRadius: "50%", border: 1, borderColor: "primary.light", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "white", color: "primary.main", cursor: "crosshair", "&:hover": { bgcolor: "primary.light", color: "white" } }}
        >
          <AddIcon sx={{ fontSize: 14 }} />
        </Box>
      )}
    </Paper>
  );
}

function NodeProperties({ node, onChange }: { node: LearningNode; onChange: (patch: Partial<LearningNode>) => void }) {
  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField label="Label" size="small" fullWidth value={node.label} onChange={(e) => onChange({ label: e.target.value })} />
      <TextField label="Description" size="small" fullWidth multiline rows={2} value={node.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <TextField label="Duration (min)" size="small" type="number" value={node.config?.approximateDurationMinutes ?? 0} onChange={(e) => onChange({ config: { ...node.config, approximateDurationMinutes: Number(e.target.value) } })} />
        <TextField label="Type" size="small" value={node.type} disabled />
      </Box>
      {node.type === "assessment" && (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <TextField label="Max Score" size="small" type="number" value={node.config?.assessment?.maxScore ?? 100} onChange={(e) => onChange({ config: { ...node.config, assessment: { maxScore: Number(e.target.value), passingScore: node.config?.assessment?.passingScore ?? 50 } } })} />
          <TextField label="Passing Score" size="small" type="number" value={node.config?.assessment?.passingScore ?? 50} onChange={(e) => onChange({ config: { ...node.config, assessment: { maxScore: node.config?.assessment?.maxScore ?? 100, passingScore: Number(e.target.value) } } })} />
        </Box>
      )}
    </Box>
  );
}

function EdgeProperties({ edge, nodes, onChange }: { edge: LearningEdge; nodes: LearningNode[]; onChange: (patch: Partial<LearningEdge>) => void }) {
  const rule = edge.conditions.rules[0];
  const sourceNode = nodes.find((n) => n.id === (rule?.sourceNodeId ?? edge.sourceNodeId));
  const metricOptions = sourceNode?.type === "unit" ? ["completion", "time_spent_minutes", "percentage_completion"] : ["completion", "passed", "score", "score_range"];

  function updateRule(patch: Partial<Rule>) {
    const nextRule = { ...(rule ?? defaultRule(sourceNode ?? nodes[0])), ...patch };
    onChange({ conditions: { ...edge.conditions, rules: [nextRule] } });
  }

  return (
    <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
      <TextField label="Label" size="small" fullWidth value={edge.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} />
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, alignItems: "center" }}>
        <TextField label="Priority" size="small" type="number" value={edge.priority ?? 1} onChange={(e) => onChange({ priority: Number(e.target.value) })} />
        <FormControlLabel control={<Checkbox size="small" checked={edge.isDefault ?? false} onChange={(e) => onChange({ isDefault: e.target.checked })} />} label={<Typography variant="caption">Default</Typography>} />
      </Box>
      <Divider />
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>Assignment Conditions</Typography>
        <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={() => onChange({ conditions: { ...edge.conditions, rules: [defaultRule(sourceNode ?? nodes[0])] } })} sx={{ textTransform: "none" }}>Add</Button>
      </Box>
      <FormControl size="small" fullWidth>
        <InputLabel>Source Section</InputLabel>
        <Select label="Source Section" value={rule?.sourceNodeId ?? edge.sourceNodeId} onChange={(e) => {
          const nextNode = nodes.find((n) => n.id === e.target.value) ?? nodes[0];
          updateRule({ sourceNodeId: nextNode.id, sourceType: nextNode.type as "assessment" | "unit", metric: nextNode.type === "unit" ? "percentage_completion" : "score", operator: "gte", value: 50, range: undefined });
        }}>
          {nodes.map((n) => <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>)}
        </Select>
      </FormControl>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Metric</InputLabel>
          <Select label="Metric" value={rule?.metric ?? "score"} onChange={(e) => updateRule({ metric: e.target.value as Rule["metric"], operator: e.target.value === "score_range" ? "between" : "gte", value: e.target.value === "score_range" ? undefined : 50, range: e.target.value === "score_range" ? { min: 0, max: 49, minInclusive: true, maxInclusive: true } : undefined })}>
            {metricOptions.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Operator</InputLabel>
          <Select label="Operator" value={rule?.operator ?? "gte"} onChange={(e) => updateRule({ operator: e.target.value as Rule["operator"] })}>
            {["eq", "ne", "gt", "gte", "lt", "lte", "between"].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      {rule?.operator === "between" || rule?.metric === "score_range" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <TextField label="Min" size="small" type="number" value={rule?.range?.min ?? 0} onChange={(e) => updateRule({ range: { ...(rule?.range ?? { max: 100 }), min: Number(e.target.value) } })} />
          <TextField label="Max" size="small" type="number" value={rule?.range?.max ?? 100} onChange={(e) => updateRule({ range: { ...(rule?.range ?? { min: 0 }), max: Number(e.target.value) } })} />
        </Box>
      ) : (
        <TextField label="Threshold" size="small" type={rule?.metric === "completion" || rule?.metric === "passed" ? "text" : "number"} value={String(rule?.value ?? 50)} onChange={(e) => updateRule({ value: coerceValue(e.target.value, rule?.metric) })} />
      )}
      <Paper variant="outlined" sx={{ p: 1, bgcolor: "grey.50", fontSize: 12, color: "text.secondary" }}>
        Show if {sourceNode?.label ?? "section"} {describeRule(rule)}
      </Paper>
    </Box>
  );
}

function coerceValue(value: string, metric?: Rule["metric"]) {
  if (metric === "completion" || metric === "passed") return value.toLowerCase() === "true";
  return Number(value);
}

function describeRule(rule?: Rule) {
  if (!rule) return "matches";
  if (rule.operator === "between" || rule.metric === "score_range") return `score is ${rule.range?.min ?? 0}-${rule.range?.max ?? 100}`;
  return `${rule.metric} ${rule.operator} ${String(rule.value)}`;
}

createRoot(document.getElementById("root")!).render(<App />);
