import type { ASTNode } from '@/lib/lambda-calculus/types';
import { VariableNodeDisplay } from './VariableNodeDisplay';
import { LambdaNodeDisplay } from './LambdaNodeDisplay';
import { ApplicationNodeDisplay } from './ApplicationNodeDisplay';

interface ASTNodeComponentProps {
  node: ASTNode;
  depth?: number;
  redexIdToHighlight?: string;
}

export function ASTNodeComponent({ node, depth = 0, redexIdToHighlight }: ASTNodeComponentProps) {
  const isHighlighted = node.id === redexIdToHighlight || node.isRedex;

  switch (node.type) {
    case 'variable':
      return <VariableNodeDisplay node={node} isHighlighted={isHighlighted} />;
    case 'lambda':
      return <LambdaNodeDisplay node={node} depth={depth} isHighlighted={isHighlighted} redexIdToHighlight={redexIdToHighlight} />;
    case 'application':
      return <ApplicationNodeDisplay node={node} depth={depth} isHighlighted={isHighlighted} redexIdToHighlight={redexIdToHighlight} />;
    default:
      return <div className="text-destructive">Unknown AST Node type</div>;
  }
}
