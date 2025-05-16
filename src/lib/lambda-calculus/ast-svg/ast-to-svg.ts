
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';
import { prettifyAST } from '../prettifier'; // For greedy subtree collapse
import { print } from '../printer';         // For greedy subtree collapse condition
import type { NamedExpression } from '../predefined'; // For passing to prettifyAST


// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 25; // Increased spacing
const VERTICAL_SPACING = 50;
const TEXT_PADDING = 5;
const CHAR_WIDTH_ESTIMATE = 8; // Estimate for monospaced font
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
}

function initializeLayoutContext(
  highlightedRedexId?: string,
  customExpressions: NamedExpression[] = [],
  predefinedExpressions: NamedExpression[] = []
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
  };
}

interface ProcessedSubtree {
  centerX: number;
  y: number;
  width: number;
  height: number;
  svgId: string;
  nodeRef: SvgAstNode;
}

function updateOverallBounds(ctx: LayoutContext, node: SvgAstNode) {
    ctx.minXOverall = Math.min(ctx.minXOverall, node.x);
    ctx.maxXOverall = Math.max(ctx.maxXOverall, node.x + node.width);
    ctx.minYOverall = Math.min(ctx.minYOverall, node.y);
    ctx.maxYOverall = Math.max(ctx.maxYOverall, node.y + node.height);
}

// currentX is the leftmost available x-coordinate for this node's symbol
// currentY is the y-coordinate for this node's symbol
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

  if (isSignificantSubtreeCollapse) {
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, prettyName.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);
    createdNode = {
      id: astNode.id, svgId, type: 'variable', // Render collapsed as a variable-like box
      name: prettyName, 
      x: currentX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: prettyName // Use prettyName for coloring
    };
    ctx.svgNodes.push(createdNode);
    updateOverallBounds(ctx, createdNode);
    return {
      centerX: currentX + nodeOwnWidth / 2,
      y: currentY,
      width: nodeOwnWidth,
      height: nodeOwnHeight,
      svgId: svgId,
      nodeRef: createdNode
    };
  }
  // --- End Greedy Subtree Collapse Check ---


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
    
    // Center lambda symbol above the body's layout
    const lambdaSymbolX = bodyLayout.centerX - (nodeOwnWidth / 2);
    
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

    subtreeWidth = Math.max(nodeOwnWidth, bodyLayout.width);
    // Height is from top of lambda symbol to bottom of body's layout
    subtreeHeight = (bodyLayout.nodeRef.y + bodyLayout.nodeRef.height) - currentY; 
    subtreeCenterX = lambdaSymbolX + nodeOwnWidth / 2;

  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    // Layout func subtree, starting at currentX
    const funcLayout = layoutNodeRecursive(appNode.func, ctx, currentX, currentY + nodeOwnHeight + VERTICAL_SPACING);
    
    // Layout arg subtree, starting after func subtree + spacing
    const argStartX = currentX + funcLayout.width + HORIZONTAL_SPACING;
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, argStartX, currentY + nodeOwnHeight + VERTICAL_SPACING);
    
    const childrenBlockStart = currentX; 
    const childrenBlockEnd = argStartX + argLayout.width; 
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
    y: currentY, 
    width: subtreeWidth, 
    height: subtreeHeight, 
    svgId: svgId,
    nodeRef: createdNode
  };
}

export function generateAstSvgData(
  astNode: ASTNode | null,
  highlightedRedexId?: string,
  customExpressions: NamedExpression[] = [], // For greedy subtree collapse
  predefinedExpressions: NamedExpression[] = [] // For greedy subtree collapse
): AstSvgRenderData {
  if (!astNode) {
    return { nodes: [], connectors: [], canvasWidth: 0, canvasHeight: 0, error: "No AST node provided." };
  }

  const ctx = initializeLayoutContext(highlightedRedexId, customExpressions, predefinedExpressions);

  try {
    layoutNodeRecursive(astNode, ctx, 0, 0); 

    ctx.svgConnectors.forEach(connector => {
      const fromNode = ctx.svgNodes.find(n => n.svgId === connector.fromSvgId);
      const toNode = ctx.svgNodes.find(n => n.svgId === connector.toSvgId);
      if (fromNode && toNode) {
        const startX = fromNode.x + fromNode.width / 2;
        const startY = fromNode.y + fromNode.height; 
        const endX = toNode.x + toNode.width / 2;
        const endY = toNode.y; 
        connector.pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
        
        ctx.minXOverall = Math.min(ctx.minXOverall, startX, endX);
        ctx.maxXOverall = Math.max(ctx.maxXOverall, startX, endX);
        ctx.minYOverall = Math.min(ctx.minYOverall, startY, endY);
        ctx.maxYOverall = Math.max(ctx.maxYOverall, startY, endY);
      } else {
        connector.pathD = "M 0 0 L 0 0"; 
      }
    });
    
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
  originalAstId: string, // ASTNodeId is string
  sourcePrimitiveForColoring?: string
): AstSvgRenderData {
  const svgId = generateSvgNodeId('summary');
  const nodeOwnWidth = Math.max(MIN_NODE_WIDTH, name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING + 10); // Ensure enough padding for text
  const nodeOwnHeight = NODE_HEIGHT;

  const summaryNode: SvgAstNode = {
    id: originalAstId,
    svgId,
    type: 'variable', // Represent summary node as a variable type for styling consistency
    name: name,       // The prettified name to display
    x: INITIAL_PADDING,
    y: INITIAL_PADDING,
    width: nodeOwnWidth,
    height: nodeOwnHeight,
    isHighlighted: false, // Global summary nodes are not typically part of a step-by-step redex
    sourcePrimitiveName: sourcePrimitiveForColoring || name, // Tag for coloring
  };

  return {
    nodes: [summaryNode],
    connectors: [],
    canvasWidth: nodeOwnWidth + 2 * INITIAL_PADDING,
    canvasHeight: nodeOwnHeight + 2 * INITIAL_PADDING,
  };
}
