
"use client";
import { predefinedExpressions } from '@/lib/lambda-calculus/predefined';
import { useLambda } from '@/contexts/LambdaContext';
import { NamedExpressionButton } from './NamedExpressionButton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react'; // Import X icon for delete

interface NamedExpressionsPanelProps {
  onInsert: (lambda: string) => void;
}

export function NamedExpressionsPanel({ onInsert }: NamedExpressionsPanelProps) {
  const { customExpressions, removeCustomExpression } = useLambda();

  const allExpressions = [...predefinedExpressions, ...customExpressions.map(ce => ({...ce, isCustom: true}))];

  return (
    <TooltipProvider delayDuration={200}>
      <ScrollArea className="w-full whitespace-nowrap rounded-md border border-input bg-background p-1 min-h-[60px]"> {/* Increased min-h */}
        <div className="flex space-x-2 p-1">
          {allExpressions.map((expr) => (
            <div key={expr.name} className="relative group flex items-center space-x-1">
              <NamedExpressionButton expression={expr} onInsert={onInsert} />
              {(expr as any).isCustom && (
                <>
                  <Badge 
                    variant="secondary" 
                    className="text-xs px-1 py-0 leading-tight group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    Custom
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent tooltip or other parent actions
                        removeCustomExpression(expr.name);
                    }}
                    aria-label={`Remove ${expr.name}`}
                    title={`Remove ${expr.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </TooltipProvider>
  );
}
