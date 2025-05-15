"use client";
import { useLambda } from '@/contexts/LambdaContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // Using Textarea for potentially multi-line input or better visibility
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Play, RotateCcw, Sigma } from 'lucide-react'; // Using Sigma for Lambda symbol temporarily
import { ScrollArea } from '../ui/scroll-area';

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Sigma className="h-8 w-8 text-primary" />
          <CardTitle className="text-2xl font-semibold">LambdaVis</CardTitle>
        </div>
        <CardDescription>Enter a Lambda Calculus expression and see it evaluated step-by-step.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-6 flex flex-col">
        <div className="space-y-2">
          <Label htmlFor="lambda-expression" className="text-base">Expression</Label>
          <Textarea
            id="lambda-expression"
            value={rawExpression}
            onChange={handleInputChange}
            placeholder="e.g., (λx.x) (λy.y)"
            className="font-mono text-base min-h-[100px] bg-input text-foreground placeholder:text-muted-foreground focus:ring-primary"
            rows={3}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        
        <div className="space-y-2 flex-grow flex flex-col">
          <Label htmlFor="reduced-expression" className="text-base">Current Form</Label>
          <ScrollArea className="flex-grow border rounded-md bg-input p-1 min-h-[80px]">
            <pre id="reduced-expression" className="p-3 font-mono text-base text-foreground whitespace-pre-wrap break-all">
              {isLoading && !reducedExpressionString ? "Processing..." : reducedExpressionString}
            </pre>
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
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
