
import type { ASTNode, Variable, Lambda, Application, ASTNodeId } from '@/lib/lambda-calculus/types';
import type { Grid, DrawTermResult, LambdaLinksMap, SvgElementData } from './tromp-types';
import { NullGrid, SvgCollectingGrid } from './grid';

function drawNodeRecursive(
  term: ASTNode,
  grid: Grid,
  lambdaLinks: LambdaLinksMap,
  toLeave: 'L' | 'R' | null,
  currentRow: number,
  currentCol: number,
  parentPrimitiveName?: string,
  highlightedRedexId?: ASTNodeId,
  isRedexArgumentPart?: boolean 
): DrawTermResult {
  const effectivePrimitiveName = term.sourcePrimitiveName || parentPrimitiveName;
  const isCurrentTermRedex = term.id === highlightedRedexId;

  if (term.type === 'variable') {
    const varNode = term as Variable;
    const varName = varNode.name;
    const bindingInfo = lambdaLinks.get(varName);
    // A variable node itself is secondarily highlighted if it's part of a redex argument AND it's not the main redex connector.
    const currentIsSecondaryHighlight = !!(isRedexArgumentPart && !isCurrentTermRedex);

    if (bindingInfo === undefined) {
      const varLinePrimitiveName = term.sourcePrimitiveName || effectivePrimitiveName; 
      if (toLeave === null) {
        grid.drawv(currentRow - 0.5, currentRow, currentCol, varLinePrimitiveName, isCurrentTermRedex, currentIsSecondaryHighlight);
        return {
            dimensions: { row: currentRow + 1, col: currentCol + 1 },
            leftoverConnection: undefined,
        };
    } else {
        return {
            dimensions: { row: currentRow, col: currentCol + 1 },
            leftoverConnection: { row: currentRow -0.5, col: currentCol, sourcePrimitiveName: varLinePrimitiveName },
        };
    }
    }

    const varLinePrimitiveName = bindingInfo.sourcePrimitiveName || term.sourcePrimitiveName || effectivePrimitiveName;

    if (toLeave === null) {
        grid.drawv(bindingInfo.row, currentRow, currentCol, varLinePrimitiveName, isCurrentTermRedex, currentIsSecondaryHighlight);
        return {
            dimensions: { row: currentRow + 1, col: currentCol + 1 },
            leftoverConnection: undefined,
        };
    } else {
        return {
            dimensions: { row: currentRow, col: currentCol + 1 },
            leftoverConnection: { row: bindingInfo.row, col: currentCol, sourcePrimitiveName: varLinePrimitiveName },
        };
    }
  } else if (term.type === 'application') {
    const appNode = term as Application;
    
    let funcIsRedexArg = !!isRedexArgumentPart; 
    let argIsRedexArg = !!isRedexArgumentPart;  
    let connectorIsHighlighted = false;
    // The connector itself is secondarily highlighted if its parent context is a redex argument,
    // AND this application node is NOT the main redex itself.
    let connectorIsSecondaryHighlighted = !!(isRedexArgumentPart && !isCurrentTermRedex);


    if (isCurrentTermRedex) { 
        connectorIsHighlighted = true; // This application's U-bar is the primary highlight.
        funcIsRedexArg = false;        // The function part is not considered an "argument part" of this redex.
        argIsRedexArg = true;          // The argument part *is* considered an "argument part" of this redex.
                                       // All its internal components will be drawn with isRedexArgumentPart=true.
        connectorIsSecondaryHighlighted = false; // Primary highlight overrides secondary for the U-bar.
    }

    const leftResult = drawNodeRecursive(appNode.func, grid, lambdaLinks, 'R', currentRow, currentCol, effectivePrimitiveName, highlightedRedexId, funcIsRedexArg);
    const rightResult = drawNodeRecursive(appNode.arg, grid, lambdaLinks, 'L', currentRow, leftResult.dimensions.col, effectivePrimitiveName, highlightedRedexId, argIsRedexArg);

    if (!leftResult.leftoverConnection || !rightResult.leftoverConnection) {
        throw new Error("Application children did not return leftover connections as expected.");
    }
    const l_over_r = leftResult.leftoverConnection.row;
    const l_over_c = leftResult.leftoverConnection.col;
    const r_over_r = rightResult.leftoverConnection.row;
    const r_over_c = rightResult.leftoverConnection.col;

    const contentMaxRow = Math.max(leftResult.dimensions.row, rightResult.dimensions.row);
    const bottomRowForHorizontalConnection = contentMaxRow;
    const finalCol = rightResult.dimensions.col;
    
    // The application connector (U-bar or L-shapes) uses connectorIsHighlighted and connectorIsSecondaryHighlighted.
    if (toLeave === 'L') {
      grid.drawbl(r_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, effectivePrimitiveName, connectorIsHighlighted, connectorIsSecondaryHighlighted);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: l_over_r, col: l_over_c, sourcePrimitiveName: leftResult.leftoverConnection.sourcePrimitiveName },
      };
    } else if (toLeave === 'R') {
      grid.drawfl(l_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, effectivePrimitiveName, connectorIsHighlighted, connectorIsSecondaryHighlighted);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: r_over_r, col: r_over_c, sourcePrimitiveName: rightResult.leftoverConnection.sourcePrimitiveName },
      };
    } else { 
      grid.drawu(l_over_r, bottomRowForHorizontalConnection, r_over_r, l_over_c, r_over_c, effectivePrimitiveName, connectorIsHighlighted, connectorIsSecondaryHighlighted);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: undefined,
      };
    }
  } else if (term.type === 'lambda') {
    const lambdaNode = term as Lambda;
    const varName = lambdaNode.param;
    const oldBindingInfo = lambdaLinks.get(varName);
    // A lambda node itself is secondarily highlighted if it's part of a redex argument AND not the main redex.
    const currentIsSecondaryHighlight = !!(isRedexArgumentPart && !isCurrentTermRedex);

    lambdaLinks.set(varName, {row: currentRow, sourcePrimitiveName: effectivePrimitiveName});

    // When recursing into the body, isRedexArgumentPart is propagated.
    // If this lambda is part of the argument of the main redex, its body is too.
    const bodyResult = drawNodeRecursive(
      lambdaNode.body,
      grid,
      lambdaLinks,
      toLeave,
      currentRow + 1,
      currentCol,
      effectivePrimitiveName,
      highlightedRedexId,
      isRedexArgumentPart 
    );

    if (oldBindingInfo !== undefined) {
      lambdaLinks.set(varName, oldBindingInfo);
    } else {
      lambdaLinks.delete(varName);
    }
    
    // The lambda bar is highlighted if this lambda IS the redex (less common for lambda to be a redex itself)
    // or secondarily highlighted if it's part of a redex argument.
    const lambdaBarIsPrimaryHighlight = isCurrentTermRedex; 
    grid.drawl(currentRow, currentCol, bodyResult.dimensions.col - 1, varName, effectivePrimitiveName, lambdaBarIsPrimaryHighlight, currentIsSecondaryHighlight);

    return {
      dimensions: { row: bodyResult.dimensions.row, col: bodyResult.dimensions.col },
      leftoverConnection: bodyResult.leftoverConnection,
    };
  }
  throw new Error(`Unknown ASTNode type: ${(term as any).type}`);
}


export interface TrompDiagramRenderData {
  svgElements: SvgElementData[];
  widthInGridUnits: number;
  heightInGridUnits: number;
  actualWidthPx: number;
  actualHeightPx: number;
  viewBox: string;
}

export function generateTrompDiagramData(
  term: ASTNode | null,
  scale: number = 20,
  highlightedRedexId?: ASTNodeId 
): TrompDiagramRenderData | null {
  if (!term) {
    return null;
  }

  const initialLambdaLinks: LambdaLinksMap = new Map();

  const nullGrid = new NullGrid();
  const firstPassLambdaLinks: LambdaLinksMap = new Map(initialLambdaLinks);
  // Initial call to drawNodeRecursive, isRedexArgumentPart is false.
  const dimResult = drawNodeRecursive(term, nullGrid, firstPassLambdaLinks, null, 0, 0, term.sourcePrimitiveName, highlightedRedexId, false);

  if (dimResult.leftoverConnection && term.type !== 'variable') { 
     console.warn("Tromp Diagram: Top-level expression (not a var) returned a leftover connection.", term, dimResult.leftoverConnection);
  }

  const gridHeight = Math.max(1, dimResult.dimensions.row);
  const gridWidth = Math.max(1, dimResult.dimensions.col);

  const svgGrid = new SvgCollectingGrid(scale);
  const secondPassLambdaLinks: LambdaLinksMap = new Map(initialLambdaLinks);
  // Initial call to drawNodeRecursive, isRedexArgumentPart is false for the top-level term.
  drawNodeRecursive(term, svgGrid, secondPassLambdaLinks, null, 0, 0, term.sourcePrimitiveName, highlightedRedexId, false);

  return {
    svgElements: svgGrid.svgElements,
    widthInGridUnits: gridWidth,
    heightInGridUnits: gridHeight,
    actualWidthPx: gridWidth * scale,
    actualHeightPx: gridHeight * scale,
    viewBox: `0 0 ${gridWidth} ${gridHeight}`,
  };
}

