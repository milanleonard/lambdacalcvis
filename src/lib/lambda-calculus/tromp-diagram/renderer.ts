
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { Grid, DrawTermResult, LambdaLinksMap, SvgElementData } from './tromp-types';
import { NullGrid, SvgCollectingGrid } from './grid';

function drawNodeRecursive(
  term: ASTNode,
  grid: Grid,
  lambdaLinks: LambdaLinksMap, 
  toLeave: 'L' | 'R' | null, 
  currentRow: number, 
  currentCol: number  
): DrawTermResult {
  if (term.type === 'variable') {
    const varNode = term as Variable;
    const varName = varNode.name;
    const bindingInfo = lambdaLinks.get(varName);

    if (bindingInfo === undefined) {
      throw new Error(`Tromp Diagram: Variable '${varName}' not found in lambdaLinks. Ensure it's a closed term or handled.`);
    }
    
    const varPrimitiveName = bindingInfo.sourcePrimitiveName; // Get tag from where it was bound

    if (toLeave === null) { 
        grid.drawv(bindingInfo.row, currentRow, currentCol, varPrimitiveName);
        return {
            dimensions: { row: currentRow + 1, col: currentCol + 1 },
            leftoverConnection: undefined,
        };
    } else { 
        return {
            dimensions: { row: currentRow, col: currentCol + 1 }, 
            leftoverConnection: { row: bindingInfo.row, col: currentCol, sourcePrimitiveName: varPrimitiveName },
        };
    }
  } else if (term.type === 'application') {
    const appNode = term as Application;
    
    const leftResult = drawNodeRecursive(appNode.func, grid, lambdaLinks, 'R', currentRow, currentCol);
    const rightResult = drawNodeRecursive(appNode.arg, grid, lambdaLinks, 'L', currentRow, leftResult.dimensions.col);

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
    
    // Applications themselves are structural; their primitive name is less direct.
    // We use the primitive name from the function part for 'R' and argument part for 'L' if leaving.
    // For 'U', it's harder to assign a single primitive. For now, don't pass specific primitive name to drawu/fl/bl.
    // The individual variable lines within would inherit colors from their bindings.
    const appPrimitiveName = appNode.sourcePrimitiveName; // This is often undefined for applications.

    if (toLeave === 'L') {
      grid.drawbl(r_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, appPrimitiveName);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: l_over_r, col: l_over_c, sourcePrimitiveName: leftResult.leftoverConnection.sourcePrimitiveName },
      };
    } else if (toLeave === 'R') {
      grid.drawfl(l_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c, appPrimitiveName);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: r_over_r, col: r_over_c, sourcePrimitiveName: rightResult.leftoverConnection.sourcePrimitiveName },
      };
    } else { 
      grid.drawu(l_over_r, bottomRowForHorizontalConnection, r_over_r, l_over_c, r_over_c, appPrimitiveName);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: undefined,
      };
    }
  } else if (term.type === 'lambda') {
    const lambdaNode = term as Lambda;
    const varName = lambdaNode.param;
    const oldBindingInfo = lambdaLinks.get(varName); 

    // Store current row and the lambda's own primitive tag (if any) for its binding
    lambdaLinks.set(varName, {row: currentRow, sourcePrimitiveName: lambdaNode.sourcePrimitiveName}); 

    const bodyResult = drawNodeRecursive(
      lambdaNode.body,
      grid,
      lambdaLinks,
      toLeave, 
      currentRow + 1, 
      currentCol 
    );

    if (oldBindingInfo !== undefined) {
      lambdaLinks.set(varName, oldBindingInfo); // Restore old binding for this name (shadowing)
    } else {
      lambdaLinks.delete(varName); // Clean up if this was the first time binding this name
    }
    
    // Pass the lambda's own sourcePrimitiveName for its bar
    grid.drawl(currentRow, currentCol, bodyResult.dimensions.col - 1, varName, lambdaNode.sourcePrimitiveName);

    // The leftover connection's primitive source comes from the body's evaluation
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
  const dimResult = drawNodeRecursive(term, nullGrid, firstPassLambdaLinks, null, 0, 0);
  
  if (dimResult.leftoverConnection) {
     console.warn("Tromp Diagram: Top-level expression returned a leftover connection.", term, dimResult.leftoverConnection);
  }

  const gridHeight = Math.max(1, dimResult.dimensions.row);
  const gridWidth = Math.max(1, dimResult.dimensions.col);

  const svgGrid = new SvgCollectingGrid(scale);
  const secondPassLambdaLinks: LambdaLinksMap = new Map(initialLambdaLinks);
  drawNodeRecursive(term, svgGrid, secondPassLambdaLinks, null, 0, 0);
  
  return {
    svgElements: svgGrid.svgElements,
    widthInGridUnits: gridWidth, 
    heightInGridUnits: gridHeight,
    actualWidthPx: gridWidth * scale,
    actualHeightPx: gridHeight * scale,
    viewBox: `0 0 ${gridWidth} ${gridHeight}`,
  };
}
