
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
  highlightedRedexId?: ASTNodeId 
): DrawTermResult {
  const effectivePrimitiveName = term.sourcePrimitiveName || parentPrimitiveName;
  const isCurrentTermRedex = term.id === highlightedRedexId;

  if (term.type === 'variable') {
    const varNode = term as Variable;
    const varName = varNode.name;
    const bindingInfo = lambdaLinks.get(varName);

    if (bindingInfo === undefined) {
      const varLinePrimitiveName = term.sourcePrimitiveName || effectivePrimitiveName; 
      if (toLeave === null) {
        grid.drawv(currentRow - 0.5, currentRow, currentCol, varLinePrimitiveName, isCurrentTermRedex);
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
        grid.drawv(bindingInfo.row, currentRow, currentCol, varLinePrimitiveName, isCurrentTermRedex);
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

    const leftResult = drawNodeRecursive(appNode.func, grid, lambdaLinks, 'R', currentRow, currentCol, effectivePrimitiveName, highlightedRedexId);
    const rightResult = drawNodeRecursive(appNode.arg, grid, lambdaLinks, 'L', currentRow, leftResult.dimensions.col, effectivePrimitiveName, highlightedRedexId);

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
    
    // The application's U-bar is highlighted if this application node is the redex
    const highlightAppConnector = isCurrentTermRedex;

    if (toLeave === 'L') {
      grid.drawbl(r_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, effectivePrimitiveName, highlightAppConnector);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: l_over_r, col: l_over_c, sourcePrimitiveName: leftResult.leftoverConnection.sourcePrimitiveName },
      };
    } else if (toLeave === 'R') {
      grid.drawfl(l_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, effectivePrimitiveName, highlightAppConnector);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: r_over_r, col: r_over_c, sourcePrimitiveName: rightResult.leftoverConnection.sourcePrimitiveName },
      };
    } else { 
      grid.drawu(l_over_r, bottomRowForHorizontalConnection, r_over_r, l_over_c, r_over_c, effectivePrimitiveName, highlightAppConnector);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: undefined,
      };
    }
  } else if (term.type === 'lambda') {
    const lambdaNode = term as Lambda;
    const varName = lambdaNode.param;
    const oldBindingInfo = lambdaLinks.get(varName);

    lambdaLinks.set(varName, {row: currentRow, sourcePrimitiveName: effectivePrimitiveName});

    const bodyResult = drawNodeRecursive(
      lambdaNode.body,
      grid,
      lambdaLinks,
      toLeave,
      currentRow + 1,
      currentCol,
      effectivePrimitiveName,
      highlightedRedexId
    );

    if (oldBindingInfo !== undefined) {
      lambdaLinks.set(varName, oldBindingInfo);
    } else {
      lambdaLinks.delete(varName);
    }
    
    // Lambda bar is highlighted if this lambda is part of the redex (e.g. the function part of an application redex)
    // This exact logic might need refinement if we want to distinguish lambda itself vs. it being part of a redex application.
    // For now, let's assume if the lambda's term ID is highlighted, its bar is too.
    const highlightLambdaBar = isCurrentTermRedex; 
    grid.drawl(currentRow, currentCol, bodyResult.dimensions.col - 1, varName, effectivePrimitiveName, highlightLambdaBar);

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
  const dimResult = drawNodeRecursive(term, nullGrid, firstPassLambdaLinks, null, 0, 0, term.sourcePrimitiveName, highlightedRedexId);

  if (dimResult.leftoverConnection && term.type !== 'variable') { 
     console.warn("Tromp Diagram: Top-level expression (not a var) returned a leftover connection.", term, dimResult.leftoverConnection);
  }

  const gridHeight = Math.max(1, dimResult.dimensions.row);
  const gridWidth = Math.max(1, dimResult.dimensions.col);

  const svgGrid = new SvgCollectingGrid(scale);
  const secondPassLambdaLinks: LambdaLinksMap = new Map(initialLambdaLinks);
  drawNodeRecursive(term, svgGrid, secondPassLambdaLinks, null, 0, 0, term.sourcePrimitiveName, highlightedRedexId);

  return {
    svgElements: svgGrid.svgElements,
    widthInGridUnits: gridWidth,
    heightInGridUnits: gridHeight,
    actualWidthPx: gridWidth * scale,
    actualHeightPx: gridHeight * scale,
    viewBox: `0 0 ${gridWidth} ${gridHeight}`,
  };
}
