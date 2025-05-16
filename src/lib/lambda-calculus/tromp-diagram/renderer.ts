
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { Grid, DrawTermResult, LambdaLinksMap, SvgElementData } from './tromp-types';
import { NullGrid, SvgCollectingGrid } from './grid';

function drawNodeRecursive(
  term: ASTNode,
  grid: Grid,
  lambdaLinks: LambdaLinksMap,
  toLeave: 'L' | 'R' | null,
  currentRow: number,
  currentCol: number,
  parentPrimitiveName?: string // New parameter for context
): DrawTermResult {
  // Determine the effective primitive name for this node and its direct components
  const effectivePrimitiveName = term.sourcePrimitiveName || parentPrimitiveName;

  if (term.type === 'variable') {
    const varNode = term as Variable;
    const varName = varNode.name;
    const bindingInfo = lambdaLinks.get(varName);

    if (bindingInfo === undefined) {
      // This can happen for free variables if the term is not closed.
      // For visualization, we might draw them differently or just let it be.
      // The original Python code implies ll[self.name] would raise an error if name not in ll.
      // Let's assume closed terms for now, or handle free vars by giving them a default color/no line.
      // For this coloring scheme, if it's free, it doesn't have a "primitive" binder.
      // console.warn(`Tromp Diagram: Variable '${varName}' has no binding in lambdaLinks. It might be free.`);
      // Fallback: draw a short stub or indicate it's free if needed.
      // For now, let it attempt to draw from a hypothetical row 0 (might look odd or be off-screen)
      // or color based on its own tag if variables could be tagged (they currently aren't directly).
      const varLinePrimitiveName = term.sourcePrimitiveName || effectivePrimitiveName; // A variable itself might be a primitive `_X = x`

      if (toLeave === null) {
        grid.drawv(bindingInfo?.row ?? currentRow - 0.5, currentRow, currentCol, varLinePrimitiveName); // Draw from current if no binding
        return {
            dimensions: { row: currentRow + 1, col: currentCol + 1 },
            leftoverConnection: undefined,
        };
    } else {
        return {
            dimensions: { row: currentRow, col: currentCol + 1 },
            leftoverConnection: { row: bindingInfo?.row ?? currentRow -0.5, col: currentCol, sourcePrimitiveName: varLinePrimitiveName },
        };
    }
    }

    // The variable's line color should be determined by its binding's original primitive,
    // or if not available (e.g. free var or untagged binder), use the current effectivePrimitiveName.
    const varLinePrimitiveName = bindingInfo.sourcePrimitiveName || effectivePrimitiveName;

    if (toLeave === null) {
        grid.drawv(bindingInfo.row, currentRow, currentCol, varLinePrimitiveName);
        return {
            dimensions: { row: currentRow + 1, col: currentCol + 1 },
            leftoverConnection: undefined,
        };
    } else {
        return {
            dimensions: { row: currentRow, col: currentCol + 1 },
            // The leftover connection's tag is crucial for the variable itself.
            leftoverConnection: { row: bindingInfo.row, col: currentCol, sourcePrimitiveName: bindingInfo.sourcePrimitiveName || term.sourcePrimitiveName },
        };
    }
  } else if (term.type === 'application') {
    const appNode = term as Application;

    // Propagate the current block's effectivePrimitiveName to children.
    // If a child is a primitive itself, its term.sourcePrimitiveName will override this.
    const leftResult = drawNodeRecursive(appNode.func, grid, lambdaLinks, 'R', currentRow, currentCol, effectivePrimitiveName);
    const rightResult = drawNodeRecursive(appNode.arg, grid, lambdaLinks, 'L', currentRow, leftResult.dimensions.col, effectivePrimitiveName);

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

    // Use effectivePrimitiveName for the application's structural lines (its own connectors)
    if (toLeave === 'L') {
      grid.drawbl(r_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, effectivePrimitiveName);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        // Leftover's sourcePrimitiveName should come from the actual structure (leftResult for 'L')
        leftoverConnection: { row: l_over_r, col: l_over_c, sourcePrimitiveName: leftResult.leftoverConnection.sourcePrimitiveName },
      };
    } else if (toLeave === 'R') {
      grid.drawfl(l_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, effectivePrimitiveName);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: r_over_r, col: r_over_c, sourcePrimitiveName: rightResult.leftoverConnection.sourcePrimitiveName },
      };
    } else { // toLeave === null
      grid.drawu(l_over_r, bottomRowForHorizontalConnection, r_over_r, l_over_c, r_over_c, effectivePrimitiveName);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: undefined,
      };
    }
  } else if (term.type === 'lambda') {
    const lambdaNode = term as Lambda;
    const varName = lambdaNode.param;
    const oldBindingInfo = lambdaLinks.get(varName);

    // The binding info should carry this lambda's effectivePrimitiveName.
    lambdaLinks.set(varName, {row: currentRow, sourcePrimitiveName: effectivePrimitiveName});

    // Propagate this lambda's effectivePrimitiveName as the parent context for its body.
    const bodyResult = drawNodeRecursive(
      lambdaNode.body,
      grid,
      lambdaLinks,
      toLeave,
      currentRow + 1,
      currentCol,
      effectivePrimitiveName
    );

    if (oldBindingInfo !== undefined) {
      lambdaLinks.set(varName, oldBindingInfo);
    } else {
      lambdaLinks.delete(varName);
    }

    // The lambda bar uses its own effectivePrimitiveName
    grid.drawl(currentRow, currentCol, bodyResult.dimensions.col - 1, varName, effectivePrimitiveName);

    // Leftover's sourcePrimitiveName comes from the body's result
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
  scale: number = 20
): TrompDiagramRenderData | null {
  if (!term) {
    return null;
  }

  const initialLambdaLinks: LambdaLinksMap = new Map();

  const nullGrid = new NullGrid();
  const firstPassLambdaLinks: LambdaLinksMap = new Map(initialLambdaLinks);
  // Pass term.sourcePrimitiveName as the initial parentPrimitiveName context
  const dimResult = drawNodeRecursive(term, nullGrid, firstPassLambdaLinks, null, 0, 0, term.sourcePrimitiveName);

  if (dimResult.leftoverConnection && term.type !== 'variable') { // A single variable term is expected to have a leftover
     console.warn("Tromp Diagram: Top-level expression (not a var) returned a leftover connection.", term, dimResult.leftoverConnection);
  }


  const gridHeight = Math.max(1, dimResult.dimensions.row);
  const gridWidth = Math.max(1, dimResult.dimensions.col);

  const svgGrid = new SvgCollectingGrid(scale);
  const secondPassLambdaLinks: LambdaLinksMap = new Map(initialLambdaLinks);
  // Pass term.sourcePrimitiveName as the initial parentPrimitiveName context for the actual drawing pass
  drawNodeRecursive(term, svgGrid, secondPassLambdaLinks, null, 0, 0, term.sourcePrimitiveName);

  return {
    svgElements: svgGrid.svgElements,
    widthInGridUnits: gridWidth,
    heightInGridUnits: gridHeight,
    actualWidthPx: gridWidth * scale,
    actualHeightPx: gridHeight * scale,
    viewBox: `0 0 ${gridWidth} ${gridHeight}`,
  };
}

