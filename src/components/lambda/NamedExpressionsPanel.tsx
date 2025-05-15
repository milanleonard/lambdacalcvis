
"use client";
import { predefinedExpressions } from '@/lib/lambda-calculus/predefined';
import { useLambda } from '@/contexts/LambdaContext'; // Import useLambda
import { NamedExpressionButton } from './NamedExpressionButton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface NamedExpressionsPanelProps {
  onInsert: (lambda: string) => void;
}

export function NamedExpressionsPanel({ onInsert }: NamedExpressionsPanelProps) {
  const { customExpressions } = useLambda(); // Get custom expressions from context

  const allExpressions = [...predefinedExpressions, ...customExpressions.map(ce => ({...ce, isCustom: true}))];

  return (
    <TooltipProvider delayDuration={200}>
      <ScrollArea className="w-full whitespace-nowrap rounded-md border border-input bg-background p-1">
        <div className="flex space-x-2 p-1">
          {allExpressions.map((expr) => (
            <div key={expr.name} className="relative group">
              <NamedExpressionButton expression={expr} onInsert={onInsert} />
              {(expr as any).isCustom && (
                <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs px-1 py-0 leading-tight group-hover:bg-primary group-hover:text-primary-foreground">
                  Custom
                </Badge>
              )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </TooltipProvider>
  );
}
