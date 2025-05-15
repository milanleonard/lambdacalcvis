
export type ASTNodeId = string;

export interface BaseASTNode {
  id: ASTNodeId; // For unique identification, e.g., for React keys and animations
  isRedex?: boolean; // To mark if this node is part of the current redex
}

export interface Variable extends BaseASTNode {
  type: 'variable';
  name: string;
}

export interface Lambda extends BaseASTNode {
  type: 'lambda';
  param: string;
  body: ASTNode;
}

export interface Application extends BaseASTNode {
  type: 'application';
  func: ASTNode;
  arg: ASTNode;
}

export type ASTNode = Variable | Lambda | Application;

// Helper to generate unique IDs
let nodeIdCounter = 0;
export function generateNodeId(): ASTNodeId {
  return `node-${nodeIdCounter++}`;
}
