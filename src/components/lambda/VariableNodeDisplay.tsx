
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
        "p-1 m-1 border rounded-md shadow-sm text-center min-w-[30px]", // Reduced padding from p-2, reduced min-w from 40px
        "bg-[hsl(var(--ast-variable-bg))] text-[hsl(var(--ast-variable-fg))]",
        "border-[hsl(var(--ast-variable-fg)/0.5)]",
        isHighlighted && "ring-2 ring-[hsl(var(--ast-highlight-bg))] animate-highlightPulse"
      )}
      title={`Variable: ${node.name}`}
    >
      <span className="font-mono text-base font-semibold">{node.name}</span> {/* Font size from text-lg to text-base */}
    </div>
  );
}
