
"use client";
import type { ASTNode } from '@/lib/lambda-calculus/types';
import { parse } from '@/lib/lambda-calculus/parser';
import { print } from '@/lib/lambda-calculus/printer';
import { reduceStep } from '@/lib/lambda-calculus/reducer';
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

interface LambdaState {
  rawExpression: string;
  currentAST: ASTNode | null;
  astHistory: (ASTNode | null)[]; // To store history of ASTs for potential future use (undo, animations)
  error: string | null;
  isLoading: boolean;
  reducedExpressionString: string;
  isReducible: boolean;
  highlightedRedexId?: string;
}

interface LambdaContextType extends LambdaState {
  setRawExpression: (value: string | ((prevState: string) => string)) => void;
  performReductionStep: () => void;
  resetState: (initialExpression?: string) => void;
}

const LambdaContext = createContext<LambdaContextType | undefined>(undefined);

const INITIAL_EXPRESSION = "(λx.λy.x y) (λz.z)";

export const LambdaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LambdaState>({
    rawExpression: INITIAL_EXPRESSION,
    currentAST: null,
    astHistory: [],
    error: null,
    isLoading: false,
    reducedExpressionString: "",
    isReducible: false,
  });

  const { toast } = useToast();

  const parseAndSetAST = useCallback((expression: string) => {
    setState(prevState => ({ ...prevState, isLoading: true, error: null }));
    try {
      const ast = parse(expression);
      const printedAst = print(ast);
      // Check reducibility
      const checkReduce = reduceStep(ast); // This clones, so it's safe
      setState(prevState => ({
        ...prevState,
        currentAST: ast,
        astHistory: [ast],
        reducedExpressionString: printedAst,
        error: null,
        isLoading: false,
        isReducible: checkReduce.changed,
        highlightedRedexId: checkReduce.redexId,
      }));
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast({ title: "Parse Error", description: errorMessage, variant: "destructive" });
      setState(prevState => ({
        ...prevState,
        currentAST: null,
        astHistory: [],
        error: errorMessage,
        isLoading: false,
        reducedExpressionString: "Error",
        isReducible: false,
        highlightedRedexId: undefined,
      }));
    }
  }, [toast]);

  // Effect to parse expression when rawExpression changes
  useEffect(() => {
    if (typeof state.rawExpression === 'string') {
      parseAndSetAST(state.rawExpression);
    } else {
      // This case should ideally not happen if setRawExpression is typed correctly
      // and state updates are consistent. Logging an error if it does.
      console.error("rawExpression is not a string:", state.rawExpression);
      setState(prevState => ({
        ...prevState,
        error: "Internal error: expression is not a string.",
        isLoading: false,
        reducedExpressionString: "Error",
        isReducible: false,
      }));
    }
  }, [state.rawExpression, parseAndSetAST]);


  const setRawExpression = (value: string | ((prevState: string) => string)) => {
    if (typeof value === 'function') {
      setState(prevState => ({ ...prevState, rawExpression: value(prevState.rawExpression) }));
    } else {
      setState(prevState => ({ ...prevState, rawExpression: value }));
    }
  };

  const performReductionStep = () => {
    if (!state.currentAST || !state.isReducible) {
      toast({ title: "Cannot Reduce", description: "Expression is not reducible or no AST.", variant: "default" });
      return;
    }
    setState(prevState => ({ ...prevState, isLoading: true }));
    try {
      const astToReduce = state.currentAST;
      const { newAst, changed, redexId } = reduceStep(astToReduce);
      
      if (changed) {
        const printedNewAst = print(newAst);
        const checkNextReduce = reduceStep(newAst);
        setState(prevState => ({
          ...prevState,
          currentAST: newAst,
          astHistory: [...prevState.astHistory, newAst],
          reducedExpressionString: printedNewAst,
          isLoading: false,
          error: null,
          isReducible: checkNextReduce.changed,
          highlightedRedexId: redexId, 
        }));
        setTimeout(() => {
            setState(s => ({...s, highlightedRedexId: checkNextReduce.changed ? checkNextReduce.redexId : undefined}))
        }, 500);
      } else {
        toast({ title: "Normal Form", description: "Expression is in normal form.", variant: "default" });
        setState(prevState => ({ ...prevState, isLoading: false, isReducible: false, highlightedRedexId: undefined }));
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast({ title: "Reduction Error", description: errorMessage, variant: "destructive" });
      setState(prevState => ({ ...prevState, error: errorMessage, isLoading: false, isReducible: false }));
    }
  };
  
  const resetState = (initialExpression: string = INITIAL_EXPRESSION) => {
     // Use the updated setRawExpression to ensure proper handling
    setRawExpression(initialExpression);
    // Explicitly trigger parsing for the reset state if needed, though useEffect should handle it.
    // However, to ensure immediate feedback from reset:
    parseAndSetAST(initialExpression);
  };

  return (
    <LambdaContext.Provider value={{ ...state, setRawExpression, performReductionStep, resetState }}>
      {children}
    </LambdaContext.Provider>
  );
};

export const useLambda = (): LambdaContextType => {
  const context = useContext(LambdaContext);
  if (context === undefined) {
    throw new Error('useLambda must be used within a LambdaProvider');
  }
  return context;
};
