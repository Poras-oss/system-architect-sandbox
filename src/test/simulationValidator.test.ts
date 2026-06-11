import { describe, it, expect } from 'vitest';
import { Node, Edge } from 'reactflow';
import { runValidatedSimulation } from '../utils/simulationValidator';
import { SimulationConfig } from '../store/useStore';

const defaultConfig = {
  totalRequests: 10000,
  rps: 1000,
  readWriteMix: { read: 80, write: 20 },
  multiRegion: false,
  networkTopology: 'same-az',
  preset: 'none',
  diffMode: false,
} as SimulationConfig;

function makeNode(id: string, componentId: string, properties: Record<string, any> = {}): Node {
  return {
    id,
    type: 'systemNode',
    position: { x: 0, y: 0 },
    data: { componentId, label: componentId, properties },
  };
}

function makeEdge(source: string, target: string, async = false): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    data: { edgeType: async ? 'async' : 'sync' },
  };
}

// ── Minimal valid architecture: client → app-server → sql-db
function minimalArch() {
  const nodes = [
    makeNode('client', 'web-client'),
    makeNode('app', 'app-server', { instances: 1, maxRPS: 500 }),
    makeNode('db', 'sql-db', { readReplicas: 0, storageGB: 100 }),
  ];
  const edges = [makeEdge('client', 'app'), makeEdge('app', 'db')];
  return { nodes, edges };
}

describe('Hard Validation', () => {
  it('blocks when no client node exists', () => {
    const nodes = [makeNode('app', 'app-server')];
    const result = runValidatedSimulation(nodes, [], defaultConfig);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.result).toBeNull();
  });

  it('blocks when no compute node is reachable from client', () => {
    const nodes = [makeNode('client', 'web-client')];
    const result = runValidatedSimulation(nodes, [], defaultConfig);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.result).toBeNull();
  });

  it('blocks when client is directly connected to a database', () => {
    const nodes = [
      makeNode('client', 'web-client'),
      makeNode('db', 'sql-db'),
    ];
    const edges = [makeEdge('client', 'db')];
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    // Message contains "direct connection" — matches 'direct'
    expect(result.errors.some(e => e.message.toLowerCase().includes('direct'))).toBe(true);
    expect(result.result).toBeNull();
  });

  it('blocks on circular sync dependency', () => {
    const nodes = [
      makeNode('client', 'web-client'),
      makeNode('a', 'microservice'),
      makeNode('b', 'microservice'),
    ];
    const edges = [
      makeEdge('client', 'a'),
      makeEdge('a', 'b'),
      makeEdge('b', 'a'), // cycle
    ];
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.errors.some(e => e.message.toLowerCase().includes('circular'))).toBe(true);
    expect(result.result).toBeNull();
  });

  it('blocks when load balancer has only one backend', () => {
    const nodes = [
      makeNode('client', 'web-client'),
      makeNode('lb', 'load-balancer'),
      makeNode('app', 'app-server'),
    ];
    const edges = [makeEdge('client', 'lb'), makeEdge('lb', 'app')];
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.errors.some(e =>
      e.message.toLowerCase().includes('one backend') || e.message.toLowerCase().includes('single target')
    )).toBe(true);
  });

  it('blocks when message queue has no consumers', () => {
    const nodes = [
      makeNode('client', 'web-client'),
      makeNode('app', 'app-server'),
      makeNode('mq', 'message-queue'),
    ];
    const edges = [makeEdge('client', 'app'), makeEdge('app', 'mq', true)];
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.errors.some(e =>
      e.message.toLowerCase().includes('no consumers') || e.message.toLowerCase().includes('consumer')
    )).toBe(true);
  });
});

describe('Simulation — Latency', () => {
  it('produces a positive P50 for valid architecture', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result).not.toBeNull();
    expect(result.result!.p50).toBeGreaterThan(0);
  });

  it('P95 >= P50 for all architectures', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result!.p95).toBeGreaterThanOrEqual(result.result!.p50);
  });

  it('P99 >= P95 for all architectures', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result!.p99).toBeGreaterThanOrEqual(result.result!.p95);
  });

  it('latency increases when RPS approaches capacity ceiling', () => {
    const { nodes, edges } = minimalArch();
    const lowRps = runValidatedSimulation(nodes, edges, { ...defaultConfig, rps: 100 });
    const highRps = runValidatedSimulation(nodes, edges, { ...defaultConfig, rps: 450 });
    expect(highRps.result!.p50).toBeGreaterThanOrEqual(lowRps.result!.p50);
  });

  it('more serial hops produce higher latency', () => {
    const shortArch = {
      nodes: [makeNode('client', 'web-client'), makeNode('app', 'app-server')],
      edges: [makeEdge('client', 'app')],
    };
    const longArch = {
      nodes: [
        makeNode('client', 'web-client'),
        makeNode('gw', 'api-gateway'),
        makeNode('app', 'app-server'),
        makeNode('db', 'sql-db'),
      ],
      edges: [
        makeEdge('client', 'gw'),
        makeEdge('gw', 'app'),
        makeEdge('app', 'db'),
      ],
    };
    const short = runValidatedSimulation(shortArch.nodes, shortArch.edges, defaultConfig);
    const long = runValidatedSimulation(longArch.nodes, longArch.edges, defaultConfig);
    // Long arch has errors (e.g. no compute reachable or other rule violations)?
    // Only compare if both produce results
    if (short.result && long.result) {
      expect(long.result.p50).toBeGreaterThan(short.result.p50);
    } else {
      expect(short.result).not.toBeNull();
      expect(long.result).not.toBeNull();
    }
  });

  it('black friday significantly increases P99', () => {
    const { nodes, edges } = minimalArch();
    const normal = runValidatedSimulation(nodes, edges, { ...defaultConfig, preset: 'none' });
    const spike = runValidatedSimulation(nodes, edges, { ...defaultConfig, preset: 'black-friday' });
    expect(spike.result!.p99).toBeGreaterThan(normal.result!.p99);
  });
});

describe('Simulation — Throughput', () => {
  it('capacity ceiling is positive', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result!.capacityCeiling).toBeGreaterThan(0);
  });

  it('throughputAchieved does not exceed capacity ceiling', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result!.throughputAchieved).toBeLessThanOrEqual(result.result!.capacityCeiling);
  });

  it('throughputAchieved does not exceed configured RPS', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, { ...defaultConfig, rps: 100 });
    expect(result.result!.throughputAchieved).toBeLessThanOrEqual(100);
  });

  it('scaling more instances increases capacity ceiling', () => {
    const low = [makeNode('client', 'web-client'), makeNode('app', 'app-server', { instances: 1, maxRPS: 500 })];
    const high = [makeNode('client', 'web-client'), makeNode('app', 'app-server', { instances: 4, maxRPS: 500 })];
    const edges = [makeEdge('client', 'app')];
    const r1 = runValidatedSimulation(low, edges, defaultConfig);
    const r4 = runValidatedSimulation(high, edges, defaultConfig);
    expect(r4.result!.capacityCeiling).toBeGreaterThan(r1.result!.capacityCeiling);
  });
});

describe('Simulation — Availability', () => {
  it('availability is between 0 and 100', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result!.availability).toBeGreaterThan(0);
    expect(result.result!.availability).toBeLessThanOrEqual(100);
  });

  it('adding a replica improves availability', () => {
    const single = [makeNode('client', 'web-client'), makeNode('app', 'app-server', { instances: 1 })];
    const multi = [makeNode('client', 'web-client'), makeNode('app', 'app-server', { instances: 3 })];
    const edges = [makeEdge('client', 'app')];
    const r1 = runValidatedSimulation(single, edges, defaultConfig);
    const r3 = runValidatedSimulation(multi, edges, defaultConfig);
    expect(r3.result!.availability).toBeGreaterThanOrEqual(r1.result!.availability);
  });

  it('more components in series reduces total availability', () => {
    const short = {
      nodes: [makeNode('client', 'web-client'), makeNode('app', 'app-server')],
      edges: [makeEdge('client', 'app')],
    };
    const long = {
      nodes: [
        makeNode('client', 'web-client'),
        makeNode('gw', 'api-gateway'),
        makeNode('app', 'app-server'),
        makeNode('db', 'sql-db'),
      ],
      edges: [
        makeEdge('client', 'gw'),
        makeEdge('gw', 'app'),
        makeEdge('app', 'db'),
      ],
    };
    const r1 = runValidatedSimulation(short.nodes, short.edges, defaultConfig);
    const r2 = runValidatedSimulation(long.nodes, long.edges, defaultConfig);
    expect(r1.result).not.toBeNull();
    expect(r2.result).not.toBeNull();
    expect(r2.result!.availability).toBeLessThanOrEqual(r1.result!.availability);
  });

  it('single-instance server is listed as SPOF', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result!.spofs.length).toBeGreaterThan(0);
  });

  it('multi-instance server is not listed as SPOF', () => {
    const nodes = [
      makeNode('client', 'web-client'),
      makeNode('app', 'app-server', { instances: 3 }),
    ];
    const edges = [makeEdge('client', 'app')];
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    const appInSpofs = result.result!.spofs.some(s => s.includes('app'));
    expect(appInSpofs).toBe(false);
  });
});

describe('Simulation — Blast Radius', () => {
  it('nodeBlastRadius is populated', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(Object.keys(result.result!.nodeBlastRadius).length).toBeGreaterThan(0);
  });

  it('blast radius values are non-negative', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    Object.values(result.result!.nodeBlastRadius).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
    });
  });

  it('client node has blast radius 0 (nothing depends on the client)', () => {
    const { nodes, edges } = minimalArch();
    const result = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(result.result!.nodeBlastRadius['client']).toBe(0);
  });
});

describe('Simulation — Determinism', () => {
  it('produces identical results on multiple runs', () => {
    const { nodes, edges } = minimalArch();
    const r1 = runValidatedSimulation(nodes, edges, defaultConfig);
    const r2 = runValidatedSimulation(nodes, edges, defaultConfig);
    expect(r1.result!.p50).toBe(r2.result!.p50);
    expect(r1.result!.p99).toBe(r2.result!.p99);
    expect(r1.result!.availability).toBe(r2.result!.availability);
  });
});
