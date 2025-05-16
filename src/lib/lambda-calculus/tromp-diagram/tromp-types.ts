
export interface TrompPoint {
  row: number;
  col: number;
}

export interface LambdaBindingInfo extends TrompPoint {
  sourcePrimitiveName?: string;
}

// Instead of Map<string, number>, use Map<string, LambdaBindingInfo>
export type LambdaLinksMap = Map<string, LambdaBindingInfo>;


export interface SvgLine {
  type: 'line';
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string; // Will be determined by visualizer based on sourcePrimitiveName
  strokeWidth?: number;
  title?: string; // For lambda name
  sourcePrimitiveName?: string; // To guide coloring
}

export interface SvgPolyline {
  type: 'polyline';
  key: string;
  points: string; // e.g., "x1,y1 x2,y2 x3,y3"
  fill?: string;
  stroke?: string; // Will be determined by visualizer based on sourcePrimitiveName
  strokeWidth?: number;
  sourcePrimitiveName?: string; // To guide coloring
}

export type SvgElementData = SvgLine | SvgPolyline;

export interface Grid {
  drawl(r: number, cstart: number, cend: number, name?: string, sourcePrimitiveName?: string): void; // Lambda bar
  drawv(rstart: number, rend: number, c: number, sourcePrimitiveName?: string): void; // Variable connection
  drawfl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string): void; // Forward L (┌) for application
  drawbl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string): void; // Backward L (┐) for application
  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number, sourcePrimitiveName?: string): void; // U shape for application
}

// Output of a draw operation for a term
export interface DrawTermResult {
  dimensions: TrompPoint; // (max_row_reached + 1, max_col_reached + 1) by this term and its children
  leftoverConnection?: TrompPoint & { sourcePrimitiveName?: string }; // Connection point for parent (if any), carry tag if var from tagged lambda
}
