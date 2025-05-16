import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';

// --- Configuration Constants for Layout ---
const NODE_WIDTH = 80; // Base width for a node box
const NODE_HEIGHT = 40; // Base height for a node box
const HORIZONTAL_SPACING = 20; // Horizontal space between sibling nodes or parent-child if horizontal
const VERTICAL_SPACING = 50;   // Vertical space between parent and child
const LAMBDA_PARAM_WIDTH = 30; // Extra width for lambda param display
const TEXT_PADDING = 5; // Padding around text inside nodes

interface LayoutContext {
  svgNodes: SvgAstNode[];
  svgConnectors: SvgConnector[];
  currentX: number;
  currentY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  highlightedRedexId?: string;
}

function initializeLayoutContext(highlightedRedexId?: string): LayoutContext {
  return {
    svgNodes: [],
    svgConnectors: [],
    currentX: 0,
    currentY: 0,
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    highlightedRedexId,
  };
}

// Recursive function to layout AST and create SVG data
// This is a very simplified initial layout. It will need significant refinement.
function layoutNode(
  astNode: ASTNode,
  ctx: LayoutContext,
  x: number,
  y: number,
  parentSvgId?: string
): { width: number; height: number; nodeCenterX: number; svgId: string } {
  const svgId = generateSvgNodeId(astNode.type);
  let nodeWidth = NODE_WIDTH;
  const nodeHeight = NODE_HEIGHT;
  let nodeText = "";
  const isHighlighted = astNode.id === ctx.highlightedRedexId || astNode.isRedex;

  // Update canvas bounds
  ctx.minX = Math.min(ctx.minX, x);
  ctx.minY = Math.min(ctx.minY, y);
  ctx.maxX = Math.max(ctx.maxX, x + nodeWidth); // Initial width, might expand
  ctx.maxY = Math.max(ctx.maxY, y + nodeHeight);


  let createdNode: SvgAstNode;

  switch (astNode.type) {
    case 'variable':
      nodeText = astNode.name;
      // Estimate width based on text length
      nodeWidth = Math.max(NODE_WIDTH / 2, nodeText.length * 8 + 2 * TEXT_PADDING); 
      createdNode = {
        id: astNode.id,
        svgId,
        type: 'variable',
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        name: astNode.name,
        sourcePrimitiveName: astNode.sourcePrimitiveName,
        isHighlighted,
      };
      ctx.svgNodes.push(createdNode);
      ctx.maxX = Math.max(ctx.maxX, x + nodeWidth);
      return { width: nodeWidth, height: nodeHeight, nodeCenterX: x + nodeWidth / 2, svgId };

    case 'lambda':
      nodeText = `λ${astNode.param}.`;
      nodeWidth = Math.max(NODE_WIDTH, nodeText.length * 8 + LAMBDA_PARAM_WIDTH + 2 * TEXT_PADDING);
      
      createdNode = {
        id: astNode.id,
        svgId,
        type: 'lambda',
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        param: astNode.param,
        sourcePrimitiveName: astNode.sourcePrimitiveName,
        isHighlighted,
      };
      ctx.svgNodes.push(createdNode);
      ctx.maxX = Math.max(ctx.maxX, x + nodeWidth);

      const bodyLayout = layoutNode(astNode.body, ctx, x + (nodeWidth - NODE_WIDTH)/2 , y + nodeHeight + VERTICAL_SPACING, svgId);
      
      ctx.svgConnectors.push({
        id: generateSvgNodeId('connector'),
        fromSvgId: svgId,
        toSvgId: bodyLayout.svgId,
        pathD: `M ${x + nodeWidth / 2} ${y + nodeHeight} L ${bodyLayout.nodeCenterX} ${y + nodeHeight + VERTICAL_SPACING}`,
        isHighlighted: isHighlighted && astNode.body.isRedex,
      });
      
      // Adjust overall width based on children
      const requiredWidthForBody = bodyLayout.width;
      const centeredBodyXOffset = (nodeWidth - requiredWidthForBody) / 2;
      // This part is tricky, the body X was relative to its own layout call.
      // We need to ensure the parent lambda node is wide enough.
      // For now, the lambda node width is fixed after text estimation. Body layout is below.
      // The actual width of this subtree is max(nodeWidth, bodyLayout.width centered)
      // This simplified layout puts body directly below. Subtree width is max(current node's width, body's width).
      const subtreeWidth = Math.max(nodeWidth, bodyLayout.width);
      ctx.maxX = Math.max(ctx.maxX, x + subtreeWidth);


      return { width: subtreeWidth, height: nodeHeight + VERTICAL_SPACING + bodyLayout.height, nodeCenterX: x + nodeWidth / 2, svgId };

    case 'application':
      createdNode = {
        id: astNode.id,
        svgId,
        type: 'application',
        x,
        y,
        width: nodeWidth, // Application node itself is a small box
        height: nodeHeight,
        sourcePrimitiveName: astNode.sourcePrimitiveName,
        isHighlighted,
      };
      ctx.svgNodes.push(createdNode);

      // Layout children side-by-side below the application node
      const funcLayout = layoutNode(astNode.func, ctx, x - NODE_WIDTH / 2 - HORIZONTAL_SPACING / 2, y + nodeHeight + VERTICAL_SPACING, svgId);
      const argLayout = layoutNode(astNode.arg, ctx, x + NODE_WIDTH / 2 + HORIZONTAL_SPACING / 2, y + nodeHeight + VERTICAL_SPACING, svgId);
      
      // Adjust parent application node position to be centered above its children
      const childrenTotalWidth = funcLayout.width + HORIZONTAL_SPACING + argLayout.width;
      const appNodeCenterX = x + nodeWidth / 2; // Target center for the app node
      
      // Reposition children if we were to center the app node (This gets complex quickly)
      // For simplicity now, children are laid out relative to initial x.
      // We update the application node's x based on where children landed if needed for centering,
      // OR we make the application node itself wider. Let's try to adjust children positions based on parent.
      // The "x" for func should be appNodeCenterX - childrenTotalWidth/2
      // The "x" for arg should be appNodeCenterX - childrenTotalWidth/2 + funcLayout.width + HORIZONTAL_SPACING

      // Re-layouting children for centering can be complicated in a single pass.
      // A simpler first approach: parent 'app' node is small, children are below it.
      // Connectors go from center of app node to top-center of children.

      ctx.svgConnectors.push({
        id: generateSvgNodeId('connector-func'),
        fromSvgId: svgId,
        toSvgId: funcLayout.svgId,
        pathD: `M ${x + nodeWidth / 2} ${y + nodeHeight} L ${funcLayout.nodeCenterX} ${y + nodeHeight + VERTICAL_SPACING}`,
        isHighlighted: isHighlighted && astNode.func.isRedex,
      });
      ctx.svgConnectors.push({
        id: generateSvgNodeId('connector-arg'),
        fromSvgId: svgId,
        toSvgId: argLayout.svgId,
        pathD: `M ${x + nodeWidth / 2} ${y + nodeHeight} L ${argLayout.nodeCenterX} ${y + nodeHeight + VERTICAL_SPACING}`,
        isHighlighted: isHighlighted && astNode.arg.isRedex,
      });
      
      const subtreeTotalWidth = funcLayout.width + argLayout.width + HORIZONTAL_SPACING;
      ctx.maxX = Math.max(ctx.maxX, (x - NODE_WIDTH/2 - HORIZONTAL_SPACING/2) + subtreeTotalWidth); // Max extent of children

      return { 
        width: subtreeTotalWidth, 
        height: nodeHeight + VERTICAL_SPACING + Math.max(funcLayout.height, argLayout.height),
        nodeCenterX: x + nodeWidth / 2,
        svgId
      };
  }
}


export function generateAstSvgData(
  astNode: ASTNode | null,
  highlightedRedexId?: string
): AstSvgRenderData {
  if (!astNode) {
    return { nodes: [], connectors: [], canvasWidth: 0, canvasHeight: 0 };
  }

  const ctx = initializeLayoutContext(highlightedRedexId);
  
  try {
    // Initial call to layoutNode places the root at (0,0) for now.
    // We will adjust all coordinates later based on minX, minY.
    layoutNode(astNode, ctx, 50, 50); // Start with some padding

    // Normalize coordinates to be positive and add padding
    const padding = 20;
    let canvasWidth = 0;
    let canvasHeight = 0;

    if (ctx.svgNodes.length > 0) {
        const finalNodes: SvgAstNode[] = [];
        for (const node of ctx.svgNodes) {
            finalNodes.push({
                ...node,
                x: node.x - ctx.minX + padding,
                y: node.y - ctx.minY + padding,
            });
        }
        ctx.svgNodes = finalNodes;

        const finalConnectors: SvgConnector[] = [];
        for (const connector of ctx.svgConnectors) {
            // This assumes pathD uses absolute coordinates that also need shifting.
            // A more robust way would be to parse pathD or store relative points.
            // For simple M x y L x y, we can shift.
            const pathParts = connector.pathD.split(' ');
            let newPathD = "";
            for(let i=0; i<pathParts.length; i++) {
                if (pathParts[i] === 'M' || pathParts[i] === 'L' || pathParts[i] === 'C' || pathParts[i] === 'Q' ) { // Add other commands if used
                    newPathD += pathParts[i] + " ";
                    const xVal = parseFloat(pathParts[++i]) - ctx.minX + padding;
                    const yVal = parseFloat(pathParts[++i]) - ctx.minX + padding; // ERROR: should be ctx.minY
                    newPathD += `${xVal} ${yVal} `;
                } else {
                     // For bezier curve control points etc. This naive shift won't work well.
                    // newPathD += pathParts[i] + " ";
                }
            }
            // TEMPORARY FIX FOR PATH PARSING: Path parsing and re-writing is complex.
            // For now, let's assume path coordinates in connectors are relative or handled by the rendering side.
            // Or, even better, store from/to node centers and let renderer draw lines.
            // For the current M x y L x y:
            const [m, mx, my, l, lx, ly] = connector.pathD.split(/[ ,ML]/).filter(Boolean).map(s => parseFloat(s));
            const shiftedPathD = `M ${mx - ctx.minX + padding} ${my - ctx.minY + padding} L ${lx - ctx.minX + padding} ${ly - ctx.minY + padding}`;

            finalConnectors.push({
                ...connector,
                pathD: shiftedPathD,
            });
        }
        ctx.svgConnectors = finalConnectors;
        
        canvasWidth = ctx.maxX - ctx.minX + 2 * padding;
        canvasHeight = ctx.maxY - ctx.minY + 2 * padding;
    }


    return {
      nodes: ctx.svgNodes,
      connectors: ctx.svgConnectors,
      canvasWidth: Math.max(200, canvasWidth), // Minimum canvas size
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
