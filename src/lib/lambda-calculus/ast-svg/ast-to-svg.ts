
import type { ASTNode, Variable, Lambda, Application, ASTNodeId } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';

// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 20;
const VERTICAL_SPACING = 50;
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
}

function initializeLayoutContext(highlightedRedexId?: string): LayoutContext {
  return {
    svgNodes: [],
    svgConnectors: [],
    highlightedRedexId,
    minXOverall: Infinity,
    maxXOverall: -Infinity,
    minYOverall: Infinity,
    maxYOverall: -Infinity,
  };
}

interface ProcessedSubtree {
  centerX: number; // X-coordinate of the center of the current node's symbol
  y: number;       // Y-coordinate of the top of the current node's symbol
  width: number;   // Total width of the subtree rooted at this node
  height: number;  // Total height of the subtree rooted at this node
  svgId: string;   // SVG ID of the current node's symbol
  nodeRef: SvgAstNode; // Reference to the created SvgAstNode for the current node's symbol
}

function updateOverallBounds(ctx: LayoutContext, node: SvgAstNode) {
    ctx.minXOverall = Math.min(ctx.minXOverall, node.x);
    ctx.maxXOverall = Math.max(ctx.maxXOverall, node.x + node.width);
    ctx.minYOverall = Math.min(ctx.minYOverall, node.y);
    ctx.maxYOverall = Math.max(ctx.maxYOverall, node.y + node.height);
}

// currentX is the leftmost available x-coordinate for the current node's entire subtree
// currentY is the y-coordinate for the current node's symbol
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
  let subtreeWidth: number;
  let subtreeHeight: number;
  let subtreeCenterX: number; // Center of the current node's symbol

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

    // Body starts at the same currentX as the lambda block, but positioned vertically lower
    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, currentX, currentY + nodeOwnHeight + VERTICAL_SPACING);
    
    // Center the lambda symbol above the body's subtree
    const lambdaSymbolX = (currentX + bodyLayout.width / 2) - (nodeOwnWidth / 2);
    
    createdNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaSymbolX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId, toSvgId: bodyLayout.svgId, pathD: '', // pathD calculated later
      isHighlighted: isHighlighted && (astNode.body.isRedex || astNode.body.id === ctx.highlightedRedexId),
    });

    subtreeWidth = Math.max(nodeOwnWidth, bodyLayout.width);
    subtreeHeight = (bodyLayout.nodeRef.y + bodyLayout.nodeRef.height) - currentY;
    subtreeCenterX = lambdaSymbolX + nodeOwnWidth / 2;

  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout func subtree starting at currentX
    const funcLayout = layoutNodeRecursive(appNode.func, ctx, currentX, currentY + nodeOwnHeight + VERTICAL_SPACING);
    
    // Layout arg subtree starting after func subtree + spacing
    const argStartX = currentX + funcLayout.width + HORIZONTAL_SPACING;
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, argStartX, currentY + nodeOwnHeight + VERTICAL_SPACING);
    
    // Position the '@' symbol centered above the combined span of children subtrees
    const childrenBlockStart = currentX; // Func subtree starts at currentX
    const childrenBlockEnd = argStartX + argLayout.width; // Arg subtree ends here
    const childrenEffectiveWidth = childrenBlockEnd - childrenBlockStart;
    
    const appSymbolCenterX = childrenBlockStart + childrenEffectiveWidth / 2;
    const appSymbolX = appSymbolCenterX - (nodeOwnWidth / 2);
    
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
    
    subtreeWidth = Math.max(nodeOwnWidth, childrenEffectiveWidth);
    subtreeHeight = (Math.max(funcLayout.nodeRef.y + funcLayout.nodeRef.height, argLayout.nodeRef.y + argLayout.nodeRef.height)) - currentY;
    subtreeCenterX = appSymbolX + nodeOwnWidth / 2;
  }
  
  ctx.svgNodes.push(createdNode);
  updateOverallBounds(ctx, createdNode);

  return {
    centerX: subtreeCenterX,
    y: currentY, // y of the current node's symbol
    width: subtreeWidth, // width of the entire subtree managed by this node
    height: subtreeHeight, // height of the entire subtree managed by this node
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
    // Initial layout pass, starts at (0,0) conceptually for the root block
    layoutNodeRecursive(astNode, ctx, 0, 0); 

    // After all recursive layout, calculate final pathD for connectors and update overall bounds
    ctx.svgConnectors.forEach(connector => {
      const fromNode = ctx.svgNodes.find(n => n.svgId === connector.fromSvgId);
      const toNode = ctx.svgNodes.find(n => n.svgId === connector.toSvgId);
      if (fromNode && toNode) {
        const startX = fromNode.x + fromNode.width / 2;
        const startY = fromNode.y + fromNode.height; // Bottom-center of parent
        const endX = toNode.x + toNode.width / 2;
        const endY = toNode.y; // Top-center of child
        connector.pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
        
        // Update overall bounds with connector points as well, as they can extend
        ctx.minXOverall = Math.min(ctx.minXOverall, startX, endX);
        ctx.maxXOverall = Math.max(ctx.maxXOverall, startX, endX);
        ctx.minYOverall = Math.min(ctx.minYOverall, startY, endY);
        ctx.maxYOverall = Math.max(ctx.maxYOverall, startY, endY);
      } else {
        connector.pathD = "M 0 0 L 0 0"; // Should not happen if IDs are correct
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
                const y1 = parseFloat(parts[2]) + shiftY;
                const x2 = parseFloat(parts[3]) + shiftX;
                const y2 = parseFloat(parts[4]) + shiftY;
                connector.pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
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
      canvasWidth: Math.max(200, finalCanvasWidth), // Ensure a minimum canvas size
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
  };

  return {
    nodes: [summaryNode],
    connectors: [],
    canvasWidth: nodeOwnWidth + 2 * INITIAL_PADDING,
    canvasHeight: nodeOwnHeight + 2 * INITIAL_PADDING,
  };
}
