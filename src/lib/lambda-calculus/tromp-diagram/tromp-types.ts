
export interface TrompPoint {
  row: number;
  col: number;
}

export interface LambdaBindingInfo extends TrompPoint {
  sourcePrimitiveName?: string;
}

export type LambdaLinksMap = Map<string, LambdaBindingInfo>;


export interface SvgLine {
  type: 'line';
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke?: string; 
  strokeWidth?: number;
  title?: string; 
  sourcePrimitiveName?: string; 
  isHighlighted?: boolean;
  isSecondaryHighlight?: boolean; // New: For argument of redex
}

export interface SvgPolyline {
  type: 'polyline';
  key: string;
  points: string; 
  fill?: string;
  stroke?: string; 
  strokeWidth?: number;
  sourcePrimitiveName?: string; 
  isHighlighted?: boolean;
  isSecondaryHighlight?: boolean; // New: For argument of redex
}

export type SvgElementData = SvgLine | SvgPolyline;

export interface Grid {
  drawl(r: number, cstart: number, cend: number, name?: string, sourcePrimitiveName?: string, isHighlighted?: boolean, isSecondaryHighlight?: boolean): void; 
  drawv(rstart: number, rend: number, c: number, sourcePrimitiveName?: string, isHighlighted?: boolean, isSecondaryHighlight?: boolean): void; 
  drawfl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean, isSecondaryHighlight?: boolean): void; 
  drawbl(rstart: number, rend: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean, isSecondaryHighlight?: boolean): void; 
  drawu(rstart: number, rend: number, rback: number, cstart: number, cend: number, sourcePrimitiveName?: string, isHighlighted?: boolean, isSecondaryHighlight?: boolean): void;
}

export interface DrawTermResult {
  dimensions: TrompPoint; 
  leftoverConnection?: TrompPoint & { sourcePrimitiveName?: string }; 
}
