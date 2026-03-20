import { Node, Edge, MarkerType } from "reactflow";

interface Template {
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
}

let uid = 0;
const nid = (prefix: string) => `${prefix}-tpl-${uid++}`;

const edgeStyle = { stroke: "hsl(218, 11%, 37%)", strokeWidth: 2 };
const marker = { type: MarkerType.ArrowClosed as const, color: "hsl(218, 11%, 37%)" };
const makeEdge = (source: string, target: string, async = false): Edge => ({
  id: `e-${source}-${target}`,
  source,
  target,
  style: { ...edgeStyle, strokeDasharray: async ? "5 5" : undefined },
  animated: async,
  markerEnd: marker,
  data: { edgeType: async ? "async" : "sync" },
});

const makeNode = (id: string, componentId: string, label: string, x: number, y: number, properties: Record<string, any> = {}): Node => ({
  id,
  type: "systemNode",
  position: { x, y },
  data: { componentId, label, properties: { ...properties } },
});

function urlShortener(): Template {
  uid = 0;
  const client = nid("wc");
  const lb = nid("lb");
  const api = nid("api");
  const cache = nid("cache");
  const db = nid("db");
  const s3 = nid("s3");

  return {
    name: "URL Shortener",
    description: "Bitly-style URL shortening service with caching",
    nodes: [
      makeNode(client, "web-client", "Web Client", 0, 0),
      makeNode(lb, "load-balancer", "Load Balancer", 0, 150, { algorithm: "round-robin", type: "L7" }),
      makeNode(api, "app-server", "API Server", 0, 300, { instances: 2, maxRPS: 5000 }),
      makeNode(cache, "cache", "Redis Cache", 250, 300, { maxMemoryMB: 2048, hitRateTarget: 95 }),
      makeNode(db, "sql-db", "PostgreSQL", 0, 480, { readReplicas: 1, storageGB: 50 }),
      makeNode(s3, "object-storage", "Analytics Store", 250, 480, { storageGB: 100 }),
    ],
    edges: [
      makeEdge(client, lb),
      makeEdge(lb, api),
      makeEdge(api, cache),
      makeEdge(api, db),
      makeEdge(api, s3, true),
    ],
  };
}

function twitterFeed(): Template {
  uid = 100;
  const wc = nid("wc"); const mc = nid("mc");
  const cdn = nid("cdn"); const lb = nid("lb"); const gw = nid("gw");
  const feed = nid("feed"); const user = nid("user"); const fanout = nid("fanout");
  const cache = nid("cache"); const db = nid("db"); const mq = nid("mq");
  const search = nid("search");

  return {
    name: "Twitter/X Feed",
    description: "Read-heavy social feed with fanout and caching",
    nodes: [
      makeNode(wc, "web-client", "Web Client", 0, 0),
      makeNode(mc, "mobile-client", "Mobile Client", 250, 0),
      makeNode(cdn, "cdn", "CDN", 125, 120, { cacheHitRatio: 85, regions: 8 }),
      makeNode(lb, "load-balancer", "Load Balancer", 125, 240, { algorithm: "least-connections", type: "L7" }),
      makeNode(gw, "api-gateway", "API Gateway", 125, 360, { rateLimit: 50000 }),
      makeNode(feed, "microservice", "Feed Service", 0, 500, { instances: 5, maxRPS: 10000 }),
      makeNode(user, "microservice", "User Service", 250, 500, { instances: 3, maxRPS: 5000 }),
      makeNode(fanout, "worker", "Fanout Worker", -200, 640, { instances: 4 }),
      makeNode(cache, "cache", "Redis Cluster", 125, 640, { maxMemoryMB: 8192, hitRateTarget: 98, nodes: 3 }),
      makeNode(mq, "message-queue", "Kafka", -200, 500, { maxThroughput: 100000, engine: "Kafka" }),
      makeNode(db, "sql-db", "PostgreSQL", 125, 780, { readReplicas: 3, storageGB: 500 }),
      makeNode(search, "search-engine", "Elasticsearch", 350, 640, { nodes: 3 }),
    ],
    edges: [
      makeEdge(wc, cdn), makeEdge(mc, cdn), makeEdge(cdn, lb), makeEdge(lb, gw),
      makeEdge(gw, feed), makeEdge(gw, user), makeEdge(feed, cache), makeEdge(feed, db),
      makeEdge(feed, mq, true), makeEdge(mq, fanout, true), makeEdge(fanout, cache),
      makeEdge(user, db), makeEdge(user, search),
    ],
  };
}

function ridesharing(): Template {
  uid = 200;
  const mc = nid("mc");
  const gw = nid("gw"); const lb = nid("lb");
  const matching = nid("match"); const geo = nid("geo"); const pricing = nid("price"); const trip = nid("trip");
  const cache = nid("cache"); const db = nid("db"); const mq = nid("mq"); const stream = nid("stream");

  return {
    name: "Ride-sharing App",
    description: "Uber-style real-time geolocation with matching",
    nodes: [
      makeNode(mc, "mobile-client", "Mobile App", 125, 0),
      makeNode(gw, "api-gateway", "API Gateway", 125, 130, { rateLimit: 100000 }),
      makeNode(lb, "load-balancer", "Load Balancer", 125, 260),
      makeNode(matching, "microservice", "Matching Service", -50, 400, { instances: 5, maxRPS: 10000 }),
      makeNode(geo, "microservice", "Geolocation Service", 125, 400, { instances: 4, maxRPS: 50000 }),
      makeNode(pricing, "microservice", "Pricing Service", 300, 400, { instances: 3, maxRPS: 5000 }),
      makeNode(trip, "microservice", "Trip Service", 475, 400, { instances: 3, maxRPS: 3000 }),
      makeNode(cache, "cache", "Redis (Geo)", 125, 560, { maxMemoryMB: 4096, nodes: 2 }),
      makeNode(mq, "message-queue", "Kafka", -50, 560, { maxThroughput: 50000 }),
      makeNode(stream, "stream-processor", "Flink", -50, 700, { throughput: 50000 }),
      makeNode(db, "sql-db", "PostgreSQL", 300, 560, { readReplicas: 2, storageGB: 200 }),
    ],
    edges: [
      makeEdge(mc, gw), makeEdge(gw, lb),
      makeEdge(lb, matching), makeEdge(lb, geo), makeEdge(lb, pricing), makeEdge(lb, trip),
      makeEdge(geo, cache), makeEdge(matching, mq, true), makeEdge(mq, stream, true),
      makeEdge(matching, db), makeEdge(pricing, db), makeEdge(trip, db),
    ],
  };
}

function videoStreaming(): Template {
  uid = 300;
  const wc = nid("wc"); const mc = nid("mc");
  const cdn = nid("cdn"); const lb = nid("lb"); const gw = nid("gw");
  const video = nid("vid"); const transcode = nid("trans"); const rec = nid("rec");
  const s3 = nid("s3"); const db = nid("db"); const cache = nid("cache"); const mq = nid("mq");

  return {
    name: "Video Streaming",
    description: "YouTube-style CDN-heavy video delivery platform",
    nodes: [
      makeNode(wc, "web-client", "Web Client", 0, 0),
      makeNode(mc, "mobile-client", "Mobile Client", 250, 0),
      makeNode(cdn, "cdn", "Global CDN", 125, 130, { cacheHitRatio: 95, regions: 12 }),
      makeNode(lb, "load-balancer", "Load Balancer", 125, 260),
      makeNode(gw, "api-gateway", "API Gateway", 125, 380),
      makeNode(video, "microservice", "Video Service", 0, 520, { instances: 4, maxRPS: 8000 }),
      makeNode(rec, "microservice", "Recommendation", 250, 520, { instances: 3, maxRPS: 5000 }),
      makeNode(transcode, "worker", "Transcode Worker", -200, 520, { instances: 6 }),
      makeNode(mq, "message-queue", "SQS", -200, 380, { maxThroughput: 20000 }),
      makeNode(s3, "object-storage", "S3 Video Store", 0, 680, { storageGB: 50000 }),
      makeNode(cache, "cache", "Redis", 250, 680, { maxMemoryMB: 4096, hitRateTarget: 90, nodes: 2 }),
      makeNode(db, "sql-db", "PostgreSQL", 125, 680, { readReplicas: 2, storageGB: 300 }),
    ],
    edges: [
      makeEdge(wc, cdn), makeEdge(mc, cdn), makeEdge(cdn, lb), makeEdge(lb, gw),
      makeEdge(gw, video), makeEdge(gw, rec),
      makeEdge(video, s3), makeEdge(video, db), makeEdge(video, mq, true),
      makeEdge(mq, transcode, true), makeEdge(transcode, s3),
      makeEdge(rec, cache), makeEdge(rec, db),
    ],
  };
}

function ecommerceCheckout(): Template {
  uid = 400;
  const wc = nid("wc");
  const lb = nid("lb"); const gw = nid("gw");
  const cart = nid("cart"); const order = nid("order"); const payment = nid("pay"); const inventory = nid("inv");
  const db = nid("db"); const cache = nid("cache"); const mq = nid("mq"); const worker = nid("worker");

  return {
    name: "E-commerce Checkout",
    description: "High-consistency checkout flow with payment processing",
    nodes: [
      makeNode(wc, "web-client", "Web Client", 125, 0),
      makeNode(lb, "load-balancer", "Load Balancer", 125, 130),
      makeNode(gw, "api-gateway", "API Gateway", 125, 260, { rateLimit: 20000 }),
      makeNode(cart, "microservice", "Cart Service", -50, 400, { instances: 3, maxRPS: 5000 }),
      makeNode(order, "microservice", "Order Service", 125, 400, { instances: 3, maxRPS: 2000 }),
      makeNode(payment, "microservice", "Payment Service", 300, 400, { instances: 2, maxRPS: 1000 }),
      makeNode(inventory, "microservice", "Inventory Service", 475, 400, { instances: 2, maxRPS: 3000 }),
      makeNode(cache, "cache", "Redis (Sessions)", -50, 560, { maxMemoryMB: 2048, hitRateTarget: 95 }),
      makeNode(db, "sql-db", "PostgreSQL", 200, 560, { readReplicas: 1, storageGB: 200, replicationMode: "sync" }),
      makeNode(mq, "message-queue", "RabbitMQ", 400, 560, { maxThroughput: 5000 }),
      makeNode(worker, "worker", "Notification Worker", 400, 700, { instances: 2 }),
    ],
    edges: [
      makeEdge(wc, lb), makeEdge(lb, gw),
      makeEdge(gw, cart), makeEdge(gw, order), makeEdge(gw, payment), makeEdge(gw, inventory),
      makeEdge(cart, cache), makeEdge(order, db), makeEdge(payment, db),
      makeEdge(inventory, db), makeEdge(order, mq, true), makeEdge(mq, worker, true),
    ],
  };
}

function chatApp(): Template {
  uid = 500;
  const wc = nid("wc"); const mc = nid("mc");
  const lb = nid("lb"); const ws = nid("ws"); const chat = nid("chat"); const presence = nid("pres");
  const mq = nid("mq"); const cache = nid("cache"); const db = nid("db"); const s3 = nid("s3");

  return {
    name: "Chat Application",
    description: "WebSocket-based real-time chat with Kafka backbone",
    nodes: [
      makeNode(wc, "web-client", "Web Client", 0, 0),
      makeNode(mc, "mobile-client", "Mobile Client", 250, 0),
      makeNode(lb, "load-balancer", "Load Balancer", 125, 130, { algorithm: "ip-hash" }),
      makeNode(ws, "web-server", "WebSocket Server", 125, 260, { instances: 4, maxRPS: 20000 }),
      makeNode(chat, "microservice", "Chat Service", 0, 400, { instances: 3, maxRPS: 10000 }),
      makeNode(presence, "microservice", "Presence Service", 250, 400, { instances: 2, maxRPS: 15000 }),
      makeNode(mq, "message-queue", "Kafka", 125, 540, { maxThroughput: 100000, engine: "Kafka" }),
      makeNode(cache, "cache", "Redis (Presence)", 300, 540, { maxMemoryMB: 2048, nodes: 2 }),
      makeNode(db, "nosql-db", "MongoDB", 0, 680, { storageGB: 200, rcu: 500, wcu: 300 }),
      makeNode(s3, "object-storage", "Media Storage", 250, 680, { storageGB: 1000 }),
    ],
    edges: [
      makeEdge(wc, lb), makeEdge(mc, lb), makeEdge(lb, ws),
      makeEdge(ws, chat), makeEdge(ws, presence),
      makeEdge(chat, mq, true), makeEdge(chat, db),
      makeEdge(presence, cache), makeEdge(chat, s3, true),
    ],
  };
}

export const templates: Template[] = [
  urlShortener(),
  twitterFeed(),
  ridesharing(),
  videoStreaming(),
  ecommerceCheckout(),
  chatApp(),
  {
    name: "Blank Canvas",
    description: "Start from scratch",
    nodes: [],
    edges: [],
  },
];
