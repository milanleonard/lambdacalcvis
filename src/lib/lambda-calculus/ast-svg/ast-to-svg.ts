
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { AstSvgRenderData, SvgAstNode, SvgConnector } from './ast-svg-types';
import { generateSvgNodeId } from './ast-svg-types';

// --- Configuration Constants for Layout ---
const MIN_NODE_WIDTH = 30; // Minimum width for any node
const NODE_WIDTH = 50;     // Default width for fixed parts of lambda/app nodes
const NODE_HEIGHT = 40;
const HORIZONTAL_SPACING = 25; // Increased spacing
const VERTICAL_SPACING = 60;   // Increased spacing
const TEXT_PADDING = 5;
const CHAR_WIDTH_ESTIMATE = 8; // For estimating text width
const INITIAL_PADDING = 30;   // Padding around the entire drawing

interface LayoutContext {
  svgNodes: SvgAstNode[];
  svgConnectors: SvgConnector[];
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
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    highlightedRedexId,
  };
}

interface ProcessedSubtree {
  // The x-coordinate of the top-center of this node's box.
  centerX: number;
  // The y-coordinate of the top of this node's box.
  y: number;
  // Total width of the bounding box for this subtree.
  width: number;
  // Total height of the bounding box for this subtree.
  height: number;
  // The SVG ID of the root node of this subtree.
  svgId: string;
}

// Recursive function to layout AST and create SVG data
function layoutNodeRecursive(
  astNode: ASTNode,
  ctx: LayoutContext,
  // The Y coordinate for the top of this node's box
  targetY: number
): ProcessedSubtree {
  const svgId = generateSvgNodeId(astNode.type);
  const isHighlighted = astNode.id === ctx.highlightedRedexId || astNode.isRedex;
  let nodeOwnWidth: number;
  const nodeOwnHeight = NODE_HEIGHT;
  let createdNode: SvgAstNode;

  let subtreeCenterX: number;
  let subtreeTotalWidth: number;
  let subtreeTotalHeight = nodeOwnHeight;

  if (astNode.type === 'variable') {
    const varNode = astNode as Variable;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, varNode.name.length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);
    subtreeTotalWidth = nodeOwnWidth;
    // For a variable, centerX is just its own center. X position will be set by parent.
    // We'll assume an initial X of 0 for the node itself, to be adjusted.
    subtreeCenterX = 0 + nodeOwnWidth / 2; 

    createdNode = {
      id: astNode.id, svgId, type: 'variable', name: varNode.name,
      x: 0, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight, // x is temporary
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);

  } else if (astNode.type === 'lambda') {
    const lambdaNode = astNode as Lambda;
    nodeOwnWidth = Math.max(NODE_WIDTH, (`λ${lambdaNode.param}.`).length * CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING);

    const bodyLayout = layoutNodeRecursive(lambdaNode.body, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    
    subtreeTotalWidth = Math.max(nodeOwnWidth, bodyLayout.width);
    subtreeTotalHeight = nodeOwnHeight + VERTICAL_SPACING + bodyLayout.height;
    
    // Center lambda node over its body's width
    const lambdaNodeX = bodyLayout.centerX - (nodeOwnWidth / 2);
    // Update body's X position relative to this lambda node's final X
    const bodyNodeInCtx = ctx.svgNodes.find(n => n.svgId === bodyLayout.svgId);
    if(bodyNodeInCtx) { // Shift the entire body subtree
        const bodyShiftX = lambdaNodeX + (nodeOwnWidth - bodyLayout.width)/2 - bodyNodeInCtx.x ; // This calculation needs to be careful, bodyLayout.centerX is already centered in its width
                                                                                          // Let's position body centered under lambda.
                                                                                          // Body X should be: lambdaNodeX + (nodeOwnWidth/2) - (bodyLayout.width/2)
        const bodyTargetX = lambdaNodeX + (nodeOwnWidth / 2) - (bodyLayout.width / 2);
        shiftSubtree(ctx, bodyLayout.svgId, bodyTargetX - bodyNodeInCtx.x);
    }


    createdNode = {
      id: astNode.id, svgId, type: 'lambda', param: lambdaNode.param,
      x: lambdaNodeX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);
    subtreeCenterX = lambdaNodeX + nodeOwnWidth / 2;

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-lambda'),
      fromSvgId: svgId,
      toSvgId: bodyLayout.svgId,
      pathD: `M ${subtreeCenterX} ${targetY + nodeOwnHeight} L ${bodyLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && astNode.body.isRedex,
    });

  } else { // Application
    const appNode = astNode as Application;
    nodeOwnWidth = Math.max(MIN_NODE_WIDTH, CHAR_WIDTH_ESTIMATE + 2 * TEXT_PADDING); // For '@'

    const funcLayout = layoutNodeRecursive(appNode.func, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);
    const argLayout = layoutNodeRecursive(appNode.arg, ctx, targetY + nodeOwnHeight + VERTICAL_SPACING);

    subtreeTotalWidth = funcLayout.width + HORIZONTAL_SPACING + argLayout.width;
    subtreeTotalHeight = nodeOwnHeight + VERTICAL_SPACING + Math.max(funcLayout.height, argLayout.height);

    // Position func and arg relative to a common starting point (0 for now)
    // Func starts at 0
    // Arg starts after func and spacing
    const funcNodeInCtx = ctx.svgNodes.find(n => n.svgId === funcLayout.svgId);
    const argNodeInCtx = ctx.svgNodes.find(n => n.svgId === argLayout.svgId);

    let currentX = 0;
    if (funcNodeInCtx) {
        shiftSubtree(ctx, funcLayout.svgId, currentX - funcNodeInCtx.x);
    }
    currentX += funcLayout.width + HORIZONTAL_SPACING;
    if (argNodeInCtx) {
        shiftSubtree(ctx, argLayout.svgId, currentX - argNodeInCtx.x);
    }
    
    // Application node centered above the combined width of children
    const appNodeX = (funcLayout.width + HORIZONTAL_SPACING/2) - (nodeOwnWidth/2);

    createdNode = {
      id: astNode.id, svgId, type: 'application',
      x: appNodeX, y: targetY, width: nodeOwnWidth, height: nodeOwnHeight,
      isHighlighted, sourcePrimitiveName: astNode.sourcePrimitiveName
    };
    ctx.svgNodes.push(createdNode);
    subtreeCenterX = appNodeX + nodeOwnWidth / 2;

    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-func'),
      fromSvgId: svgId,
      toSvgId: funcLayout.svgId,
      pathD: `M ${subtreeCenterX} ${targetY + nodeOwnHeight} L ${funcLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && astNode.func.isRedex,
    });
    ctx.svgConnectors.push({
      id: generateSvgNodeId('connector-arg'),
      fromSvgId: svgId,
      toSvgId: argLayout.svgId,
      pathD: `M ${subtreeCenterX} ${targetY + nodeOwnHeight} L ${argLayout.centerX} ${targetY + nodeOwnHeight + VERTICAL_SPACING}`,
      isHighlighted: isHighlighted && astNode.arg.isRedex,
    });
  }
  
  // Update overall bounds tracking
  // Note: createdNode.x is still relative at this point if not a leaf.
  // The min/max tracking will be more accurate after the final shift.
  // For now, this provides a rough estimate.
  ctx.minX = Math.min(ctx.minX, createdNode.x);
  ctx.maxX = Math.max(ctx.maxX, createdNode.x + nodeOwnWidth);
  ctx.minY = Math.min(ctx.minY, createdNode.y);
  ctx.maxY = Math.max(ctx.maxY, createdNode.y + subtreeTotalHeight);


  return {
    centerX: subtreeCenterX, // Center X of this node, relative to its *final* position after its children are placed.
    y: targetY,
    width: subtreeTotalWidth,
    height: subtreeTotalHeight,
    svgId: svgId,
  };
}

// Helper function to shift an entire subtree (all its nodes and connectors) horizontally
function shiftSubtree(ctx: LayoutContext, rootSvgId: string, shiftX: number) {
  const nodesToShift: SvgAstNode[] = [];
  const q: string[] = [rootSvgId];
  const visited: Set<string> = new Set();

  while(q.length > 0) {
    const currentId = q.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = ctx.svgNodes.find(n => n.svgId === currentId);
    if (node) {
      nodesToShift.push(node);
      // Find children via connectors
      ctx.svgConnectors.forEach(c => {
        if (c.fromSvgId === currentId && !visited.has(c.toSvgId)) {
          q.push(c.toSvgId);
        }
      });
    }
  }

  nodesToShift.forEach(node => {
    node.x += shiftX;
  });

  // Shift connectors involving these nodes
  ctx.svgConnectors.forEach(connector => {
    const fromNodeShift = nodesToShift.find(n => n.svgId === connector.fromSvgId);
    const toNodeShift = nodesToShift.find(n => n.svgId === connector.toSvgId);

    if (fromNodeShift || toNodeShift) {
        const pathParts = connector.pathD.split(/[ ,ML]/).filter(Boolean).map(s => parseFloat(s));
        if (pathParts.length === 4) { // M x1 y1 L x2 y2
            let [mx, my, lx, ly] = pathParts;
            if (fromNodeShift) { // if fromNode is part of this subtree, its start point in path shifts
                 // Assuming path M is from fromNode's anchor
            }
             if (toNodeShift) { // if toNode is part of this subtree, its end point in path shifts
                // Assuming path L is to toNode's anchor
             }
            // This part is tricky because the path M points are center of parent, L point is center of child.
            // The `shiftSubtree` should be called *before* connectors are created, or connectors should be relative.
            // For now, let's assume this is called correctly and the main layout positions children relative to the parent,
            // and this shift is for global positioning.
            // The current `layoutNodeRecursive` structure already places nodes with some x,y.
            // This `shiftSubtree` function is to adjust groups of children.

            // A simpler connector update based on node centers after shifting:
            const fromNode = ctx.svgNodes.find(n => n.svgId === connector.fromSvgId);
            const toNode = ctx.svgNodes.find(n => n.svgId === connector.toSvgId);
            if (fromNode && toNode) {
                 connector.pathD = `M ${fromNode.x + fromNode.width / 2} ${fromNode.y + fromNode.height} L ${toNode.x + toNode.width / 2} ${toNode.y}`;
            }
        }
    }
  });
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
    // Perform layout. Nodes and connectors are added to ctx with preliminary coordinates.
    layoutNodeRecursive(astNode, ctx, INITIAL_PADDING);

    // Calculate actual min/max bounds from the placed nodes
    let currentMinX = Infinity;
    let currentMaxX = -Infinity;
    let currentMinY = Infinity;
    let currentMaxY = -Infinity;

    ctx.svgNodes.forEach(node => {
      currentMinX = Math.min(currentMinX, node.x);
      currentMaxX = Math.max(currentMaxX, node.x + node.width);
      currentMinY = Math.min(currentMinY, node.y);
      currentMaxY = Math.max(currentMaxY, node.y + node.height);
    });
    
    // Handle case where no nodes were generated (e.g. empty input that somehow passed guard)
    if (ctx.svgNodes.length === 0) {
        return { nodes: [], connectors: [], canvasWidth: INITIAL_PADDING * 2, canvasHeight: INITIAL_PADDING * 2 };
    }


    // Normalize all coordinates: shift so minX, minY become INITIAL_PADDING
    const offsetX = -currentMinX + INITIAL_PADDING;
    const offsetY = -currentMinY + INITIAL_PADDING;

    ctx.svgNodes.forEach(node => {
      node.x += offsetX;
      node.y += offsetY;
    });

    ctx.svgConnectors.forEach(connector => {
      // Path: "M x1 y1 L x2 y2"
      const parts = connector.pathD.match(/M\s*([-\d.]+)\s*([-\d.]+)\s*L\s*([-\d.]+)\s*([-\d.]+)/);
      if (parts && parts.length === 5) {
        const x1 = parseFloat(parts[1]) + offsetX;
        const y1 = parseFloat(parts[2]) + offsetY;
        const x2 = parseFloat(parts[3]) + offsetX;
        const y2 = parseFloat(parts[4]) + offsetY;
        connector.pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
      }
    });
    
    const canvasWidth = currentMaxX - currentMinX + 2 * INITIAL_PADDING;
    const canvasHeight = currentMaxY - currentMinY + 2 * INITIAL_PADDING;

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

    