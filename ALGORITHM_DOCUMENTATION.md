# System Architecture Algorithms Documentation

## Overview

This document explains the core algorithms used in the System Architect Sandbox. The system analyzes software architecture designs through four main algorithms: cost estimation, performance simulation, simulation validation, and design validation.

---

## 1. Cost Estimation Algorithm

### Purpose
Calculate monthly infrastructure costs based on component types and their configuration properties.

### Algorithm Flow

```mermaid
graph TD
    A["Input: Nodes Array"] --> B["Initialize: Empty Items List"]
    B --> C{"Iterate through<br/>each Node"}
    C --> D["Extract Component ID<br/>& Properties"]
    D --> E{"Match Component<br/>Type"}
    E -->|web-server/app-server| F["Cost = $0.10/hr ×<br/>instances × 730 hrs"]
    E -->|microservice| G["Cost = $0.05/hr ×<br/>instances × 730 hrs"]
    E -->|sql-db| H["Cost = storage×$0.115 +<br/>$0.10/hr × nodes × 730"]
    E -->|nosql-db| I["Cost = RCU×$0.25 +<br/>WCU×$1.25"]
    E -->|cache| J["Cost = $0.017/hr ×<br/>nodes × 730"]
    E -->|cdn| K["Cost = 100GB ×<br/>$0.085/GB"]
    E -->|load-balancer| L["Cost = $16 +<br/>~$58 LCU usage"]
    E -->|message-queue| M["Cost = messages÷1M ×<br/>$0.40"]
    E -->|serverless| N["Cost = invocations÷1M ×<br/>$0.20 + compute"]
    E -->|object-storage| O["Cost = storage ×<br/>$0.023/GB"]
    E -->|data-warehouse| P["Cost = TB ×<br/>$5/TB × 30"]
    E -->|search-engine| Q["Cost = $0.12/hr ×<br/>nodes × 730"]
    
    F --> R["Add to Items<br/>with Breakdown"]
    G --> R
    H --> R
    I --> R
    J --> R
    K --> R
    L --> R
    M --> R
    N --> R
    O --> R
    P --> R
    Q --> R
    
    R --> S{"More<br/>Nodes?"}
    S -->|Yes| C
    S -->|No| T["Calculate Total = Sum<br/>of all costs"]
    T --> U["Return: Items + Total"]
```

### Cost Calculation Table

| Component | Formula | Example |
|-----------|---------|---------|
| Web/App Server | `$0.10/hr × instances × 730 hrs` | 2 instances = $146/mo |
| Microservice | `$0.05/hr × instances × 730 hrs` | 3 instances = $109.50/mo |
| SQL Database | `storage×$0.115 + $0.10/hr × (1+replicas)×730` | 100GB, 1 replica = $84.50/mo |
| NoSQL Database | `RCU×$0.25 + WCU×$1.25` | 100 RCU, 50 WCU = $87.50/mo |
| Cache | `$0.017/hr × nodes × 730` | 3 nodes = $37.23/mo |
| Message Queue | `(throughput×3600×730÷1M)×$0.40` | 10k msg/sec = ~$105/mo |
| Serverless | `(invocations÷1M)×$0.20 + compute` | 1M mo invocations = $200+ |

### Key Properties

- **Time Unit**: Monthly (730 hours)
- **Pricing Model**: Pay-as-you-go with per-unit costs
- **Accuracy**: Approximate; based on average configurations

---

## 2. Simulation Algorithm

### Purpose
Analyze performance characteristics: latency (p50/p95/p99), throughput, bottlenecks, availability, and redundancy.

### Main Algorithm Flow

```mermaid
graph TD
    A["Input: Nodes, Edges,<br/>SimulationConfig"] --> B{"Nodes Empty?"}
    B -->|Yes| C["Return Empty Result"]
    B -->|No| D["Create Node Map"]
    D --> E["Run BFS from Clients"]
    
    E --> F["Find All Request Paths"]
    F --> G["For Each Path:<br/>Calculate Latency"]
    
    G --> H["Identify Critical Path<br/>(Max Latency)"]
    H --> I["Calculate P50, P95, P99<br/>based on Load Config"]
    
    I --> J["Find Bottleneck Node<br/>(Min Throughput)"]
    J --> K["Calculate Capacity Ceiling"]
    
    K --> L["Calculate System Availability<br/>& SPOFs"]
    L --> M["Generate Recommendations"]
    M --> N["Return SimulationResult"]
```

### BFS Client Traversal Algorithm

```mermaid
graph TD
    A["Identify All Client Nodes<br/>web-client, mobile-client, iot-device"] --> B["Build Adjacency Map<br/>from Edges"]
    B --> C["For Each Client"]
    C --> D["Queue = [Client]<br/>Visited = {Client}"]
    D --> E["While Queue not empty"]
    E --> F["Dequeue Path"]
    F --> G{"Node Has<br/>Neighbors?"}
    G -->|No| H["Add Path to Results<br/>(Leaf Found)"]
    G -->|Yes| I["For Each Unvisited<br/>Neighbor"]
    I --> J["Mark Visited &<br/>Queue New Path"]
    J --> E
    E --> K["All Paths Found"]
```

### Critical Path & Latency Calculation

```mermaid
graph LR
    Client(Client: 0ms) --> LB["Load Balancer<br/>2ms"]
    LB --> API["API Gateway<br/>5ms"]
    API --> App["App Server<br/>15ms"]
    App --> DB["SQL DB<br/>5ms"]
    
    DB --> LR["Latency: 0+2+5+15+5<br/>= 27ms"]
```

### Throughput Bottleneck Detection

```mermaid
graph TD
    A["For Each Path:<br/>Find Min Throughput"] --> B["Component Throughput Map"]
    B --> C["Web Server: 500×instances RPS"]
    B --> D["App Server: 500×instances RPS"]
    B --> E["Microservice: 2000×instances RPS"]
    B --> F["Load Balancer: 100k RPS"]
    B --> G["API Gateway: rate-limit RPS"]
    B --> H["Database: 5000×(1+replicas)"]
    
    C --> I["Global Min = Bottleneck"]
    D --> I
    E --> I
    F --> I
    G --> I
    H --> I
    
    I --> J["Capacity Ceiling =<br/>Bottleneck Throughput"]
```

### Availability & SPOF Calculation

```mermaid
graph TD
    A["Base SLA per Component"] --> B["Load-Balancer: 99.99%"]
    A --> C["API-Gateway: 99.95%"]
    A --> D["Database: 99.95%"]
    A --> E["Cache: 99.99%"]
    
    B --> F["Series Availability =<br/>Product of All SLAs<br/>along critical path"]
    C --> F
    D --> F
    E --> F
    
    F --> G["Example: 99.99% × 99.95% × 99.95%<br/>= 99.89%"]
    
    G --> H["SPOF Detection:<br/>Single instance with<br/>no redundancy?"]
    H --> I["Add to SPOFs List"]
```

### Performance Metrics Calculation

```mermaid
graph TD
    A["Critical Path Latency<br/>(ms)"] --> B{"Load<br/>Config?"}
    
    B -->|Light| C["Percentile Offsets:<br/>P50: base<br/>P95: base×1.2<br/>P99: base×1.5"]
    
    B -->|Medium| D["Percentile Offsets:<br/>P50: base<br/>P95: base×1.5<br/>P99: base×2.0"]
    
    B -->|Heavy| E["Percentile Offsets:<br/>P50: base<br/>P95: base×2.0<br/>P99: base×3.0"]
    
    C --> F["Cache Hit Rate:<br/>~80% for reads"]
    D --> F
    E --> F
    
    F --> G["Queue Depth Peak:<br/>Bottleneck × load"]
```

---

## 3. Simulation Validation Algorithm

### Purpose
Validates that an architecture is valid for simulation, enforcing hard rules and soft warnings.

### Validation Rules & Decision Tree

```mermaid
graph TD
    A["Input: Nodes, Edges"] --> B["Build Adjacency &<br/>BFS Reachable Set"]
    
    B --> C["HARD VALIDATION<br/>(Blocks Simulation)"]
    
    C --> D{"Rule 1:<br/>Client Node<br/>Exists?"}
    D -->|No| E["ERROR: Add client<br/>node"]
    D -->|Yes| F{"Rule 2:<br/>Compute Node<br/>Reachable?"}
    
    F -->|No| G["ERROR: Connection<br/>to server/function"]
    F -->|Yes| H{"Rule 3:<br/>Client Direct<br/>to DB?"}
    
    H -->|Yes| I["ERROR: Route through<br/>middleware"]
    H -->|No| J{"Rule 4:<br/>Circular Sync<br/>Dependency?"}
    
    J -->|Yes| K["ERROR: Use async<br/>or remove cycle"]
    J -->|No| L["SOFT VALIDATION<br/>(Warnings)"]
    
    L --> M["Return: Errors,<br/>Warnings, ValidatedResult"]
```

### Circular Dependency Detection (DFS)

```mermaid
graph TD
    A["Sync Adjacency Map<br/>(exclude async edges)"] --> B["DFS Stack Tracking"]
    
    B --> C["For Each Unvisited<br/>Node"]
    C --> D["Mark: Visited + InStack"]
    D --> E{"Explore<br/>Neighbors"}
    
    E --> F{"Neighbor in<br/>InStack?"}
    F -->|Yes| G["CYCLE FOUND!<br/>Mark nodes"]
    F -->|No| H{"Neighbor<br/>Visited?"}
    
    H -->|No| I["Recurse on Neighbor"]
    H -->|Yes| J["Skip"]
    
    G --> K["Unmark InStack"]
    I --> K
    J --> K
    
    K --> L{"More<br/>Nodes?"}
    L -->|Yes| C
    L -->|No| M["Return Cycle Nodes"]
```

### BFS Reachability Analysis

```mermaid
graph TD
    A["Start from Client<br/>Nodes"] --> B["Visited Set = Clients"]
    B --> C["Queue = Clients"]
    C --> D["While Queue not empty"]
    D --> E["Dequeue Node"]
    E --> F["For Each Edge"]
    F --> G{"Target<br/>Visited?"}
    G -->|No| H["Mark Visited<br/>Queue Target"]
    G -->|Yes| I["Skip"]
    H --> D
    I --> D
    D --> J["Return Reachable Set"]
```

---

## 4. Design Validation Algorithm

### Purpose
Validate architecture design patterns and identify anti-patterns before simulation.

### Validation Rules

```mermaid
graph TD
    A["Input: Nodes, Edges"] --> B["Rule 1:<br/>Client→DB Direct?"]
    
    B -->|Found| C["WARNING: Add<br/>app server"]
    B -->|Ok| D["Rule 2:<br/>DB without<br/>Cache?"]
    
    D -->|Found| E["WARNING: Add<br/>Redis/Cache"]
    D -->|Ok| F["Rule 3:<br/>Single DB<br/>SPOF?"]
    
    F -->|Found| G["WARNING: Add<br/>Replicas"]
    F -->|Ok| H["Rule 4:<br/>Multiple Servers<br/>no LB?"]
    
    H -->|Found| I["ERROR: Add<br/>Load Balancer"]
    H -->|Ok| J["Rule 5:<br/>Message Queue?"]
    
    J -->|Found| K["INFO: Consider<br/>DLQ"]
    J -->|Ok| L["Rule 6:<br/>Cycle in<br/>Graph?"]
    
    L -->|Found| M["ERROR: Remove<br/>cycle"]
    L -->|Ok| N["Return Issues"]
```

### Cycle Detection Algorithm (DFS)

```mermaid
graph TD
    A["Build Adjacency Map<br/>from All Edges"] --> B["Visited = {}"]
    B --> C["InStack = {}"]
    C --> D["For Each Node"]
    
    D --> E["Visited.contains?"]
    E -->|Yes| F["Skip"]
    E -->|No| G["DFS(node)"]
    
    G --> H["Visited.add(node)"]
    H --> I["InStack.add(node)"]
    I --> J["For Each Neighbor"]
    
    J --> K{"Cycle<br/>Found?"}
    K -->|Yes| L["Return Found"]
    K -->|No| M{"Neighbor<br/>InStack?"}
    
    M -->|Yes| N["Cycle Detected!<br/>Add Nodes"]
    M -->|No| O{"Neighbor<br/>Visited?"}
    
    N --> P["Return Found"]
    O -->|No| Q["DFS(neighbor)"]
    O -->|Yes| R["Continue"]
    
    Q --> S["InStack.remove(node)"]
    R --> S
    S --> T["Continue to next"]
```

---

## Data Flow Diagram: Complete Analysis Pipeline

```mermaid
graph LR
    subgraph Input["Input"]
        Nodes["Nodes<br/>(Components)"]
        Edges["Edges<br/>(Connections)"]
        Config["Simulation<br/>Config"]
    end
    
    subgraph Step1["Validation Phase"]
        DV["Design Validation<br/>validate Design"]
        SV["Simulation Validation<br/>validateSimResult"]
    end
    
    subgraph Step2["Analysis Phase"]
        CE["Cost Estimation<br/>calculateCosts"]
        SIM["Simulation Engine<br/>runSimulation"]
    end
    
    subgraph Output["Output"]
        Issues["Validation Issues"]
        Costs["Cost Report"]
        Metrics["Performance Metrics"]
    end
    
    Nodes --> Step1
    Edges --> Step1
    Config --> SIM
    
    Step1 --> Step2
    Edges --> CE
    Nodes --> CE
    Nodes --> SIM
    Edges --> SIM
    
    CE --> Output
    SIM --> Output
    DV --> Issues
    SV --> Issues
```

---

## Algorithm Complexity Analysis

| Algorithm | Time Complexity | Space Complexity | Notes |
|-----------|-----------------|------------------|-------|
| Cost Estimation | O(n) | O(n) | n = number of nodes |
| BFS Path Finding | O(n + e) | O(n + e) | n = nodes, e = edges |
| Critical Path | O(p × n) | O(n) | p = number of paths |
| Bottleneck Find | O(p × n) | O(n) | Iterates all paths |
| Cycle Detection (DFS) | O(n + e) | O(n) | Graph DFS standard |
| Reachability (BFS) | O(n + e) | O(n) | Graph BFS standard |
| Hard Validation | O(n + e) | O(n) | Multiple passes through graph |
| Design Validation | O(n + e) | O(n) | DFS + feature checks |

---

## Key Design Patterns

### 1. **Map-Reduce Pattern for Costs**
```
Map: Each node → its cost calculation
Reduce: Sum all costs into total
```

### 2. **Graph Traversal Pattern**
```
Three main graph algorithms:
- BFS: Find all client paths
- DFS: Cycle detection
- Topological-aware: For availability calculation
```

### 3. **Validation Pipeline Pattern**
```
Hard Validation (fails immediately)
    ↓
Soft Validation (collects warnings)
    ↓
Simulation if all hard rules pass
    ↓
Return full result with issue context
```

### 4. **Aggregation Pattern for Metrics**
```
Per-path calculations
    ↓
Aggregate across all paths
    ↓
Extract critical/bottleneck values
    ↓
Calculate system-wide metrics
```

---

## Example: End-to-End Analysis

### Architecture
```
Client (web-browser)
  ↓
Load Balancer (1)
  ↓
API Gateway (1)
  ↓
App Server (2 instances)
  ↓
SQL Database (1 primary)
```

### Cost Estimation Result
- App Servers: $0.10/hr × 2 × 730 = **$146**
- Load Balancer: $16 + ~$58 = **$74**
- API Gateway: ~$50
- SQL DB: ~$85
- **Total: ~$355/month**

### Simulation Result
- **P50 Latency**: 27ms (client→LB→API→App→DB)
- **P95 Latency**: ~32ms (27 × 1.2)
- **P99 Latency**: ~40ms (27 × 1.5)
- **Throughput Ceiling**: Limited by App Server (~1000 RPS × 2 = 2000 RPS)
- **Availability**: 99.99% × 99.95% × 99.95% × 99.9% ≈ **99.78%**

### Validation Warnings
- No caching layer for read-heavy workload
- Database has no replicas (single point of failure)
- Consider auto-scaling for traffic spikes

---

## Implementation Notes

### Libraries Used
- **ReactFlow**: Graph/node management
- **TypeScript**: Type safety for components and edges

### Extensibility Points
1. **New Component Types**: Add to cost formulas and latency maps
2. **Custom Validation Rules**: Extend hard/soft validation functions
3. **Load Profiles**: Modify percentile calculations for different load scenarios
4. **Pricing Models**: Update cost formulas for different cloud providers

---

## References

- **P50/P95/P99**: Percentiles of latency distribution
- **Bottleneck**: Component with lowest throughput on critical path
- **SPOF**: Single Point of Failure - component with no redundancy
- **Critical Path**: Longest latency path from client to backend
- **SLA**: Service Level Agreement - uptime guarantee
