import type { Lambda } from '@/lib/lambda-calculus/types';
import { ASTNodeComponent } from './ASTNodeComponent';
import { cn } from '@/lib/utils';
import { Lambda as LambdaIconLucide } from 'lucide-react';


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
        "p-3 m-1 border rounded-lg shadow-md flex flex-col items-center",
        "bg-[hsl(var(--ast-lambda-bg))] text-[hsl(var(--ast-lambda-fg))]",
        "border-[hsl(var(--ast-lambda-fg)/0.5)]",
         isHighlighted && "ring-2 ring-[hsl(var(--ast-highlight-bg))] animate-highlightPulse"
      )}
      title={`Lambda: λ${node.param}.(...)`}
    >
      <div className="flex items-center font-mono text-lg font-semibold">
        <LambdaIconLucide className="w-5 h-5 mr-1 text-[hsl(var(--ast-lambda-fg))]" />
        <span>{node.param}.</span>
      </div>
      <div className="mt-2 pl-4 border-l-2 border-dashed border-[hsl(var(--ast-lambda-fg)/0.3)]">
        <ASTNodeComponent node={node.body} depth={depth + 1} redexIdToHighlight={redexIdToHighlight} />
      </div>
    </div>
  );
}
