# Adaptive Learning Path Builder

Full-stack assessment implementation for building adaptive learning paths with draggable content nodes, directed edges, conditional routing rules, save/reload persistence, and a UI modeled on the provided reference screen.

## Stack

- Frontend: React, TypeScript, Vite
- Backend: Python standard library HTTP server
- Persistence: JSON files under `backend/data/learning-paths`
- Tests: Python `unittest`

## Features

- `GET /api/components` loads draggable unit and assessment content for the left panel.
- Canvas supports dropping catalog items, repositioning nodes, and selecting nodes or edges.
- Directed edges are created by clicking a node connector and then a target node.
- Properties panel edits node labels, descriptions, durations, assessment scoring, edge labels, priority, default routing, and rule thresholds.
- Edge rules support assessment metrics (`completion`, `passed`, `score`, `score_range`) and unit metrics (`completion`, `time_spent_minutes`, `percentage_completion`).
- `POST /api/learning-paths` saves a schema-shaped learning path payload.
- `GET /api/learning-paths/{id}` reloads saved paths.
- `POST /api/learning-paths/{id}/evaluate` evaluates the next node from learner context.

## Setup

Install frontend dependencies:

```bash
npm install
```

Run the API:

```bash
npm run api
```

In a second terminal, run the frontend:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

## Verification

Run backend/model tests:

```bash
npm test
```

Run the frontend type check and production build:

```bash
npm run build
```

## API Examples

Save a learning path:

```bash
curl -X POST http://127.0.0.1:8000/api/learning-paths \
  -H "Content-Type: application/json" \
  --data @backend/data/default-learning-path.json
```

Evaluate routing from Math Module 1:

```bash
curl -X POST http://127.0.0.1:8000/api/learning-paths/default/evaluate \
  -H "Content-Type: application/json" \
  -d '{"currentNodeId":"node-math-1","nodes":{"node-math-1":{"completion":true,"passed":false,"score":42}}}'
```

## Files From The Brief

- `schemas/available-content.schema.json`
- `schemas/learning-path.schema.json`
- `backend/data/components.json` preserves the provided minimal component example.
- `backend/data/default-learning-path.json` seeds a fuller SAT-style adaptive flow for the demo UI.

## Assumptions And Tradeoffs

- The backend uses direct Python validation for the schema-critical fields instead of a third-party JSON Schema validator to keep setup lightweight.
- The visual builder uses custom React interactions rather than a graph library, keeping the project small while still supporting placement, movement, branching edges, and condition editing.
- The provided example component catalog has only two items, so the running demo uses `demo-components.json` with additional SAT-style modules.
