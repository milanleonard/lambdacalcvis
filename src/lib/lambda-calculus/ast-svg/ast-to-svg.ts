
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';

// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 20; // Reduced spacing
const VERTICAL_SPACING = 50;   // Reduced spacing
const TEXT_PADDING = 5;
const CHAR_WIDTH_ESTIMATE = 8;
const INITIAL_PADDING = 20;

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
  // The x-coordinate of the top-center of this node's root SVG element, relative to its layout block's origin.
  centerX: number;
  // The y-coordinate of the top of this node's root SVG element (always targetY).
  y: number;
  // Total width of the bounding box for this subtree.
  width: number;
  // Total height of the bounding box for this subtree.
  height: number;
  // The SVG ID of the root node of this subtree.
  svgId: string;
  // The actual x-coordinate of the root node of this subtree, relative to its layout block's origin.
  // This is needed because centerX is for the symbol, but the block might start at a different x.
  rootNodeX: number; 
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
      x: 0, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight, // x is relative to this block
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
    nodeOwnWidth = Math.max(NODE_WIDTH, (`λ${lambdaNode.param}.`).length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    const bodyNodeInCtx = ctx.svgNodes.find(n => n.svgId === bodyLayout.svgId)!;

    // Center the lambda symbol over the body, or vice-versa, depending on widths.
    const overallWidth = Math.max(nodeOwnWidth, bodyLayout.width);
    const lambdaSymbolX = (overallWidth / 2) - (nodeOwnWidth / 2);
    const bodyRelativeX = (overallWidth / 2) - (bodyLayout.width / 2);

    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight, // x is relative
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);
    
    // Shift the body subtree to its correct position relative to this lambda block's origin
    shiftSubtree(ctx, bodyLayout.svgId, bodyRelativeX - bodyNodeInCtx.x);

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId,
      toSvgId: bodyLayout.svgId,
      // Path uses relative centers within this block before global normalization
      pathD: `M ${lambdaSymbolX + nodeOwnWidth / 2} ${targetY + nodeOwnHeight} L ${bodyRelativeX + bodyLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && astNode.body.isRedex,
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
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING); // For '@'

    const funcLayout = layoutNodeRecursive(appNode.func, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);

    const funcNodeInCtx = ctx.svgNodes.find(n => n.svgId === funcLayout.svgId)!;
    const argNodeInCtx = ctx.svgNodes.find(n => n.svgId === argLayout.svgId)!;

    // Position children relative to this application block's origin (x=0)
    const funcRelativeX = 0;
    const argRelativeX = funcLayout.width + HORIZONTAL_SPACING;
    const childrenSpanWidth = funcLayout.width + HORIZONTAL_SPACING + argLayout.width;

    // Center the application symbol '@' over the children's span
    const appSymbolX = (childrenSpanWidth / 2) - (nodeOwnWidth / 2);

    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'application',
      x: appSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight, // x is relative
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    // Shift children subtrees
    shiftSubtree(ctx, funcLayout.svgId, funcRelativeX - funcNodeInCtx.x);
    shiftSubtree(ctx, argLayout.svgId, argRelativeX - argNodeInCtx.x);

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-func'),
      fromSvgId: svgId,
      toSvgId: funcLayout.svgId,
      pathD: `M ${appSymbolX + nodeOwnWidth / 2} ${targetY + nodeOwnHeight} L ${funcRelativeX + funcLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && astNode.func.isRedex,
    });
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-arg'),
      fromSvgId: svgId,
      toSvgId: argLayout.svgId,
      pathD: `M ${appSymbolX + nodeOwnWidth / 2} ${targetY + nodeOwnHeight} L ${argRelativeX + argLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && astNode.arg.isRedex,
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

function shiftSubtree(ctx: LayoutContext, rootSvgIdToShift: string, deltaX: number) {
  const nodesToShiftSet: Set<string> = new Set();
  const q: string[] = [rootSvgIdToShift];
  const visitedForShift: Set<string> = new Set();

  // BFS to find all nodes in the subtree
  while(q.length > 0) {
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

  // Shift nodes
  ctx.svgNodes.forEach(node => {
    if (nodesToShiftSet.has(node.svgId)) {
      node.x += deltaX;
    }
  });

  // Shift connector paths related to these nodes
  ctx.svgConnectors.forEach(connector => {
    const fromNodeInSubtree = nodesToShiftSet.has(connector.fromSvgId);
    const toNodeInSubtree = nodesToShiftSet.has(connector.toSvgId);

    if (fromNodeInSubtree || toNodeInSubtree) {
      // Path: "M x1 y1 L x2 y2"
      const parts = connector.pathD.match(/M\s*([-\d.eE]+)\s*([-\d.eE]+)\s*L\s*([-\d.eE]+)\s*([-\d.eE]+)/);
      if (parts && parts.length === 5) {
        let x1 = parseFloat(parts[1]);
        let y1 = parseFloat(parts[2]);
        let x2 = parseFloat(parts[3]);
        let y2 = parseFloat(parts[4]);

        if (fromNodeInSubtree) x1 += deltaX;
        if (toNodeInSubtree) x2 += deltaX;
        
        connector.pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
      }
    }
  });
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
    // Perform layout. Nodes and connectors are added to ctx.
    // All x coordinates within ctx.svgNodes and ctx.svgConnectors are relative to their block's origin.
    layoutNodeRecursive(astNode, ctx, 0); // Start root at y=0 (relative)

    // Calculate actual min/max bounds from the placed nodes
    let currentMinX = Infinity;
    let currentMaxX = -Infinity;
    let currentMinY = Infinity; // Should be 0 from root if layoutNodeRecursive(..., 0)
    let currentMaxY = -Infinity;

    if (ctx.svgNodes.length === 0) {
        return { nodes: [], connectors: [], canvasWidth: INITIAL_PADDING * 2, canvasHeight: INITIAL_PADDING * 2, error: "No SVG nodes generated." };
    }

    ctx.svgNodes.forEach(node => {
      currentMinX = Math.min(currentMinX, node.x);
      currentMaxX = Math.max(currentMaxX, node.x + node.width);
      currentMinY = Math.min(currentMinY, node.y);
      currentMaxY = Math.max(currentMaxY, node.y + node.height);
    });
    
    // Normalize all coordinates: shift so minX becomes INITIAL_PADDING, minY becomes INITIAL_PADDING
    const offsetX = (currentMinX === Infinity) ? 0 : -currentMinX + INITIAL_PADDING;
    const offsetY = (currentMinY === Infinity) ? 0 : -currentMinY + INITIAL_PADDING;

    ctx.svgNodes.forEach(node => {
      node.x += offsetX;
      node.y += offsetY;
    });

    ctx.svgConnectors.forEach(connector => {
      const parts = connector.pathD.match(/M\s*([-\d.eE]+)\s*([-\d.eE]+)\s*L\s*([-\d.eE]+)\s*([-\d.eE]+)/);
      if (parts && parts.length === 5) {
        const x1 = parseFloat(parts[1]) + offsetX;
        const y1 = parseFloat(parts[2]) + offsetY;
        const x2 = parseFloat(parts[3]) + offsetX;
        const y2 = parseFloat(parts[4]) + offsetY;
        connector.pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
      }
    });
    
    const canvasWidth = (currentMaxX === -Infinity) ? INITIAL_PADDING * 2 : currentMaxX - currentMinX + 2 * INITIAL_PADDING;
    const canvasHeight = (currentMaxY === -Infinity) ? INITIAL_PADDING * 2 : currentMaxY - currentMinY + 2 * INITIAL_PADDING;

    return {
      nodes: ctx.svgNodes,
      connectors: ctx.svgConnectors,
      canvasWidth: Math.max(200, canvasWidth), 
      canvasHeight: Math.max(100, canvasHeight),
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

    