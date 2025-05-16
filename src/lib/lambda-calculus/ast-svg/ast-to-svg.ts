
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';

// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 25; // Increased slightly
const VERTICAL_SPACING = 55;   // Increased slightly
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
  centerX: number; // The x-coordinate of the conceptual center of this subtree (for parent alignment)
  y: number;       // The y-coordinate of the root node of this subtree
  width: number;   // The total width of this subtree
  height: number;  // The total height of this subtree
  svgId: string;   // The SVG ID of the root node of this subtree
}

// Shifts all nodes within a subtree by deltaX and deltaY.
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
  targetY: number // Target Y for the current node's symbol
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
      centerX: nodeOwnWidth / 2, // Centered within its own box
      y: targetY,
      width: nodeOwnWidth,
      height: nodeOwnHeight,
      svgId: svgId,
    };
  } else if (astNode.type === 'lambda') {
    const lambdaNode = astNode as Lambda;
    const textContent = `λ${lambdaNode.param}.`;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, textContent.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout the body first, starting at targetY + nodeOwnHeight + VERTICAL_SPACING
    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    
    // Position the lambda symbol: its center should align with the body's center.
    // The lambda symbol's X will be bodyLayout.centerX - (nodeOwnWidth / 2)
    // (relative to the body's conceptual origin, before shifting the body)
    const lambdaSymbolX = bodyLayout.centerX - (nodeOwnWidth / 2);

    // Shift the body subtree so its root node's x-coordinate is correct relative to lambdaSymbolX
    // bodyNodeInCtx.x is initially 0 for its own layout block. We want its centerX to be under lambdaSymbolX's center.
    const bodyNodeInCtx = ctx.svgNodes.find(n => n.svgId === bodyLayout.svgId)!;
    // shiftSubtree(ctx, bodyLayout.svgId, lambdaSymbolX + nodeOwnWidth / 2 - (bodyNodeInCtx.x + bodyLayout.width / 2) );
    // To align centers: shift body so (bodyNode.x + bodyLayout.centerX) == (lambdaSymbolX + nodeOwnWidth / 2)
    shiftSubtree(ctx, bodyLayout.svgId, (lambdaSymbolX + nodeOwnWidth / 2) - (bodyNodeInCtx.x + bodyLayout.centerX));


    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId,
      toSvgId: bodyLayout.svgId,
      pathD: '', // Will be calculated later
      isHighlighted: isHighlighted && (astNode.body.isRedex || astNode.body.id === ctx.highlightedRedexId),
    });

    currentProcessedSubtree = {
      centerX: lambdaSymbolX + nodeOwnWidth / 2, // Center of the lambda symbol itself
      y: targetY,
      width: Math.max(nodeOwnWidth, bodyLayout.width), // Width is max of symbol or body's extent
      height: nodeOwnHeight + VERTICAL_SPACING + bodyLayout.height,
      svgId: svgId,
    };

  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout children first
    const funcLayout = layoutNodeRecursive(appNode.func, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);

    const funcNodeInCtx = ctx.svgNodes.find(n => n.svgId === funcLayout.svgId)!;
    const argNodeInCtx = ctx.svgNodes.find(n => n.svgId === argLayout.svgId)!;
    
    // Position func subtree starting at x=0 (relative to this application's block)
    // Its original funcNodeInCtx.x was 0 for its own layout. Its centerX is funcLayout.centerX.
    // We want its x to be (0 - funcNodeInCtx.x) which is 0. And its conceptual center is funcLayout.centerX.
    shiftSubtree(ctx, funcLayout.svgId, 0 - funcNodeInCtx.x); // funcNodeInCtx.x is likely 0 already.
    
    // Position arg subtree to the right of func subtree
    const argTargetX = funcLayout.width + HORIZONTAL_SPACING;
    shiftSubtree(ctx, argLayout.svgId, argTargetX - argNodeInCtx.x);

    // Position the '@' symbol centered above the 'func' part
    const appSymbolX = funcLayout.centerX - (nodeOwnWidth / 2);
    
    const createdNode: SvgAstNode = {
      id: astNode.id, svgId, type: 'application',
      x: appSymbolX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-func'),
      fromSvgId: svgId,
      toSvgId: funcLayout.svgId, // Connect to func's root
      pathD: '', 
      isHighlighted: isHighlighted && (astNode.func.isRedex || astNode.func.id === ctx.highlightedRedexId),
    });
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-arg'),
      fromSvgId: svgId,
      toSvgId: argLayout.svgId, // Connect to arg's root
      pathD: '', 
      isHighlighted: isHighlighted && (astNode.arg.isRedex || astNode.arg.id === ctx.highlightedRedexId),
    });
    
    currentProcessedSubtree = {
      centerX: appSymbolX + nodeOwnWidth / 2, // Center of the '@' symbol, biased to func
      y: targetY,
      width: argTargetX + argLayout.width, // Total width spanned
      height: nodeOwnHeight + VERTICAL_SPACING + Math.max(funcLayout.height, argLayout.height),
      svgId: svgId,
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
    // Initial layout pass. Nodes are positioned relative to their local subtree's origin.
    // The root of the whole tree will start effectively at (0,0) for its block.
    layoutNodeRecursive(astNode, ctx, 0);

    // After all recursive layout and shifting within subtrees,
    // calculate final pathD for connectors using the current node positions.
    ctx.svgConnectors.forEach(connector => {
      const fromNode = ctx.svgNodes.find(n => n.svgId === connector.fromSvgId);
      const toNode = ctx.svgNodes.find(n => n.svgId === connector.toSvgId);

      if (fromNode && toNode) {
          const startX = fromNode.x + fromNode.width / 2;
          const startY = fromNode.y + fromNode.height; // Bottom-center of parent
          const endX = toNode.x + toNode.width / 2;
          const endY = toNode.y;                 // Top-center of child
          connector.pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
      } else {
          console.warn("generateAstSvgData: Could not find nodes for connector:", connector.id, connector.fromSvgId, connector.toSvgId);
          connector.pathD = "M 0 0 L 0 0"; 
      }
    });

    // Normalize all coordinates to be positive and add padding for canvas.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    if (ctx.svgNodes.length === 0) {
      return { nodes: [], connectors: [], canvasWidth: INITIAL_PADDING * 2, canvasHeight: INITIAL_PADDING * 2, error: "No SVG nodes generated." };
    }

    ctx.svgNodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x + node.width);
      minY = Math.min(minY, node.y); // minY is already 0 due to initial targetY=0
      maxY = Math.max(maxY, node.y + node.height);
    });
    
    // Include connector points in min/max calculation
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
    // minY should be 0 from the layout, so shiftY mainly adds top padding.
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
    
    const finalCanvasWidth = (maxX === -Infinity || minX === maxX) 
        ? (ctx.svgNodes[0]?.width || 0) + 2 * INITIAL_PADDING 
        : (maxX - minX) + 2 * INITIAL_PADDING;
    const finalCanvasHeight = (maxY === -Infinity || minY === maxY) 
        ? (ctx.svgNodes[0]?.height || 0) + 2 * INITIAL_PADDING 
        : (maxY - minY) + 2 * INITIAL_PADDING;


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
