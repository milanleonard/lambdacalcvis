
"use client";
import { useLambda } from '@/contexts/LambdaContext';
import { ASTNodeComponent } from './ASTNodeComponent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

export function ASTVisualizer() {
  const { currentAST, isLoading, error, highlightedRedexId } = useLambda();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Abstract Syntax Tree</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow"> {/* CardContent takes remaining height */}
        <ScrollArea className="h-full"> {/* ScrollArea fills CardContent */}
          {isLoading && !currentAST && (
            <div className="space-y-4 p-2"> {/* Padding for skeleton */}
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-3/4" />
            </div>
          )}
          {error && !currentAST && (
            <div className="flex flex-col items-center justify-center h-full text-destructive p-2"> {/* Padding for error */}
              <AlertTriangle className="w-16 h-16 mb-4" />
              <p className="text-xl">Error parsing expression.</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}
          {currentAST && (
            <div key={currentAST.id} className="animate-fadeIn p-2"> {/* Padding for AST content */}
              <ASTNodeComponent node={currentAST} redexIdToHighlight={highlightedRedexId} />
            </div>
          )}
          {!isLoading && !error && !currentAST && (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-2"> {/* Padding for placeholder */}
                <p className="text-xl">Enter a Lambda Calculus expression to visualize its AST.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
