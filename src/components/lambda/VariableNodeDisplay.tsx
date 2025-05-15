import type { Variable } from '@/lib/lambda-calculus/types';
import { cn } from '@/lib/utils';

interface VariableNodeProps {
  node: Variable;
  isHighlighted?: boolean;
}

export function VariableNodeDisplay({ node, isHighlighted }: VariableNodeProps) {
  return (
    <div
      className={cn(
        "p-2 m-1 border rounded-md shadow-sm text-center min-w-[40px]",
        "bg-[hsl(var(--ast-variable-bg))] text-[hsl(var(--ast-variable-fg))]",
        "border-[hsl(var(--ast-variable-fg)/0.5)]",
        isHighlighted && "ring-2 ring-[hsl(var(--ast-highlight-bg))] animate-highlightPulse"
      )}
      title={`Variable: ${node.name}`}
    >
      <span className="font-mono text-lg font-semibold">{node.name}</span>
    </div>
  );
}
