import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export const getAutoLayout = (nodes: Node[], edges: Edge[], direction = 'LR'): Node[] => {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    // We assume default node width and height
    dagreGraph.setNode(node.id, { width: 250, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 250 / 2,
        y: nodeWithPosition.y - 100 / 2,
      },
    };
  });
};
