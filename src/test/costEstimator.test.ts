import { describe, it, expect } from 'vitest';
import { Node } from 'reactflow';
import { calculateCosts } from '../utils/costEstimator';

function makeNode(id: string, componentId: string, properties: Record<string, any> = {}): Node {
  return {
    id,
    type: 'systemNode',
    position: { x: 0, y: 0 },
    data: { componentId, label: componentId, properties },
  };
}

describe('calculateCosts', () => {
  it('returns zero total for empty nodes', () => {
    const result = calculateCosts([]);
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('app-server cost scales linearly with instances', () => {
    const one = calculateCosts([makeNode('a', 'app-server', { instances: 1 })]);
    const two = calculateCosts([makeNode('a', 'app-server', { instances: 2 })]);
    // Base app-server: $0.10/hr × 730hrs = $73/instance. Excluding data-transfer (only compute node)
    const oneBase = one.items.find(i => i.nodeId === 'a')!.monthlyCost;
    const twoBase = two.items.find(i => i.nodeId === 'a')!.monthlyCost;
    expect(twoBase).toBeCloseTo(oneBase * 2, 0);
  });

  it('sql-db cost includes storage and compute components', () => {
    const result = calculateCosts([makeNode('db', 'sql-db', { storageGB: 100, readReplicas: 0 })]);
    const dbItem = result.items.find(i => i.nodeId === 'db')!;
    // 100GB × $0.115 + $0.10/hr × 1 node × 730 hrs = $11.50 + $73 = $84.50
    expect(dbItem.monthlyCost).toBeCloseTo(84.5, 0);
  });

  it('sql-db cost increases with read replicas', () => {
    const noReplica = calculateCosts([makeNode('db', 'sql-db', { storageGB: 100, readReplicas: 0 })]);
    const withReplica = calculateCosts([makeNode('db', 'sql-db', { storageGB: 100, readReplicas: 1 })]);
    const noRepItem = noReplica.items.find(i => i.nodeId === 'db')!;
    const withRepItem = withReplica.items.find(i => i.nodeId === 'db')!;
    expect(withRepItem.monthlyCost).toBeGreaterThan(noRepItem.monthlyCost);
  });

  it('object-storage cost matches $0.023/GB', () => {
    const result = calculateCosts([makeNode('s3', 'object-storage', { storageGB: 500 })]);
    const item = result.items.find(i => i.nodeId === 's3')!;
    expect(item.monthlyCost).toBeCloseTo(500 * 0.023, 1);
  });

  it('total equals sum of all item costs', () => {
    const nodes = [
      makeNode('app', 'app-server', { instances: 2 }),
      makeNode('db', 'sql-db', { storageGB: 100 }),
      makeNode('cache', 'cache', { nodes: 1 }),
    ];
    const result = calculateCosts(nodes);
    const sumOfItems = result.items.reduce((s, i) => s + i.monthlyCost, 0);
    expect(result.total).toBeCloseTo(sumOfItems, 2);
  });

  it('load-balancer produces a non-zero cost', () => {
    const result = calculateCosts([makeNode('lb', 'load-balancer')]);
    expect(result.total).toBeGreaterThan(0);
  });

  it('unknown component types (clients) are excluded from cost', () => {
    const result = calculateCosts([makeNode('client', 'web-client')]);
    expect(result.total).toBe(0);
  });

  it('cache cost scales with node count', () => {
    const one = calculateCosts([makeNode('c', 'cache', { nodes: 1 })]);
    const three = calculateCosts([makeNode('c', 'cache', { nodes: 3 })]);
    const oneItem = one.items.find(i => i.nodeId === 'c')!;
    const threeItem = three.items.find(i => i.nodeId === 'c')!;
    expect(threeItem.monthlyCost).toBeCloseTo(oneItem.monthlyCost * 3, 0);
  });

  it('message-queue cost uses 30% avg utilization (not 100% max)', () => {
    // At 10000 msg/s × 100%: 26.28B msgs × $0.40/M = $10,512/mo (wrong)
    // At 10000 msg/s × 30%: 7.884B msgs × $0.40/M = $3,153/mo (correct)
    const result = calculateCosts([makeNode('mq', 'message-queue', { maxThroughput: 10000 })]);
    const item = result.items.find(i => i.nodeId === 'mq')!;
    expect(item.monthlyCost).toBeLessThan(5000);  // Should be ~$3,153, not $10,512
    expect(item.monthlyCost).toBeGreaterThan(1000); // Should be a substantial but realistic amount
  });

  it('data transfer cost is added for serving nodes', () => {
    const result = calculateCosts([makeNode('app', 'app-server', { instances: 1 })]);
    const transferItem = result.items.find(i => i.nodeId === '__data-transfer__');
    expect(transferItem).toBeDefined();
    expect(transferItem!.monthlyCost).toBeGreaterThan(0);
  });
});
