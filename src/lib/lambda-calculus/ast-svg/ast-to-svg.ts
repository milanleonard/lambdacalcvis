
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

// Represents the result of laying out a subtree.
// All coordinates are relative to the *subtree's own origin* (typically its root node at x=0 for its block).
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
  rootNodeX: number;
}

// Recursively lays out a node and its children.
// targetY is the y-coordinate for the current node's top edge.
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
      x: 0, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight, // x is relative to this block's origin (0)
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    currentProcessedSubtree = {
      centerX: nodeOwnWidth / 2, // Center of the variable node itself
      y: targetY,
      width: nodeOwnWidth,
      height: nodeOwnHeight,
      svgId: svgId,
      rootNodeX: 0, // Variable node is at the origin of its block
    };
  } else if (astNode.type === 'lambda') {
    const lambdaNode = astNode as Lambda;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, (`λ${lambdaNode.param}.`).length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout the body, it will be placed below this lambda node
    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    const bodyNodeInCtx = ctx.svgNodes.find(n => n.svgId === bodyLayout.svgId)!; // Should exist

    // Determine the overall width required for this lambda and its body
    const overallWidth = Math.max(nodeOwnWidth, bodyLayout.width);

    // Calculate X position for the lambda symbol to center it above the body (or vice-versa)
    const lambdaSymbolX = (overallWidth / 2) - (nodeOwnWidth / 2);
    // Calculate X position for the body subtree, relative to this lambda block's origin (0)
    // This ensures the bodyLayout is centered under the overallWidth.
    const bodyRelativeX = (overallWidth / 2) - (bodyLayout.centerX); // Center bodyLayout's centerX under overallWidth/2

    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    // Shift the entire body subtree from its initial relative-to-itself layout
    // to its final position relative to this lambda block's origin.
    // bodyNodeInCtx.x is its original position (likely 0 if it's a simple var, or its rootNodeX from its own block)
    shiftSubtree(ctx, bodyLayout.svgId, bodyRelativeX - bodyNodeInCtx.x);

    // Connector from lambda symbol's center to body's (now shifted) center
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId,
      toSvgId: bodyLayout.svgId,
      pathD: `M ${lambdaSymbolX + nodeOwnWidth / 2} ${targetY + nodeOwnHeight} L ${bodyRelativeX + bodyLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && (astNode.body.isRedex || astNode.body.id === ctx.highlightedRedexId),
    });

    currentProcessedSubtree = {
      centerX: lambdaSymbolX + nodeOwnWidth / 2, // Center of the lambda symbol itself
      y: targetY,
      width: overallWidth,
      height: nodeOwnHeight + VERTICAL_SPACING + bodyLayout.height,
      svgId: svgId,
      rootNodeX: lambdaSymbolX,
    };
  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout children
    const funcLayout = layoutNodeRecursive(appNode.func, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);

    const funcNodeInCtx = ctx.svgNodes.find(n => n.svgId === funcLayout.svgId)!;
    const argNodeInCtx = ctx.svgNodes.find(n => n.svgId === argLayout.svgId)!;

    // Position children relative to this application block's origin (x=0)
    // Func subtree starts at x=0 for this block
    const funcRelativeX = 0;
    // Arg subtree starts to the right of func subtree, plus spacing
    const argRelativeX = funcLayout.width + HORIZONTAL_SPACING;

    // Calculate the total width spanned by the children and spacing
    const childrenSpanWidth = funcLayout.width + HORIZONTAL_SPACING + argLayout.width;

    // Center the application symbol '@' over the children's span
    const appSymbolX = (childrenSpanWidth / 2) - (nodeOwnWidth / 2);

    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'application',
      x: appSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    // Shift children subtrees to their final positions relative to this application block's origin.
    shiftSubtree(ctx, funcLayout.svgId, funcRelativeX - funcNodeInCtx.x);
    shiftSubtree(ctx, argLayout.svgId, argRelativeX - argNodeInCtx.x);

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-func'),
      fromSvgId: svgId,
      toSvgId: funcLayout.svgId,
      pathD: `M ${appSymbolX + nodeOwnWidth / 2} ${targetY + nodeOwnHeight} L ${funcRelativeX + funcLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && (astNode.func.isRedex || astNode.func.id === ctx.highlightedRedexId),
    });
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-arg'),
      fromSvgId: svgId,
      toSvgId: argLayout.svgId,
      pathD: `M ${appSymbolX + nodeOwnWidth / 2} ${targetY + nodeOwnHeight} L ${argRelativeX + argLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && (astNode.arg.isRedex || astNode.arg.id === ctx.highlightedRedexId),
    });

    currentProcessedSubtree = {
      centerX: appSymbolX + nodeOwnWidth / 2, // Center of the '@' symbol itself
      y: targetY,
      width: childrenSpanWidth,
      height: nodeOwnHeight + VERTICAL_SPACING + Math.max(funcLayout.height, argLayout.height),
      svgId: svgId,
      rootNodeX: appSymbolX,
    };
  }
  return currentProcessedSubtree;
}


// Shifts all nodes and relevant connector endpoints within a subtree by deltaX and deltaY.
function shiftSubtree(ctx: LayoutContext, rootSvgIdToShift: string, deltaX: number, deltaY: number = 0) {
  const nodesToShiftSet: Set<string> = new Set();
  const q: string[] = [rootSvgIdToShift];
  const visitedForShift: Set<string> = new Set();

  // BFS to find all nodes in the subtree starting from rootSvgIdToShift
  while (q.length > 0) {
    const currentId = q.shift()!;
    if (visitedForShift.has(currentId)) continue;
    visitedForShift.add(currentId);
    nodesToShiftSet.add(currentId);

    // Add children to the queue
    ctx.svgConnectors.forEach(c => {
      if (c.fromSvgId === currentId && !visitedForShift.has(c.toSvgId)) {
        q.push(c.toSvgId);
      }
    });
  }

  // Shift the identified nodes
  ctx.svgNodes.forEach(node => {
    if (nodesToShiftSet.has(node.svgId)) {
      node.x += deltaX;
      node.y += deltaY;
    }
  });

  // Shift the connector paths.
  // A connector is shifted if *either* its 'from' or 'to' node is in the subtree.
  // If only one end is in the subtree, only that end of the path is shifted.
  // If both ends are in the subtree, both ends are shifted by the same delta.
  ctx.svgConnectors.forEach(connector => {
    const fromNodeInSubtree = nodesToShiftSet.has(connector.fromSvgId);
    const toNodeInSubtree = nodesToShiftSet.has(connector.toSvgId);

    if (fromNodeInSubtree || toNodeInSubtree) {
      const parts = connector.pathD.match(/M\s*([-\d.eE]+)\s*([-\d.eE]+)\s*L\s*([-\d.eE]+)\s*([-\d.eE]+)/);
      if (parts && parts.length === 5) {
        let x1 = parseFloat(parts[1]);
        let y_1 = parseFloat(parts[2]); // y1 is a keyword in some contexts
        let x2 = parseFloat(parts[3]);
        let y2 = parseFloat(parts[4]);

        if (fromNodeInSubtree) {
          x1 += deltaX;
          y_1 += deltaY;
        }
        if (toNodeInSubtree) {
          x2 += deltaX;
          y2 += deltaY;
        }
        connector.pathD = `M ${x1} ${y_1} L ${x2} ${y2}`;
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
    // This initial layout call places everything relative to the root's conceptual origin (0,0).
    // Nodes within ctx.svgNodes will have their x,y coordinates set.
    // Connectors paths are also relative to this initial layout.
    layoutNodeRecursive(astNode, ctx, 0);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    if (ctx.svgNodes.length === 0) {
      return { nodes: [], connectors: [], canvasWidth: INITIAL_PADDING * 2, canvasHeight: INITIAL_PADDING * 2, error: "No SVG nodes generated." };
    }

    ctx.svgNodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x + node.width);
      minY = Math.min(minY, node.y); // minY should be 0 if root is at targetY=0
      maxY = Math.max(maxY, node.y + node.height);
    });

    // Normalization: shift entire drawing so minX, minY become INITIAL_PADDING
    const shiftX = (minX === Infinity) ? 0 : -minX + INITIAL_PADDING;
    const shiftY = (minY === Infinity) ? 0 : -minY + INITIAL_PADDING;

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

    const finalCanvasWidth = (maxX === -Infinity) ? INITIAL_PADDING * 2 : (maxX - minX) + 2 * INITIAL_PADDING;
    const finalCanvasHeight = (maxY === -Infinity) ? INITIAL_PADDING * 2 : (maxY - minY) + 2 * INITIAL_PADDING;

    return {
      nodes: ctx.svgNodes,
      connectors: ctx.svgConnectors,
      canvasWidth: Math.max(200, finalCanvasWidth), // Ensure a minimum canvas size
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
