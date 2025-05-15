
import type { Lambda } from '@/lib/lambda-calculus/types';
import { ASTNodeComponent } from './ASTNodeComponent';
import { cn } from '@/lib/utils';

interface LambdaNodeProps {
  node: Lambda;
  depth: number;
  isHighlighted?: boolean;
  redexIdToHighlight?: string;
}

export function LambdaNodeDisplay({ node, depth, isHighlighted, redexIdToHighlight }: LambdaNodeProps) {
  return (
    <div
      className={cn(
        "p-2 m-1 border rounded-lg shadow-md flex flex-col items-center", // Reduced padding from p-3
        "bg-[hsl(var(--ast-lambda-bg))] text-[hsl(var(--ast-lambda-fg))]",
        "border-[hsl(var(--ast-lambda-fg)/0.5)]",
         isHighlighted && "ring-2 ring-[hsl(var(--ast-highlight-bg))] animate-highlightPulse"
      )}
      title={`Lambda: λ${node.param}.(...)`}
    >
      <div className="flex items-center font-mono text-base font-semibold"> {/* Font size from text-lg to text-base */}
        <span className="mr-1 text-[hsl(var(--ast-lambda-fg))] text-xl">λ</span>
        <span>{node.param}.</span>
      </div>
      <div className="mt-2 pl-3 border-l-2 border-dashed border-[hsl(var(--ast-lambda-fg)/0.3)]"> {/* Indent from pl-4 to pl-3 */}
        <ASTNodeComponent node={node.body} depth={depth + 1} redexIdToHighlight={redexIdToHighlight} />
      </div>
    </div>
  );
}
