TTL RDF Viewer

A lightweight browser-based TTL (Turtle) RDF viewer that lets you upload .ttl files, inspect triples, run simple SPARQL-like queries, and visualize the graph with D3.js.

Files
- index.html — main page
- styles.css — styles
- app.js — application logic (parser, query engine, visualization)

Usage
Open `index.html` in a browser (no server required). Upload a .ttl file (best for small files ~500 triples). Use the tabs to view triples, run queries, and visualize the graph.

Notes & Limitations
- The TTL parser is intentionally small and supports simple triples and @prefix declarations. It does not implement the full Turtle grammar.
- The SPARQL support is simulated and supports only simple SELECT queries with WHERE patterns, basic FILTER CONTAINS, LIMIT, and OFFSET.
- D3 visualization shows subjects and objects as nodes and predicates as edge labels.

Possible next steps
- Add proper Turtle parsing via a JS RDF library (e.g., N3.js).
- Add full SPARQL support with a client-side engine (e.g., Comunica).
- Improve UI/UX, accessibility, and tests.
