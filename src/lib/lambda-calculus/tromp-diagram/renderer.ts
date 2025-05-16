
import type { ASTNode, Variable, Lambda, Application } from '@/lib/lambda-calculus/types';
import type { Grid, DrawTermResult, TrompPoint, SvgElementData } from './tromp-types';
import { NullGrid, SvgCollectingGrid } from './grid';

function drawNodeRecursive(
  term: ASTNode,
  grid: Grid,
  lambdaLinks: Map<string, number>, 
  toLeave: 'L' | 'R' | null, 
  currentRow: number, 
  currentCol: number  
): DrawTermResult {
  if (term.type === 'variable') {
    const varNode = term as Variable;
    const varName = varNode.name;
    const boundRow = lambdaLinks.get(varName);

    if (boundRow === undefined) {
      // In an exact port of pylambdac, this would be an error if varName is not in lambdaLinks.
      // This diagram type is best for closed terms or terms where free variables are handled externally.
      // For now, we'll throw to indicate this precondition.
      throw new Error(`Tromp Diagram: Variable '${varName}' not found in lambdaLinks. This diagram is typically for closed terms.`);
    }

    if (toLeave === null) { // Not part of a larger application's connection chain, or is the final part of one
        grid.drawv(boundRow, currentRow, currentCol);
        return {
            dimensions: { row: currentRow + 1, col: currentCol + 1 },
            leftoverConnection: undefined,
        };
    } else { // Leaving a connection for the parent application
        return {
            dimensions: { row: currentRow, col: currentCol + 1 }, // Variable itself doesn't advance row if leaving connection
            leftoverConnection: { row: boundRow, col: currentCol },
        };
    }
  } else if (term.type === 'application') {
    const appNode = term as Application;
    
    const leftResult = drawNodeRecursive(appNode.func, grid, lambdaLinks, 'R', currentRow, currentCol);
    
    // The `currentRow` for the right branch should be the same as the left branch's starting row.
    const rightResult = drawNodeRecursive(appNode.arg, grid, lambdaLinks, 'L', currentRow, leftResult.dimensions.col);

    if (!leftResult.leftoverConnection || !rightResult.leftoverConnection) {
        throw new Error("Application children did not return leftover connections as expected.");
    }
    const l_over_r = leftResult.leftoverConnection.row;
    const l_over_c = leftResult.leftoverConnection.col;
    const r_over_r = rightResult.leftoverConnection.row;
    const r_over_c = rightResult.leftoverConnection.col;

    // bottomRow is the maximum row reached by either branch *before* adding the connection shapes.
    // The Python code has `bot = max(l_r, r_r)`. `l_r` and `r_r` are the `ro` for the *next* term if drawn sequentially.
    // Here, `leftResult.dimensions.row` and `rightResult.dimensions.row` are the "next available row index".
    // So, the max of these indicates the lowest point reached by the content of either branch.
    const contentMaxRow = Math.max(leftResult.dimensions.row, rightResult.dimensions.row);
    
    // The connection lines are drawn *up to* `bottomRowForConnectionDrawing`.
    // In python `Apply.draw`, `l_r` and `r_r` are the *next available row* from children.
    // `bot` is `max(l_r, r_r)`. This `bot` is used as `rend` for `drawfl/bl/u`.
    // This means the horizontal part of L/U shapes is at this `bot` row.
    // If contentMaxRow is the next available row (e.g. index 5 for 0-4 rows used), then actual bottom is contentMaxRow-1.
    // Pylambdac: `bot = max(l_r, r_r)`. `l_r` is `ro` of child + possibly 1.
    // Let's use `contentMaxRow` which is the next available row index. The horizontal lines are drawn AT this row index.
    const bottomRowForHorizontalConnection = contentMaxRow;
    const finalCol = rightResult.dimensions.col; // Next available column after the argument

    if (toLeave === 'L') {
      grid.drawbl(r_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: l_over_r, col: l_over_c },
      };
    } else if (toLeave === 'R') {
      grid.drawfl(l_over_r, bottomRowForHorizontalConnection, l_over_c, r_over_c);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: { row: r_over_r, col: r_over_c },
      };
    } else { // toLeave is null
      grid.drawu(l_over_r, bottomRowForHorizontalConnection, r_over_r, l_over_c, r_over_c);
      return {
        dimensions: { row: bottomRowForHorizontalConnection + 1, col: finalCol },
        leftoverConnection: undefined,
      };
    }
  } else if (term.type === 'lambda') {
    const lambdaNode = term as Lambda;
    const varName = lambdaNode.param;
    const oldBindingRow = lambdaLinks.get(varName); 

    lambdaLinks.set(varName, currentRow); 

    const bodyResult = drawNodeRecursive(
      lambdaNode.body,
      grid,
      lambdaLinks,
      toLeave, // Pass `toLeave` down, lambda body might be the end of a connection chain
      currentRow + 1, // Body starts on the next row
      currentCol // Body starts at the same column as lambda
    );

    if (oldBindingRow !== undefined) {
      lambdaLinks.set(varName, oldBindingRow);
    } else {
      lambdaLinks.delete(varName);
    }
    
    // Python: grid.drawl(ro, co, e_c - 1, self.v)
    // `e_c` is `bodyResult.dimensions.col` (next available col after body)
    // So lambda bar ends at the last column occupied by the body.
    grid.drawl(currentRow, currentCol, bodyResult.dimensions.col - 1, varName);

    return {
      // Dimensions of lambda are those of its body.
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
  actualWidthPx: number; // For SVG element width attribute
  actualHeightPx: number; // For SVG element height attribute
  viewBox: string; 
}

export function generateTrompDiagramData(
  term: ASTNode | null,
  scale: number = 20 
): TrompDiagramRenderData | null {
  if (!term) {
    return null;
  }

  const initialLambdaLinks = new Map<string, number>();

  // First pass: calculate dimensions
  const nullGrid = new NullGrid();
  // Create a fresh map for the first pass
  const firstPassLambdaLinks = new Map(initialLambdaLinks);
  const dimResult = drawNodeRecursive(term, nullGrid, firstPassLambdaLinks, null, 0, 0);
  
  if (dimResult.leftoverConnection) {
     // This is asserted against in Python for the top level.
     console.warn("Tromp Diagram: Top-level expression returned a leftover connection. This is unexpected.", term, dimResult.leftoverConnection);
  }

  // dimensions are (next_available_row, next_available_col)
  const gridHeight = Math.max(1, dimResult.dimensions.row);
  const gridWidth = Math.max(1, dimResult.dimensions.col);

  // Second pass: actual drawing
  const svgGrid = new SvgCollectingGrid(scale);
  // Create another fresh map for the second pass
  const secondPassLambdaLinks = new Map(initialLambdaLinks);
  const drawResult = drawNodeRecursive(term, svgGrid, secondPassLambdaLinks, null, 0, 0);

  // Basic consistency check (optional, for debugging)
  if (Math.max(1, drawResult.dimensions.row) !== gridHeight || Math.max(1, drawResult.dimensions.col) !== gridWidth) {
    console.warn(
        `Tromp Diagram Dimension Mismatch:
        Pass 1 (NullGrid) -> Height: ${gridHeight}, Width: ${gridWidth}
        Pass 2 (SvgGrid)  -> Height: ${Math.max(1, drawResult.dimensions.row)}, Width: ${Math.max(1, drawResult.dimensions.col)}`
    );
     // It's possible for minor differences if one pass results in 0 and is clamped to 1,
     // while the other results in something small. Use the dimensions from the first pass for consistency.
  }
  
  return {
    svgElements: svgGrid.svgElements,
    widthInGridUnits: gridWidth, 
    heightInGridUnits: gridHeight,
    actualWidthPx: gridWidth * scale,
    actualHeightPx: gridHeight * scale,
    // viewBox for SVG will be from 0,0 to gridWidth, gridHeight in grid units.
    // The translate(0.5,0.5) for crisp lines is handled by a <g> transform in the component.
    viewBox: `0 0 ${gridWidth} ${gridHeight}`,
  };
}
