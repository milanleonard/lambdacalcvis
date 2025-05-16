
export type ASTNodeId = string;

export interface BaseASTNode {
  id: ASTNodeId; // For unique identification, e.g., for React keys and animations
  isRedex?: boolean; // To mark if this node is part of the current redex
  sourcePrimitiveName?: string; // To track the original named term (e.g., "_ID", "_PLUS", "_MY_FUNC", "_2")
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
  // Reset counter if it grows excessively large, to prevent extremely long IDs in long sessions.
  // This is a practical safeguard, not a strict requirement for correctness.
  if (nodeIdCounter > 1e7) {
    nodeIdCounter = 0;
  }
  return `node-${nodeIdCounter++}`;
}
