
"use client";
import type { NamedExpression } from '@/lib/lambda-calculus/predefined';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NamedExpressionButtonProps {
  expression: NamedExpression;
  onInsert: (lambda: string) => void;
}

export function NamedExpressionButton({ expression, onInsert }: NamedExpressionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onInsert(expression.lambda)}
          className="font-mono text-xs h-auto py-1 px-2 flex-shrink-0" // Adjusted for better fit
        >
          {expression.name}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-md bg-background border-border shadow-lg p-2 rounded-md">
        <p className="font-semibold text-sm text-foreground">{expression.name}</p>
        {expression.description && <p className="text-xs text-muted-foreground mb-1">{expression.description}</p>}
        <pre className="font-mono text-xs bg-muted text-muted-foreground p-1.5 rounded-sm overflow-x-auto">
          {expression.lambda}
        </pre>
      </TooltipContent>
    </Tooltip>
  );
}
