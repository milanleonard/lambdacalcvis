
"use client";
import React, { useState } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Play, RotateCcw, Sigma, Save, Zap } from 'lucide-react'; 
import { ScrollArea } from '../ui/scroll-area';
import { NamedExpressionsPanel } from './NamedExpressionsPanel';
import { Separator } from '../ui/separator';

export function ExpressionInputCard() {
  const {
    rawExpression,
    setRawExpression,
    performReductionStep,
    reduceToNormalForm,
    reducedExpressionString,
    prettifiedExpressionString, // Get the new prettified string
    fullyReducedString,
    isLoading,
    error,
    isReducible,
    resetState,
    addCustomExpression,
  } = useLambda();

  const [customTermName, setCustomTermName] = useState('');
  const [customTermLambda, setCustomTermLambda] = useState('');

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawExpression(event.target.value);
  };

  const handleInsertNamedExpression = (lambdaToInsert: string) => {
    setRawExpression(prev => {
      const currentText = prev.trim();
      const termToInsert = `(${lambdaToInsert})`; 
      if (currentText === "") {
        return termToInsert;
      }
      const needsSpace = currentText.length > 0 && !/\s$/.test(currentText) && !/[λ\\L\(]$/.test(currentText);
      return `${currentText}${needsSpace ? ' ' : ''}${termToInsert}`;
    });
  };

  const handleSaveCustomTerm = () => {
    if (addCustomExpression(customTermName, customTermLambda)) {
      setCustomTermName('');
      setCustomTermLambda('');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Sigma className="h-8 w-8 text-primary" />
          <CardTitle className="text-2xl font-semibold">LambdaVis</CardTitle>
        </div>
        <CardDescription>Enter a Lambda Calculus expression (e.g., `L`, `\`, `_ID`, `_TRUE`, `_2`) and evaluate it.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4 flex flex-col overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="lambda-expression" className="text-base">Expression</Label>
          <Textarea
            id="lambda-expression"
            value={rawExpression}
            onChange={handleInputChange}
            placeholder="e.g., (Lx.x) (Ly.y) or _ID _TRUE or _PLUS _2 _1"
            className="font-mono text-base min-h-[80px] bg-input text-foreground placeholder:text-muted-foreground focus:ring-primary"
            rows={3}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-base">Predefined & Custom Terms (Click to insert)</Label>
          <NamedExpressionsPanel onInsert={handleInsertNamedExpression} />
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <Label className="text-base">Define New Custom Term</Label>
          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Term Name (e.g., MY_FUNC)"
              value={customTermName}
              onChange={(e) => setCustomTermName(e.target.value)}
              className="bg-input text-foreground placeholder:text-muted-foreground focus:ring-primary"
              pattern="^[a-zA-Z][a-zA-Z0-9_']*"
              title="Name must start with a letter and contain only letters, numbers, or underscores."
            />
            <Textarea
              placeholder="Lambda Expression (e.g., Lx.Ly.x)"
              value={customTermLambda}
              onChange={(e) => setCustomTermLambda(e.target.value)}
              className="font-mono text-sm min-h-[60px] bg-input text-foreground placeholder:text-muted-foreground focus:ring-primary"
              rows={2}
            />
            <Button onClick={handleSaveCustomTerm} size="sm" className="w-full sm:w-auto" disabled={isLoading || !customTermName.trim() || !customTermLambda.trim()}>
              <Save className="mr-2 h-4 w-4" /> Save Custom Term
            </Button>
          </div>
        </div>
        
        <div className="space-y-2 mt-4">
          <Label htmlFor="reduced-expression" className="text-base">Current Form (Step-by-Step)</Label>
          <ScrollArea className="border rounded-md bg-input p-1 min-h-[60px] max-h-[120px]">
            <pre id="reduced-expression" className="p-3 font-mono text-sm text-foreground whitespace-pre-wrap break-all">
              {isLoading && !reducedExpressionString && !fullyReducedString ? "Processing..." : reducedExpressionString}
            </pre>
          </ScrollArea>
        </div>

        {/* New Prettified Form Display */}
        <div className="space-y-2 mt-2">
          <Label htmlFor="prettified-expression" className="text-base">Prettified Form</Label>
          <ScrollArea className="border rounded-md bg-input p-1 min-h-[60px] max-h-[120px]">
            <pre id="prettified-expression" className="p-3 font-mono text-sm text-foreground whitespace-pre-wrap break-all">
              {prettifiedExpressionString || (isLoading && !error ? "Processing..." : (error ? "Error in expression." : "Enter an expression."))}
            </pre>
          </ScrollArea>
        </div>

        <div className="space-y-2 mt-auto"> 
          <Label htmlFor="fully-reduced-expression" className="text-base">Normal Form (Full Reduction)</Label>
          <ScrollArea className="border rounded-md bg-muted p-1 min-h-[60px] max-h-[120px]">
            <pre id="fully-reduced-expression" className="p-3 font-mono text-sm text-muted-foreground whitespace-pre-wrap break-all">
              {isLoading && fullyReducedString === "Reducing..." ? "Reducing..." : (fullyReducedString || "Not yet fully reduced.")}
            </pre>
          </ScrollArea>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4 mt-auto">
        <Button onClick={() => resetState()} variant="outline" className="w-full sm:w-auto" disabled={isLoading}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset
        </Button>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={performReductionStep} disabled={isLoading || !isReducible || !!error} className="w-full sm:w-auto">
            <Play className="mr-2 h-4 w-4" /> Reduce Step
          </Button>
          <Button onClick={reduceToNormalForm} disabled={isLoading || !!error} className="w-full sm:w-auto" variant="secondary">
            <Zap className="mr-2 h-4 w-4" /> Reduce to Normal Form
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

    