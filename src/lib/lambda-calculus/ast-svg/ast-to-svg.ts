
import type { ASTNode, Variable, Lambda, Application, ASTNodeId } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector, SvgVariableNode, SvgLambdaNode, SvgApplicationNode } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';
import { prettifyAST } from '../prettifier';
import { print } from '../printer';
import type { NamedExpression } from '../predefined';


// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30;
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 25; 
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
  customExpressions: NamedExpression[];
  predefinedExpressions: NamedExpression[];
  expandedSubtreeNodeIds: Set<ASTNodeId>;
}

function initializeLayoutContext(
  highlightedRedexId?: string,
  customExpressions: NamedExpression[] = [],
  predefinedExpressions: NamedExpression[] = [],
  expandedSubtreeNodeIds: Set<ASTNodeId> = new Set()
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
    expandedSubtreeNodeIds,
  };
}

interface ProcessedSubtree {
  centerX: number; 
  y: number;       
  width: number;   
  height: number;  
  svgId: string;   
}

function updateOverallBounds(ctx: LayoutContext, nodeX: number, nodeY: number, nodeWidth: number, nodeHeight: number) {
    ctx.minXOverall = Math.min(ctx.minXOverall, nodeX);
    ctx.maxXOverall = Math.max(ctx.maxXOverall, nodeX + nodeWidth);
    ctx.minYOverall = Math.min(ctx.minYOverall, nodeY);
    ctx.maxYOverall = Math.max(ctx.maxYOverall, nodeY + nodeHeight);
}


function layoutNodeRecursive(
  astNode: ASTNode,
  ctx: LayoutContext,
  currentX: number, 
  currentY: number  
): ProcessedSubtree {
  const svgId = generateSvgNodeId(astNode.type + (astNode.id || ''));
  const isHighlighted = astNode.id === ctx.highlightedRedexId || astNode.isRedex;
  let nodeOwnWidth: number;
  const nodeOwnHeight = NODE_HEIGHT;
  let createdNode: SvgAstNode;

  const prettyName = prettifyAST(astNode, ctx.customExpressions, ctx.predefinedExpressions);
  const canonicalPrintVal = print(astNode);
  // A node is significantly collapsible if its pretty name is a single underscore-prefixed term
  // AND this pretty name is different from its full canonical print.
  const isSignificantSubtreeCollapse = prettyName !== canonicalPrintVal && !prettyName.includes(" ") && prettyName.startsWith('_');

  let subtreeWidth: number;
  let subtreeHeight: number;
  let subtreeCenterXRel: number; // Center X of this node's symbol, relative to currentX

  const childY = currentY + nodeOwnHeight + VERTICAL_SPACING;

  if (isSignificantSubtreeCollapse && !ctx.expandedSubtreeNodeIds.has(astNode.id)) {
    // Render as a single collapsed box
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, prettyName.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);
    createdNode = {
      id: astNode.id, svgId, type: 'variable', // Treat as var for simplicity of text
      name: prettyName,
      x: currentX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, 
      sourcePrimitiveName: prettyName, // Use prettyName for coloring the collapsed box
      isGreedilyCollapsible: true,
    };
    ctx.svgNodes.push(createdNode);
    updateOverallBounds(ctx, createdNode.x, createdNode.y, createdNode.width, createdNode.height);
    
    return {
      centerX: nodeOwnWidth / 2, 
      y: currentY,
      width: nodeOwnWidth,
      height: nodeOwnHeight,
      svgId: svgId,
    };
  } else { // Render full node and recurse if applicable
      let actualNodeX = currentX; // Default for variable

      switch (astNode.type) {
        case 'variable':
          const varNode = astNode as Variable;
          nodeOwnWidth = Math.max(MIN_NODE_WIDTH, varNode.name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);
          createdNode = {
            id: astNode.id, svgId, type: 'variable', name: varNode.name,
            x: actualNodeX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
            isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName,
            isGreedilyCollapsible: isSignificantSubtreeCollapse, // It could have been collapsible but is expanded
          };
          subtreeWidth = nodeOwnWidth;
          subtreeHeight = nodeOwnHeight;
          subtreeCenterXRel = actualNodeX - currentX + nodeOwnWidth / 2;
          break;
        case 'lambda':
          const lambdaNode = astNode as Lambda;
          const textContent = `λ${lambdaNode.param}.`;
          nodeOwnWidth = Math.max(MIN_NODE_WIDTH, textContent.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

          // Layout body starting at currentX, body will be centered under lambda later
          const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, currentX, childY);
          
          // Center lambda symbol above the body's actual width and relative center
          actualNodeX = currentX + bodyLayout.centerX - (nodeOwnWidth / 2);

          createdNode = {
            id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
            x: actualNodeX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
            isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName,
            isGreedilyCollapsible: isSignificantSubtreeCollapse,
          };

          ctx.svgConnectors.push({
            id: generateSvgNodeId('connector-lambda-body'),
            fromSvgId: svgId, toSvgId: bodyLayout.svgId, pathD: '',
            isHighlighted: isHighlighted && (astNode.body.isRedex || astNode.body.id === ctx.highlightedRedexId),
          });
          
          subtreeWidth = Math.max(nodeOwnWidth, bodyLayout.width);
          subtreeHeight = (childY + bodyLayout.height) - currentY; 
          subtreeCenterXRel = actualNodeX - currentX + nodeOwnWidth / 2;
          break;
        case 'application':
          const appNode = astNode as Application;
          nodeOwnWidth = Math.max(MIN_NODE_WIDTH, ('@').length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

          const funcLayout = layoutNodeRecursive(appNode.func, ctx, currentX, childY);
          const argStartX = currentX + funcLayout.width + HORIZONTAL_SPACING;
          const argLayout = layoutNodeRecursive(appNode.arg, ctx, argStartX, childY);
          
          const childrenTotalWidth = (argStartX - currentX) + argLayout.width; // Total width from start of func to end of arg
          actualNodeX = currentX + (childrenTotalWidth / 2) - (nodeOwnWidth / 2); // Center app symbol over combined children

          createdNode = {
            id: astNode.id, svgId, type: 'application',
            x: actualNodeX, y: currentY, width: nodeOwnWidth, height: nodeOwnHeight,
            isHighlighted, 
            sourcePrimitiveName: astNode.sourcePrimitiveName, // Use original AST node's source for coloring the @
            isGreedilyCollapsible: isSignificantSubtreeCollapse, // Explicitly false if this branch is taken
          };

          ctx.svgConnectors.push({
            id: generateSvgNodeId('connector-func'), fromSvgId: svgId, toSvgId: funcLayout.svgId, pathD: '',
            isHighlighted: isHighlighted && (astNode.func.isRedex || astNode.func.id === ctx.highlightedRedexId),
          });
          ctx.svgConnectors.push({
            id: generateSvgNodeId('connector-arg'), fromSvgId: svgId, toSvgId: argLayout.svgId, pathD: '',
            isHighlighted: isHighlighted && (astNode.arg.isRedex || astNode.arg.id === ctx.highlightedRedexId),
          });
          
          subtreeWidth = childrenTotalWidth;
          subtreeHeight = (childY + Math.max(funcLayout.height, argLayout.height)) - currentY;
          subtreeCenterXRel = actualNodeX - currentX + nodeOwnWidth / 2;
          break;
        default:
            throw new Error("Unknown ASTNode type in layoutNodeRecursive");
      }

      ctx.svgNodes.push(createdNode);
      updateOverallBounds(ctx, createdNode.x, createdNode.y, createdNode.width, createdNode.height);

      return {
        centerX: subtreeCenterXRel,
        y: currentY, 
        width: subtreeWidth,
        height: subtreeHeight,
        svgId: svgId,
      };
  }
}

export function generateAstSvgData(
  astNode: ASTNode | null,
  highlightedRedexId?: string,
  customExpressions: NamedExpression[] = [],
  predefinedExpressions: NamedExpression[] = [],
  expandedSubtreeNodeIds: Set<ASTNodeId> = new Set()
): AstSvgRenderData {
  if (!astNode) {
    return { nodes: [], connectors: [], canvasWidth: 0, canvasHeight: 0, error: "No AST node provided." };
  }

  const ctx = initializeLayoutContext(highlightedRedexId, customExpressions, predefinedExpressions, expandedSubtreeNodeIds);

  try {
    layoutNodeRecursive(astNode, ctx, 0, 0); 

    // Defer path calculation until all nodes have their final relative positions
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
        connector.pathD = "M 0 0 L 0 0"; 
        console.warn("Orphaned connector:", connector.id, "From:", connector.fromSvgId, "To:", connector.toSvgId);
      }
    });

    let shiftX = INITIAL_PADDING;
    let shiftY = INITIAL_PADDING;

    if (ctx.svgNodes.length > 0 && ctx.minXOverall !== Infinity && ctx.minYOverall !== Infinity) {
        shiftX = -ctx.minXOverall + INITIAL_PADDING;
        shiftY = -ctx.minYOverall + INITIAL_PADDING;

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
      canvasWidth: Math.max(MIN_NODE_WIDTH + 2*INITIAL_PADDING, finalCanvasWidth), 
      canvasHeight: Math.max(NODE_HEIGHT + 2*INITIAL_PADDING, finalCanvasHeight), 
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
  originalAstId: string,
  sourcePrimitiveForColoring?: string
): AstSvgRenderData {
  const svgId = generateSvgNodeId('summary' + name);
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
    isGreedilyCollapsible: true, 
  };

  return {
    nodes: [summaryNode],
    connectors: [],
    canvasWidth: nodeOwnWidth + 2 * INITIAL_PADDING,
    canvasHeight: nodeOwnHeight + 2 * INITIAL_PADDING,
  };
}
