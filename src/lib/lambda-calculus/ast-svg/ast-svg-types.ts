
import type { ASTNodeId } from '@/lib/lambda-calculus/types';

export interface SvgDimensions {
  width: number;
  height: number;
}

export interface SvgPosition {
  x: number;
  y: number;
}

export interface SvgAstNodeBase extends SvgDimensions, SvgPosition {
  id: ASTNodeId; // Original ASTNode ID for linking
  svgId: string; // Unique ID for the SVG element itself
  type: 'variable' | 'lambda' | 'application';
  sourcePrimitiveName?: string;
  isHighlighted?: boolean;
  isGreedilyCollapsible?: boolean; // New: True if this node *could* be greedily collapsed
}

export interface SvgVariableNode extends SvgAstNodeBase {
  type: 'variable';
  name: string;
}

export interface SvgLambdaNode extends SvgAstNodeBase {
  type: 'lambda';
  param: string;
  // We might store child SVG IDs or rely on tree traversal for connectors
}

export interface SvgApplicationNode extends SvgAstNodeBase {
  type: 'application';
  // We might store child SVG IDs or rely on tree traversal for connectors
}

export type SvgAstNode = SvgVariableNode | SvgLambdaNode | SvgApplicationNode;

export interface SvgConnector {
  id: string;
  fromSvgId: string; // SVG ID of the parent node
  toSvgId: string;   // SVG ID of the child node
  pathD: string;     // SVG path 'd' attribute string for complex connectors if needed
  isHighlighted?: boolean; // If the connection is part of a redex
}

export interface AstSvgRenderData {
  nodes: SvgAstNode[];
  connectors: SvgConnector[];
  canvasWidth: number;
  canvasHeight: number;
  error?: string; // In case layout fails or AST is too complex
}

// Helper to generate unique SVG IDs
let svgNodeIdCounter = 0;
export function generateSvgNodeId(type: string): string {
  if (svgNodeIdCounter > 1e7) {
    svgNodeIdCounter = 0;
  }
  return `svg-${type}-${svgNodeIdCounter++}`;
}
