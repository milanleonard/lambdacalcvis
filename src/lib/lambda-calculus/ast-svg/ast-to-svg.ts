
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';

// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 20;
const VERTICAL_SPACING = 50;
const TEXT_PADDING = 5;
const CHAR_WIDTH_ESTIMATE = 8; // Approximate width of a character
const INITIAL_PADDING = 20; // Padding around the entire drawing

interface LayoutContext {
  svgNodes: SvgAstNode[];
  svgConnectors: SvgConnector[];
  highlightedRedexId?: string;
}

function initializeLayoutContext(highlightedRedexId?: string): LayoutContext {
  return {
    svgNodes: [],
    svgConnectors: [],
    highlightedRedexId,
  };
}

interface ProcessedSubtree {
  centerX: number;
  y: number;
  width: number;
  height: number;
  svgId: string;
  rootNodeX: number; // The x-coordinate of the root SVG node of this subtree, relative to its layout block's origin.
}

// Shifts all nodes within a subtree by deltaX and deltaY.
// This function now ONLY modifies node.x and node.y. Connector paths are handled later.
function shiftSubtree(ctx: LayoutContext, rootSvgIdToShift: string, deltaX: number, deltaY: number = 0) {
  const nodesToShiftSet: Set<string> = new Set();
  const q: string[] = [rootSvgIdToShift];
  const visitedForShift: Set<string> = new Set();

  while (q.length > 0) {
    const currentId = q.shift()!;
    if (visitedForShift.has(currentId)) continue;
    visitedForShift.add(currentId);
    nodesToShiftSet.add(currentId);

    ctx.svgConnectors.forEach(c => {
      if (c.fromSvgId === currentId && !visitedForShift.has(c.toSvgId)) {
        q.push(c.toSvgId);
      }
    });
  }

  ctx.svgNodes.forEach(node => {
    if (nodesToShiftSet.has(node.svgId)) {
      node.x += deltaX;
      node.y += deltaY;
    }
  });
}


function layoutNodeRecursive(
  astNode: ASTNode,
  ctx: LayoutContext,
  targetY: number
): ProcessedSubtree {
  const svgId = generateSvgNodeId(astNode.type);
  const isHighlighted = astNode.id === ctx.highlightedRedexId || astNode.isRedex;
  let nodeOwnWidth: number;
  const nodeOwnHeight = NODE_HEIGHT;

  let currentProcessedSubtree: ProcessedSubtree;

  if (astNode.type === 'variable') {
    const varNode = astNode as Variable;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, varNode.name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'variable', name: varNode.name,
      x: 0, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    currentProcessedSubtree = {
      centerX: nodeOwnWidth / 2,
      y: targetY,
      width: nodeOwnWidth,
      height: nodeOwnHeight,
      svgId: svgId,
      rootNodeX: 0,
    };
  } else if (astNode.type === 'lambda') {
    const lambdaNode = astNode as Lambda;
    const textContent = `λ${lambdaNode.param}.`;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, textContent.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    
    const overallWidth = Math.max(nodeOwnWidth, bodyLayout.width);
    const lambdaSymbolX = (overallWidth / 2) - (nodeOwnWidth / 2);
    const bodyRelativeX = (overallWidth / 2) - (bodyLayout.centerX);
    
    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    const bodyNodeInCtx = ctx.svgNodes.find(n => n.svgId === bodyLayout.svgId)!;
    shiftSubtree(ctx, bodyLayout.svgId, bodyRelativeX - bodyNodeInCtx.x);

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId,
      toSvgId: bodyLayout.svgId,
      pathD: '', // Will be calculated later
      isHighlighted: isHighlighted && (astNode.body.isRedex || astNode.body.id === ctx.highlightedRedexId),
    });

    currentProcessedSubtree = {
      centerX: lambdaSymbolX + nodeOwnWidth / 2,
      y: targetY,
      width: overallWidth,
      height: nodeOwnHeight + VERTICAL_SPACING + bodyLayout.height,
      svgId: svgId,
      rootNodeX: lambdaSymbolX,
    };
  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    const funcLayout = layoutNodeRecursive(appNode.func, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);

    const funcNodeInCtx = ctx.svgNodes.find(n => n.svgId === funcLayout.svgId)!;
    const argNodeInCtx = ctx.svgNodes.find(n => n.svgId === argLayout.svgId)!;
    
    const funcRelativeX = 0;
    const argRelativeX = funcLayout.width + HORIZONTAL_SPACING;
    const childrenSpanWidth = funcLayout.width + HORIZONTAL_SPACING + argLayout.width;
    const appSymbolX = (childrenSpanWidth / 2) - (nodeOwnWidth / 2);

    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'application',
      x: appSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    shiftSubtree(ctx, funcLayout.svgId, funcRelativeX - funcNodeInCtx.x);
    shiftSubtree(ctx, argLayout.svgId, argRelativeX - argNodeInCtx.x);

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-func'),
      fromSvgId: svgId,
      toSvgId: funcLayout.svgId,
      pathD: '', // Will be calculated later
      isHighlighted: isHighlighted && (astNode.func.isRedex || astNode.func.id === ctx.highlightedRedexId),
    });
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-arg'),
      fromSvgId: svgId,
      toSvgId: argLayout.svgId,
      pathD: '', // Will be calculated later
      isHighlighted: isHighlighted && (astNode.arg.isRedex || astNode.arg.id === ctx.highlightedRedexId),
    });

    currentProcessedSubtree = {
      centerX: appSymbolX + nodeOwnWidth / 2,
      y: targetY,
      width: childrenSpanWidth,
      height: nodeOwnHeight + VERTICAL_SPACING + Math.max(funcLayout.height, argLayout.height),
      svgId: svgId,
      rootNodeX: appSymbolX,
    };
  }
  return currentProcessedSubtree;
}


export function generateAstSvgData(
  astNode: ASTNode | null,
  highlightedRedexId?: string
): AstSvgRenderData {
  if (!astNode) {
    return { nodes: [], connectors: [], canvasWidth: 0, canvasHeight: 0, error: "No AST node provided." };
  }

  const ctx = initializeLayoutContext(highlightedRedexId);

  try {
    layoutNodeRecursive(astNode, ctx, 0);

    // After all recursive layout and shifting, calculate final pathD for connectors
    // using the current node positions (which are relative to the tree's (0,0) origin).
    ctx.svgConnectors.forEach(connector => {
      const fromNode = ctx.svgNodes.find(n => n.svgId === connector.fromSvgId);
      const toNode = ctx.svgNodes.find(n => n.svgId === connector.toSvgId);

      if (fromNode && toNode) {
          const startX = fromNode.x + fromNode.width / 2;
          const startY = fromNode.y + fromNode.height;
          const endX = toNode.x + toNode.width / 2;
          const endY = toNode.y;
          connector.pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
      } else {
          console.warn("generateAstSvgData: Could not find nodes for connector:", connector.id, connector.fromSvgId, connector.toSvgId);
          connector.pathD = "M 0 0 L 0 0"; 
      }
    });

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    if (ctx.svgNodes.length === 0) {
      return { nodes: [], connectors: [], canvasWidth: INITIAL_PADDING * 2, canvasHeight: INITIAL_PADDING * 2, error: "No SVG nodes generated." };
    }

    ctx.svgNodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x + node.width);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y + node.height);
    });
    
    // Include connector points in min/max calculation in case they extend beyond nodes
    // This is less likely now that paths are drawn between node centers/edges
    // but good for robustness if path logic changes later.
    ctx.svgConnectors.forEach(connector => {
        const parts = connector.pathD.match(/M\s*([-\d.eE]+)\s*([-\d.eE]+)\s*L\s*([-\d.eE]+)\s*([-\d.eE]+)/);
        if (parts && parts.length === 5) {
            const x1 = parseFloat(parts[1]);
            const y_1 = parseFloat(parts[2]);
            const x2 = parseFloat(parts[3]);
            const y2 = parseFloat(parts[4]);
            minX = Math.min(minX, x1, x2);
            maxX = Math.max(maxX, x1, x2);
            minY = Math.min(minY, y_1, y2);
            maxY = Math.max(maxY, y_1, y2);
        }
    });


    const shiftX = (minX === Infinity || minX === maxX) ? INITIAL_PADDING : -minX + INITIAL_PADDING;
    const shiftY = (minY === Infinity || minY === maxY) ? INITIAL_PADDING : -minY + INITIAL_PADDING;


    ctx.svgNodes.forEach(node => {
      node.x += shiftX;
      node.y += shiftY;
    });

    ctx.svgConnectors.forEach(connector => {
      const parts = connector.pathD.match(/M\s*([-\d.eE]+)\s*([-\d.eE]+)\s*L\s*([-\d.eE]+)\s*([-\d.eE]+)/);
      if (parts && parts.length === 5) {
        const x1 = parseFloat(parts[1]) + shiftX;
        const y1 = parseFloat(parts[2]) + shiftY;
        const x2 = parseFloat(parts[3]) + shiftX;
        const y2 = parseFloat(parts[4]) + shiftY;
        connector.pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
      }
    });
    
    const finalCanvasWidth = (maxX === -Infinity || minX === maxX) ? (ctx.svgNodes[0]?.width || 0) + 2 * INITIAL_PADDING : (maxX - minX) + 2 * INITIAL_PADDING;
    const finalCanvasHeight = (maxY === -Infinity || minY === maxY) ? (ctx.svgNodes[0]?.height || 0) + 2 * INITIAL_PADDING : (maxY - minY) + 2 * INITIAL_PADDING;


    return {
      nodes: ctx.svgNodes,
      connectors: ctx.svgConnectors,
      canvasWidth: Math.max(200, finalCanvasWidth),
      canvasHeight: Math.max(100, finalCanvasHeight),
    };
  } catch (error: any) {
    console.error("Error during AST SVG layout:", error);
    return {
      nodes: [],
      connectors: [],
      canvasWidth: 300,
      canvasHeight: 100,
      error: `Layout Error: ${error.message || "Unknown error"}`,
    };
  }
}

