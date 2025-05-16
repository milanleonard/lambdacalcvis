
import type { ASTNode, Variable, Lambda, Application, ASTNodeId } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';
import { prettifyAST } from '../prettifier';
import { print } from '../printer';
import type { NamedExpression } from '../predefined';


// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 20;
const VERTICAL_SPACING = 45;
const TEXT_PADDING = 5;
const CHAR_WIDTH_ESTIMATE = 8;
const INITIAL_PADDING = 20;

interface LayoutContext {
  svgNodes: SvgAstNode[];
  svgConnectors: SvgConnector[];
  highlightedRedexId?: string;
  minXOverall: number;
  maxXOverall: number;
  minYOverall: number;
  maxYOverall: number;
  customExpressions: NamedExpression[];
  predefinedExpressions: NamedExpression[];
  expandedSubtreeNodeIds: Set<ASTNodeId>; // New
}

function initializeLayoutContext(
  highlightedRedexId?: string,
  customExpressions: NamedExpression[] = [],
  predefinedExpressions: NamedExpression[] = [],
  expandedSubtreeNodeIds: Set<ASTNodeId> = new Set() // New
): LayoutContext {
  return {
    svgNodes: [],
    svgConnectors: [],
    highlightedRedexId,
    minXOverall: Infinity,
    maxXOverall: -Infinity,
    minYOverall: Infinity,
    maxYOverall: -Infinity,
    customExpressions,
    predefinedExpressions,
    expandedSubtreeNodeIds, // New
  };
}

interface ProcessedSubtree {
  centerX: number; // Center X of the root of this subtree, relative to currentX
  y: number;       // Top Y of the root of this subtree
  width: number;   // Total width of this subtree
  height: number;  // Total height of this subtree
  svgId: string;   // SVG ID of the root node of this subtree
}


function updateOverallBounds(ctx: LayoutContext, nodeX: number, nodeY: number, nodeWidth: number, nodeHeight: number) {
    ctx.minXOverall = Math.min(ctx.minXOverall, nodeX);
    ctx.maxXOverall = Math.max(ctx.maxXOverall, nodeX + nodeWidth);
    ctx.minYOverall = Math.min(ctx.minYOverall, nodeY);
    ctx.maxYOverall = Math.max(ctx.maxYOverall, nodeY + nodeHeight);
}

// currentX is the leftmost available x-coordinate for this node's own symbol/block.
// currentY is the y-coordinate for this node's symbol.
function layoutNodeRecursive(
  astNode: ASTNode,
  ctx: LayoutContext,
  currentX: number,
  currentY: number
): ProcessedSubtree {
  const svgId = generateSvgNodeId(astNode.type);
  const isHighlighted = astNode.id === ctx.highlightedRedexId || astNode.isRedex;
  let nodeOwnWidth: number;
  const nodeOwnHeight = NODE_HEIGHT;
  let createdNode: SvgAstNode;

  // --- Greedy Subtree Collapse Check ---
  const prettyName = prettifyAST(astNode, ctx.customExpressions, ctx.predefinedExpressions);
  const canonicalPrintVal = print(astNode);
  const isSignificantSubtreeCollapse = prettyName !== canonicalPrintVal && !prettyName.includes(" ") && prettyName.startsWith('_');

  if (isSignificantSubtreeCollapse && !ctx.expandedSubtreeNodeIds.has(astNode.id)) {
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, prettyName.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);
    createdNode = {
      id: astNode.id, svgId, type: 'variable',
      name: prettyName,
      x: currentX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: prettyName,
      isGreedilyCollapsible: true, // Mark as collapsible
    };
    ctx.svgNodes.push(createdNode);
    updateOverallBounds(ctx, createdNode.x, createdNode.y, createdNode.width, createdNode.height);
    return {
      centerX: nodeOwnWidth / 2, // centerX relative to currentX
      y: currentY,
      width: nodeOwnWidth,
      height: nodeOwnHeight,
      svgId: svgId,
    };
  }
  // --- End Greedy Subtree Collapse Check ---


  let subtreeWidth: number;
  let subtreeHeight: number;
  let subtreeCenterXRel: number; // Center X relative to currentX

  if (astNode.type === 'variable') {
    const varNode = astNode as Variable;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, varNode.name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);
    createdNode = {
      id: astNode.id, svgId, type: 'variable', name: varNode.name,
      x: currentX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName,
      isGreedilyCollapsible: isSignificantSubtreeCollapse,
    };
    subtreeWidth = nodeOwnWidth;
    subtreeHeight = nodeOwnHeight;
    subtreeCenterXRel = nodeOwnWidth / 2;
  } else if (astNode.type === 'lambda') {
    const lambdaNode = astNode as Lambda;
    const textContent = `λ${lambdaNode.param}.`;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, textContent.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout body, starting it at currentX (it will be centered later if needed)
    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, currentX, currentY + nodeOwnHeight + VERTICAL_SPACING);

    // Center lambda symbol above the body's actual width and relative center
    const lambdaSymbolRelX = bodyLayout.centerX - (nodeOwnWidth / 2);
    const lambdaSymbolActualX = currentX + lambdaSymbolRelX;

    createdNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaSymbolActualX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName,
      isGreedilyCollapsible: isSignificantSubtreeCollapse,
    };

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId, toSvgId: bodyLayout.svgId, pathD: '',
      isHighlighted: isHighlighted && (astNode.body.isRedex || astNode.body.id === ctx.highlightedRedexId),
    });
    
    subtreeWidth = Math.max(nodeOwnWidth, bodyLayout.width);
    subtreeHeight = (bodyLayout.y + bodyLayout.height) - currentY;
    subtreeCenterXRel = lambdaSymbolRelX + nodeOwnWidth / 2;

  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout func subtree, starting at currentX
    const funcLayout = layoutNodeRecursive(appNode.func, ctx, currentX, currentY + nodeOwnHeight + VERTICAL_SPACING);

    // Layout arg subtree, starting after func subtree + spacing
    // currentX for arg is relative to its own sub-problem, starting at 0.
    // Then we'll shift it.
    const argSubtreeLayout = layoutNodeRecursive(appNode.arg, ctx, 0, currentY + nodeOwnHeight + VERTICAL_SPACING);

    // Calculate final X position for the Arg subtree (which was laid out starting at its own x=0)
    // It needs to be shifted relative to the application node's currentX.
    const argFinalStartX = currentX + funcLayout.width + HORIZONTAL_SPACING;
    
    // Shift all nodes within argSubtreeLayout by argFinalStartX
    // This requires finding all nodes belonging to argSubtreeLayout in ctx.svgNodes
    // and updating their .x coordinates. This is complex if we only return dimensions.
    // Alternative: layoutNodeRecursive applies its passed currentX to its root.
    // So, pass the correct starting X for arg directly.
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, argFinalStartX, currentY + nodeOwnHeight + VERTICAL_SPACING);


    const childrenBlockWidth = (argLayout.svgId ? (argLayout.width + (argLayout.centerX - argLayout.width/2) + argFinalStartX - currentX) : funcLayout.width);
     // If argLayout has an svgId, it means it was rendered. Take its actual width and position.
    // The width from funcLayout's start (currentX) to argLayout's end.
    // argLayout.centerX is relative to argFinalStartX. So argLayout.x_absolute = argFinalStartX + (argLayout.centerX - argLayout.width/2)
    // End of argLayout is argLayout.x_absolute + argLayout.width

    const appSymbolRelX = funcLayout.centerX - (nodeOwnWidth / 2); // Bias towards function
    const appSymbolActualX = currentX + appSymbolRelX;

    createdNode = {
      id: astNode.id, svgId, type: 'application',
      x: appSymbolActualX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName,
      isGreedilyCollapsible: isSignificantSubtreeCollapse,
    };

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-func'), fromSvgId: svgId, toSvgId: funcLayout.svgId, pathD: '',
      isHighlighted: isHighlighted && (astNode.func.isRedex || astNode.func.id === ctx.highlightedRedexId),
    });
    if (argLayout.svgId) { // Only add connector if arg was actually drawn (not part of a collapsed func)
        ctx.svgConnectors.push({
        id: generateSvgNodeId('connector-arg'), fromSvgId: svgId, toSvgId: argLayout.svgId, pathD: '',
        isHighlighted: isHighlighted && (astNode.arg.isRedex || astNode.arg.id === ctx.highlightedRedexId),
        });
    }
    
    // Total width is from start of func (currentX) to end of arg.
    // End of arg is argFinalStartX + argLayout.width
    subtreeWidth = (argLayout.svgId ? (argFinalStartX + argLayout.width - currentX) : funcLayout.width);
    subtreeHeight = (Math.max(funcLayout.y + funcLayout.height, argLayout.svgId ? (argLayout.y + argLayout.height) : 0)) - currentY;
    subtreeCenterXRel = appSymbolRelX + nodeOwnWidth / 2; // Biased towards function's center
  }

  ctx.svgNodes.push(createdNode);
  updateOverallBounds(ctx, createdNode.x, createdNode.y, createdNode.width, createdNode.height);


  return {
    centerX: subtreeCenterXRel, // Relative to the currentX passed into this call
    y: currentY,
    width: subtreeWidth,
    height: subtreeHeight,
    svgId: svgId,
  };
}


export function generateAstSvgData(
  astNode: ASTNode | null,
  highlightedRedexId?: string,
  customExpressions: NamedExpression[] = [],
  predefinedExpressions: NamedExpression[] = [],
  expandedSubtreeNodeIds: Set<ASTNodeId> = new Set() // New
): AstSvgRenderData {
  if (!astNode) {
    return { nodes: [], connectors: [], canvasWidth: 0, canvasHeight: 0, error: "No AST node provided." };
  }

  const ctx = initializeLayoutContext(highlightedRedexId, customExpressions, predefinedExpressions, expandedSubtreeNodeIds);

  try {
    // Initial layout pass. Nodes are positioned relative to a conceptual tree origin (0,0).
    layoutNodeRecursive(astNode, ctx, 0, 0);

    // Calculate connector paths based on final relative node positions
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
        // Should not happen if layout is correct and all nodes are added
        connector.pathD = "M 0 0 L 0 0";
         console.warn("Orphaned connector:", connector.id, "From:", connector.fromSvgId, "To:", connector.toSvgId);
      }
    });

    // Calculate overall bounds from all nodes and connectors to prepare for normalization
    // This step should have been implicitly handled by updateOverallBounds during layout.
    // If any node/connector positions were calculated/shifted *after* their initial layout,
    // bounds might need re-evaluation or careful update.
    // For now, relying on updateOverallBounds.

    let shiftX = INITIAL_PADDING;
    let shiftY = INITIAL_PADDING;

    if (ctx.svgNodes.length > 0) {
        // If minXOverall is still Infinity, it means no nodes were laid out (e.g., fully collapsed global AST).
        // In that case, shiftX/Y will just be INITIAL_PADDING.
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
                const y1 = parseFloat(parts[2]) + shiftY;
                const x2 = parseFloat(parts[3]) + shiftX;
                const y2 = parseFloat(parts[4]) + shiftY;
                connector.pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
            }
        });
    } else if (astNode && isSignificantGlobalCollapse(astNode, ctx.customExpressions, ctx.predefinedExpressions)) {
        // This case handles when the *entire* AST is a single collapsed node.
        // The layoutNodeRecursive would have returned early.
        // We need to manually add this single node if generateSingleNodeSvgData isn't used.
        // However, the main ASTVisualizer component handles the global collapse separately
        // by calling generateSingleNodeSvgData, so this specific 'else if' might be redundant here.
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

// Helper function to check for global collapse significance (used if astNode is root)
function isSignificantGlobalCollapse(
    astNode: ASTNode,
    customExpressions: NamedExpression[],
    predefinedExpressions: NamedExpression[]
): boolean {
    const prettyName = prettifyAST(astNode, customExpressions, predefinedExpressions);
    const canonicalPrintVal = print(astNode);
    return prettyName !== canonicalPrintVal && !prettyName.includes(" ") && prettyName.startsWith('_');
}


export function generateSingleNodeSvgData(
  name: string,
  originalAstId: string,
  sourcePrimitiveForColoring?: string
): AstSvgRenderData {
  const svgId = generateSvgNodeId('summary');
  const nodeOwnWidth = Math.max(MIN_NODE_WIDTH, name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING + 10);
  const nodeOwnHeight = NODE_HEIGHT;

  const summaryNode: SvgAstNode = {
    id: originalAstId,
    svgId,
    type: 'variable',
    name: name,
    x: INITIAL_PADDING,
    y: INITIAL_PADDING,
    width: nodeOwnWidth,
    height: nodeOwnHeight,
    isHighlighted: false,
    sourcePrimitiveName: sourcePrimitiveForColoring || name,
    isGreedilyCollapsible: true, // A globally collapsed node is definitionally collapsible
  };

  return {
    nodes: [summaryNode],
    connectors: [],
    canvasWidth: nodeOwnWidth + 2 * INITIAL_PADDING,
    canvasHeight: nodeOwnHeight + 2 * INITIAL_PADDING,
  };
}
