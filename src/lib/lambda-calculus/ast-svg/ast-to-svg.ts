
import type { ASTNode, Variable, Lambda, Application, ASTNodeId } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';

// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 20; // Reduced from 25
const VERTICAL_SPACING = 50;   // Reduced from 55
const TEXT_PADDING = 5;
const CHAR_WIDTH_ESTIMATE = 8;
const INITIAL_PADDING = 20;

interface LayoutContext {
  svgNodes: SvgAstNode[];
  svgConnectors: SvgConnector[];
  highlightedRedexId?: string;
  currentYOffset: number; // Tracks current Y to avoid overlap in some cases
  minXOverall: number;
  maxXOverall: number;
  minYOverall: number;
  maxYOverall: number;
}

function initializeLayoutContext(highlightedRedexId?: string): LayoutContext {
  return {
    svgNodes: [],
    svgConnectors: [],
    highlightedRedexId,
    currentYOffset: 0,
    minXOverall: Infinity,
    maxXOverall: -Infinity,
    minYOverall: Infinity,
    maxYOverall: -Infinity,
  };
}

interface ProcessedSubtree {
  centerX: number;
  y: number;
  width: number;
  height: number;
  svgId: string;
  nodeRef: SvgAstNode; // Reference to the created SvgAstNode
}

function updateOverallBounds(ctx: LayoutContext, node: SvgAstNode) {
    ctx.minXOverall = Math.min(ctx.minXOverall, node.x);
    ctx.maxXOverall = Math.max(ctx.maxXOverall, node.x + node.width);
    ctx.minYOverall = Math.min(ctx.minYOverall, node.y);
    ctx.maxYOverall = Math.max(ctx.maxYOverall, node.y + node.height);
}

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
  currentX: number, // Target X for this node's conceptual block start
  currentY: number  // Target Y for this node's symbol
): ProcessedSubtree {
  const svgId = generateSvgNodeId(astNode.type);
  const isHighlighted = astNode.id === ctx.highlightedRedexId || astNode.isRedex;
  let nodeOwnWidth: number;
  const nodeOwnHeight = NODE_HEIGHT;

  let createdNode: SvgAstNode;
  let subtreeWidth: number;
  let subtreeHeight: number;
  let subtreeCenterX: number;


  if (astNode.type === 'variable') {
    const varNode = astNode as Variable;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, varNode.name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);
    createdNode = {
      id: astNode.id, svgId, type: 'variable', name: varNode.name,
      x: currentX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    subtreeWidth = nodeOwnWidth;
    subtreeHeight = nodeOwnHeight;
    subtreeCenterX = currentX + nodeOwnWidth / 2;
  } else if (astNode.type === 'lambda') {
    const lambdaNode = astNode as Lambda;
    const textContent = `λ${lambdaNode.param}.`;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, textContent.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, currentX, currentY + nodeOwnHeight + VERTICAL_SPACING);
    
    const lambdaSymbolX = bodyLayout.centerX - (nodeOwnWidth / 2);
    
    // Shift the body subtree so its actual center aligns with where the lambda symbol wants it
    const bodyNodeInCtx = bodyLayout.nodeRef; //ctx.svgNodes.find(n => n.svgId === bodyLayout.svgId)!;
    const requiredBodyShiftX = lambdaSymbolX + nodeOwnWidth / 2 - (bodyNodeInCtx.x + bodyNodeInCtx.width / 2);
    if (Math.abs(requiredBodyShiftX) > 0.1) { // Only shift if necessary
        shiftSubtree(ctx, bodyLayout.svgId, requiredBodyShiftX);
    }
    
    createdNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaSymbolX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId, toSvgId: bodyLayout.svgId, pathD: '',
      isHighlighted: isHighlighted && (astNode.body.isRedex || astNode.body.id === ctx.highlightedRedexId),
    });

    subtreeWidth = Math.max(nodeOwnWidth, bodyLayout.width + (lambdaSymbolX < bodyNodeInCtx.x ? bodyNodeInCtx.x - lambdaSymbolX : 0) ); // Account for relative positioning
    subtreeHeight = (bodyLayout.y + bodyLayout.height) - currentY; // total height from lambda symbol top to body bottom
    subtreeCenterX = lambdaSymbolX + nodeOwnWidth / 2;

  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout children relative to currentX
    const funcLayout = layoutNodeRecursive(appNode.func, ctx, currentX, currentY + nodeOwnHeight + VERTICAL_SPACING);
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, currentX + funcLayout.width + HORIZONTAL_SPACING, currentY + nodeOwnHeight + VERTICAL_SPACING);

    const funcNodeInCtx = funcLayout.nodeRef;
    const argNodeInCtx = argLayout.nodeRef;

    // Application symbol centered above the function part
    const appSymbolX = funcLayout.centerX - (nodeOwnWidth / 2);
    
    // Shift funcLayout if its actual position is not currentX
    const funcShiftX = currentX - funcNodeInCtx.x;
    if (Math.abs(funcShiftX) > 0.1) {
        shiftSubtree(ctx, funcLayout.svgId, funcShiftX);
    }
    
    // Shift argLayout to be to the right of the (now shifted) funcLayout
    const targetArgX = funcNodeInCtx.x + funcNodeInCtx.width + HORIZONTAL_SPACING; // Use actual func pos
    const argShiftX = targetArgX - argNodeInCtx.x;
     if (Math.abs(argShiftX) > 0.1) {
        shiftSubtree(ctx, argLayout.svgId, argShiftX);
    }


    createdNode = {
      id: astNode.id, svgId, type: 'application',
      x: appSymbolX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-func'), fromSvgId: svgId, toSvgId: funcLayout.svgId, pathD: '',
      isHighlighted: isHighlighted && (astNode.func.isRedex || astNode.func.id === ctx.highlightedRedexId),
    });
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-arg'), fromSvgId: svgId, toSvgId: argLayout.svgId, pathD: '',
      isHighlighted: isHighlighted && (astNode.arg.isRedex || astNode.arg.id === ctx.highlightedRedexId),
    });
    
    subtreeWidth = (argNodeInCtx.x + argNodeInCtx.width) - funcNodeInCtx.x; // Width from start of func to end of arg
    subtreeHeight = (Math.max(funcLayout.y + funcLayout.height, argLayout.y + argLayout.height)) - currentY;
    subtreeCenterX = appSymbolX + nodeOwnWidth / 2; // Center of the '@' symbol
  }
  
  ctx.svgNodes.push(createdNode);
  updateOverallBounds(ctx, createdNode); // Update bounds with this node

  return {
    centerX: subtreeCenterX,
    y: currentY,
    width: subtreeWidth,
    height: subtreeHeight,
    svgId: svgId,
    nodeRef: createdNode
  };
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
    layoutNodeRecursive(astNode, ctx, 0, 0); // Start root layout at (0,0) conceptually

    // After all recursive layout and shifting, calculate final pathD for connectors
    ctx.svgConnectors.forEach(connector => {
      const fromNode = ctx.svgNodes.find(n => n.svgId === connector.fromSvgId);
      const toNode = ctx.svgNodes.find(n => n.svgId === connector.toSvgId);
      if (fromNode && toNode) {
        const startX = fromNode.x + fromNode.width / 2;
        const startY = fromNode.y + fromNode.height;
        const endX = toNode.x + toNode.width / 2;
        const endY = toNode.y;
        connector.pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
         // Update overall bounds with connector points
        ctx.minXOverall = Math.min(ctx.minXOverall, startX, endX);
        ctx.maxXOverall = Math.max(ctx.maxXOverall, startX, endX);
        ctx.minYOverall = Math.min(ctx.minYOverall, startY, endY);
        ctx.maxYOverall = Math.max(ctx.maxYOverall, startY, endY);
      } else {
        connector.pathD = "M 0 0 L 0 0";
      }
    });
    
    // Normalize all coordinates if nodes exist
    let shiftX = INITIAL_PADDING;
    let shiftY = INITIAL_PADDING;

    if (ctx.svgNodes.length > 0) {
        shiftX = (ctx.minXOverall === Infinity) ? INITIAL_PADDING : -ctx.minXOverall + INITIAL_PADDING;
        shiftY = (ctx.minYOverall === Infinity) ? INITIAL_PADDING : -ctx.minYOverall + INITIAL_PADDING;

        ctx.svgNodes.forEach(node => {
            node.x += shiftX;
            node.y += shiftY;
        });

        ctx.svgConnectors.forEach(connector => {
            const parts = connector.pathD.match(/M\s*([-\d.eE]+)\s*([-\d.eE]+)\s*L\s*([-\d.eE]+)\s*([-\d.eE]+)/);
            if (parts && parts.length === 5) {
                const x1 = parseFloat(parts[1]) + shiftX;
                const y_1 = parseFloat(parts[2]) + shiftY; // Corrected variable name
                const x2 = parseFloat(parts[3]) + shiftX;
                const y2 = parseFloat(parts[4]) + shiftY;
                connector.pathD = `M ${x1} ${y_1} L ${x2} ${y2}`;
            }
        });
    }
    
    const finalCanvasWidth = (ctx.maxXOverall === -Infinity || ctx.minXOverall === Infinity) 
        ? (ctx.svgNodes[0]?.width || 0) + 2 * INITIAL_PADDING 
        : (ctx.maxXOverall - ctx.minXOverall) + 2 * INITIAL_PADDING;
    const finalCanvasHeight = (ctx.maxYOverall === -Infinity || ctx.minYOverall === Infinity) 
        ? (ctx.svgNodes[0]?.height || 0) + 2 * INITIAL_PADDING 
        : (ctx.maxYOverall - ctx.minYOverall) + 2 * INITIAL_PADDING;


    return {
      nodes: ctx.svgNodes,
      connectors: ctx.svgConnectors,
      canvasWidth: Math.max(200, finalCanvasWidth),
      canvasHeight: Math.max(100, finalCanvasHeight),
    };
  } catch (error: any) {
    console.error("Error during AST SVG layout:", error);
    return {
      nodes: [], connectors: [], canvasWidth: 300, canvasHeight: 100,
      error: `Layout Error: ${error.message || "Unknown error"}`,
    };
  }
}


export function generateSingleNodeSvgData(
  name: string, 
  originalAstId: ASTNodeId, 
  sourcePrimitiveForColoring?: string
): AstSvgRenderData {
  const svgId = generateSvgNodeId('summary');
  const nodeOwnWidth = Math.max(MIN_NODE_WIDTH, name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING + 10); // +10 for a bit more padding
  const nodeOwnHeight = NODE_HEIGHT;

  const summaryNode: SvgAstNode = {
    id: originalAstId, // Link to the original AST node
    svgId,
    type: 'variable', // Treat as a variable for rendering purposes, or create a new type if more distinction needed
    name: name,       // The prettified name to display
    x: INITIAL_PADDING,
    y: INITIAL_PADDING,
    width: nodeOwnWidth,
    height: nodeOwnHeight,
    isHighlighted: false, // Summary nodes are not typically highlighted as redexes
    sourcePrimitiveName: sourcePrimitiveForColoring || name, // Use the name itself for coloring lookup
  };

  return {
    nodes: [summaryNode],
    connectors: [],
    canvasWidth: nodeOwnWidth + 2 * INITIAL_PADDING,
    canvasHeight: nodeOwnHeight + 2 * INITIAL_PADDING,
  };
}
