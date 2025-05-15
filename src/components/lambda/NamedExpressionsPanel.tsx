
"use client";
import { predefinedExpressions } from '@/lib/lambda-calculus/predefined';
import { NamedExpressionButton } from './NamedExpressionButton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';

interface NamedExpressionsPanelProps {
  onInsert: (lambda: string) => void;
}

export function NamedExpressionsPanel({ onInsert }: NamedExpressionsPanelProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <ScrollArea className="w-full whitespace-nowrap rounded-md border border-input bg-background p-1">
        <div className="flex space-x-2 p-1">
          {predefinedExpressions.map((expr) => (
            <NamedExpressionButton key={expr.name} expression={expr} onInsert={onInsert} />
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </TooltipProvider>
  );
}
