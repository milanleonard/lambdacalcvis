
"use client";
import { useLambda } from '@/contexts/LambdaContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Play, RotateCcw, Sigma } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { NamedExpressionsPanel } from './NamedExpressionsPanel'; // Added import

export function ExpressionInputCard() {
  const {
    rawExpression,
    setRawExpression,
    performReductionStep,
    reducedExpressionString,
    isLoading,
    error,
    isReducible,
    resetState,
  } = useLambda();

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawExpression(event.target.value);
  };

  const handleInsertNamedExpression = (lambdaToInsert: string) => {
    setRawExpression(prev => {
      const currentText = prev.trim();
      if (currentText === "") {
        return lambdaToInsert;
      }
      // Add a space if the current text doesn't end with one and is not just a parenthesis or lambda start
      const needsSpace = currentText.length > 0 && !/\s$/.test(currentText) && !/[λ\\L\(]$/.test(currentText);
      return `${currentText}${needsSpace ? ' ' : ''}${lambdaToInsert}`;
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Sigma className="h-8 w-8 text-primary" />
          <CardTitle className="text-2xl font-semibold">LambdaVis</CardTitle>
        </div>
        <CardDescription>Enter a Lambda Calculus expression (use 'L' or '\' for λ) and see it evaluated step-by-step.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4 flex flex-col"> {/* Reduced space-y-6 to space-y-4 */}
        <div className="space-y-2">
          <Label htmlFor="lambda-expression" className="text-base">Expression</Label>
          <Textarea
            id="lambda-expression"
            value={rawExpression}
            onChange={handleInputChange}
            placeholder="e.g., (Lx.x) (Ly.y) or use Predefined Terms below"
            className="font-mono text-base min-h-[80px] bg-input text-foreground placeholder:text-muted-foreground focus:ring-primary" // Reduced min-h from 100px
            rows={3}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-base">Predefined Terms</Label>
          <NamedExpressionsPanel onInsert={handleInsertNamedExpression} />
        </div>
        
        <div className="space-y-2 flex-grow flex flex-col min-h-[100px]"> {/* Added min-h to ensure it doesn't collapse too much */}
          <Label htmlFor="reduced-expression" className="text-base">Current Form</Label>
          <ScrollArea className="flex-grow border rounded-md bg-input p-1 min-h-[60px]"> {/* Reduced min-h from 80px */}
            <pre id="reduced-expression" className="p-3 font-mono text-sm text-foreground whitespace-pre-wrap break-all"> {/* Reduced text-base to text-sm */}
              {isLoading && !reducedExpressionString ? "Processing..." : reducedExpressionString}
            </pre>
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4"> {/* Added pt-4 */}
        <Button onClick={() => resetState()} variant="outline" className="w-full sm:w-auto" disabled={isLoading}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset
        </Button>
        <Button onClick={performReductionStep} disabled={isLoading || !isReducible || !!error} className="w-full sm:w-auto">
          <Play className="mr-2 h-4 w-4" /> Reduce Step
        </Button>
      </CardFooter>
    </Card>
  );
}
