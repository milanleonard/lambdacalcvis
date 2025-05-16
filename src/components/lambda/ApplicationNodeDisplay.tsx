
import type { Application } from '@/lib/lambda-calculus/types';
import { ASTNodeComponent } from './ASTNodeComponent';
import { cn } from '@/lib/utils';

interface ApplicationNodeProps {
  node: Application;
  depth: number;
  isHighlighted?: boolean;
  redexIdToHighlight?: string;
}

export function ApplicationNodeDisplay({ node, depth, isHighlighted, redexIdToHighlight }: ApplicationNodeProps) {
  return (
    <div
      className={cn(
        "p-2 m-1 border rounded-lg shadow-md flex flex-col items-center", // Reduced padding from p-3
        "bg-[hsl(var(--ast-application-bg))] text-[hsl(var(--ast-application-fg))]",
        "border-[hsl(var(--ast-application-fg)/0.5)]",
        isHighlighted && "ring-2 ring-[hsl(var(--ast-highlight-bg))] animate-highlightPulse"
      )}
      title="Application"
    >
      <span className="text-xs font-semibold uppercase text-[hsl(var(--ast-application-fg)/0.7)]">App</span>
      {/* Always use flex-col for vertical stacking */}
      <div className="flex flex-col items-stretch justify-around w-full mt-2 space-y-2">
        <div className="flex-1 p-1 border border-dashed border-[hsl(var(--ast-application-fg)/0.3)] rounded">
          <ASTNodeComponent node={node.func} depth={depth + 1} redexIdToHighlight={redexIdToHighlight} />
        </div>
        <div className="flex-1 p-1 border border-dashed border-[hsl(var(--ast-application-fg)/0.3)] rounded">
          <ASTNodeComponent node={node.arg} depth={depth + 1} redexIdToHighlight={redexIdToHighlight} />
        </div>
      </div>
    </div>
  );
}
