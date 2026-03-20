import {
  Globe, Smartphone, Cpu, Server, Cloud, Database, HardDrive,
  Shield, Eye, Bell, Search, Layers, Zap, Radio, Box,
  Workflow, Lock, Settings, Key, BarChart3, Activity,
  Network, Wifi, MonitorSmartphone, Router, ShieldCheck,
  Container, FunctionSquare, MessageSquare, Archive,
  Gauge, CircuitBoard, Radar, AlertTriangle, StickyNote,
  type LucideIcon
} from "lucide-react";

export type CategoryId = "client" | "network" | "compute" | "data" | "infra" | "observability";

export interface ComponentDefinition {
  id: string;
  label: string;
  category: CategoryId;
  icon: LucideIcon;
  defaultProperties: Record<string, any>;
  description: string;
}

export interface Category {
  id: CategoryId;
  label: string;
  colorClass: string;
  colorVar: string;
}

export const categories: Category[] = [
  { id: "client", label: "Client", colorClass: "text-cat-client", colorVar: "--cat-client" },
  { id: "network", label: "Network", colorClass: "text-cat-network", colorVar: "--cat-network" },
  { id: "compute", label: "Compute", colorClass: "text-cat-compute", colorVar: "--cat-compute" },
  { id: "data", label: "Data", colorClass: "text-cat-data", colorVar: "--cat-data" },
  { id: "infra", label: "Infra", colorClass: "text-cat-infra", colorVar: "--cat-infra" },
  { id: "observability", label: "Observability", colorClass: "text-cat-observability", colorVar: "--cat-observability" },
];

export const categoryColorMap: Record<CategoryId, string> = {
  client: "hsl(217, 91%, 60%)",
  network: "hsl(263, 70%, 50%)",
  compute: "hsl(160, 84%, 39%)",
  data: "hsl(38, 92%, 50%)",
  infra: "hsl(347, 77%, 50%)",
  observability: "hsl(187, 85%, 53%)",
};

export const categoryBgMap: Record<CategoryId, string> = {
  client: "hsla(217, 91%, 60%, 0.1)",
  network: "hsla(263, 70%, 50%, 0.1)",
  compute: "hsla(160, 84%, 39%, 0.1)",
  data: "hsla(38, 92%, 50%, 0.1)",
  infra: "hsla(347, 77%, 50%, 0.1)",
  observability: "hsla(187, 85%, 53%, 0.1)",
};

export const componentDefinitions: ComponentDefinition[] = [
  // CLIENT
  { id: "web-client", label: "Web Client", category: "client", icon: Globe, defaultProperties: { notes: "" }, description: "Browser-based client" },
  { id: "mobile-client", label: "Mobile Client", category: "client", icon: Smartphone, defaultProperties: { notes: "" }, description: "Mobile app client" },
  { id: "iot-device", label: "IoT Device", category: "client", icon: Wifi, defaultProperties: { notes: "" }, description: "IoT edge device" },

  // NETWORK
  { id: "load-balancer", label: "Load Balancer", category: "network", icon: Network, defaultProperties: { algorithm: "round-robin", healthCheckInterval: 30, type: "L7", notes: "" }, description: "Distributes traffic across servers" },
  { id: "api-gateway", label: "API Gateway", category: "network", icon: Router, defaultProperties: { rateLimit: 10000, authEnabled: true, notes: "" }, description: "API routing and management" },
  { id: "cdn", label: "CDN", category: "network", icon: Globe, defaultProperties: { cacheHitRatio: 90, regions: 5, notes: "" }, description: "Content delivery network" },
  { id: "dns", label: "DNS", category: "network", icon: Globe, defaultProperties: { ttl: 300, notes: "" }, description: "Domain name resolution" },
  { id: "reverse-proxy", label: "Reverse Proxy", category: "network", icon: Shield, defaultProperties: { notes: "" }, description: "Reverse proxy server" },
  { id: "firewall", label: "Firewall", category: "network", icon: ShieldCheck, defaultProperties: { notes: "" }, description: "Network firewall" },

  // COMPUTE
  { id: "web-server", label: "Web Server", category: "compute", icon: Server, defaultProperties: { instances: 2, cpuCores: 4, ramGB: 8, maxRPS: 1000, notes: "" }, description: "Serves web content" },
  { id: "app-server", label: "App Server", category: "compute", icon: Server, defaultProperties: { instances: 2, cpuCores: 4, ramGB: 8, maxRPS: 500, notes: "" }, description: "Application logic server" },
  { id: "microservice", label: "Microservice", category: "compute", icon: Container, defaultProperties: { instances: 3, cpuCores: 2, ramGB: 4, maxRPS: 2000, notes: "" }, description: "Independent service unit" },
  { id: "serverless", label: "Serverless Function", category: "compute", icon: FunctionSquare, defaultProperties: { avgExecTimeMs: 100, memoryMB: 256, concurrencyLimit: 1000, notes: "" }, description: "Event-driven function" },
  { id: "worker", label: "Worker / Job Queue", category: "compute", icon: Cpu, defaultProperties: { instances: 2, cpuCores: 2, ramGB: 4, notes: "" }, description: "Background job processor" },

  // DATA
  { id: "sql-db", label: "SQL Database", category: "data", icon: Database, defaultProperties: { dbType: "primary", readReplicas: 0, storageGB: 100, replicationMode: "async", engine: "PostgreSQL", notes: "" }, description: "Relational database" },
  { id: "nosql-db", label: "NoSQL Database", category: "data", icon: Database, defaultProperties: { dbType: "primary", storageGB: 100, rcu: 100, wcu: 50, engine: "DynamoDB", notes: "" }, description: "Document/key-value database" },
  { id: "cache", label: "Cache", category: "data", icon: Zap, defaultProperties: { evictionPolicy: "LRU", maxMemoryMB: 1024, hitRateTarget: 95, nodes: 1, notes: "" }, description: "In-memory cache (Redis)" },
  { id: "message-queue", label: "Message Queue", category: "data", icon: MessageSquare, defaultProperties: { maxThroughput: 10000, retentionHrs: 168, consumerGroups: 1, engine: "Kafka", notes: "" }, description: "Async message broker" },
  { id: "object-storage", label: "Object Storage", category: "data", icon: Archive, defaultProperties: { storageGB: 500, notes: "" }, description: "S3-compatible storage" },
  { id: "search-engine", label: "Search Engine", category: "data", icon: Search, defaultProperties: { nodes: 3, storageGB: 50, notes: "" }, description: "Full-text search (Elasticsearch)" },
  { id: "data-warehouse", label: "Data Warehouse", category: "data", icon: Layers, defaultProperties: { storageTB: 1, notes: "" }, description: "Analytical data store" },
  { id: "stream-processor", label: "Stream Processor", category: "data", icon: Activity, defaultProperties: { throughput: 50000, notes: "" }, description: "Real-time stream processing" },

  // INFRA
  { id: "rate-limiter", label: "Rate Limiter", category: "infra", icon: Gauge, defaultProperties: { maxRPS: 10000, windowType: "sliding", notes: "" }, description: "Request rate limiting" },
  { id: "circuit-breaker", label: "Circuit Breaker", category: "infra", icon: CircuitBoard, defaultProperties: { failureThreshold: 5, resetTimeoutMs: 30000, notes: "" }, description: "Failure isolation pattern" },
  { id: "service-discovery", label: "Service Discovery", category: "infra", icon: Radar, defaultProperties: { notes: "" }, description: "Service registry and discovery" },
  { id: "config-service", label: "Config Service", category: "infra", icon: Settings, defaultProperties: { notes: "" }, description: "Centralized configuration" },
  { id: "secret-manager", label: "Secret Manager", category: "infra", icon: Key, defaultProperties: { notes: "" }, description: "Secrets management" },

  // OBSERVABILITY
  { id: "log-aggregator", label: "Log Aggregator", category: "observability", icon: Eye, defaultProperties: { notes: "" }, description: "Centralized logging" },
  { id: "metrics", label: "Metrics / Monitoring", category: "observability", icon: BarChart3, defaultProperties: { notes: "" }, description: "System metrics collection" },
  { id: "tracing", label: "Distributed Tracing", category: "observability", icon: Workflow, defaultProperties: { notes: "" }, description: "Request tracing across services" },
  { id: "alerting", label: "Alerting Service", category: "observability", icon: Bell, defaultProperties: { notes: "" }, description: "Alert management" },

  // SPECIAL
  { id: "sticky-note", label: "Sticky Note", category: "client", icon: StickyNote, defaultProperties: { text: "Add note here...", notes: "" }, description: "Annotation note" },
];

export const getDefinition = (id: string) => componentDefinitions.find(c => c.id === id);
export const getComponentsByCategory = (cat: CategoryId) => componentDefinitions.filter(c => c.category === cat && c.id !== "sticky-note");
