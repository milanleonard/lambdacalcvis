
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
  setRawExpression: (expr: string) => void;
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

  useEffect(() => {
    parseAndSetAST(state.rawExpression);
  }, [state.rawExpression, parseAndSetAST]);


  const setRawExpression = (expr: string) => {
    setState(prevState => ({ ...prevState, rawExpression: expr }));
    // Parsing will be handled by the useEffect
  };

  const performReductionStep = () => {
    if (!state.currentAST || !state.isReducible) {
      toast({ title: "Cannot Reduce", description: "Expression is not reducible or no AST.", variant: "default" });
      return;
    }
    setState(prevState => ({ ...prevState, isLoading: true }));
    try {
      // Make a deep copy for reduction to ensure state immutability and new keys for animation
      const astToReduce = state.currentAST; // reduceStep will clone internally if needed
      const { newAst, changed, redexId } = reduceStep(astToReduce);
      
      if (changed) {
        const printedNewAst = print(newAst);
        // Check if the new AST is further reducible
        const checkNextReduce = reduceStep(newAst); // Safe, reduceStep clones
        setState(prevState => ({
          ...prevState,
          currentAST: newAst,
          astHistory: [...prevState.astHistory, newAst],
          reducedExpressionString: printedNewAst,
          isLoading: false,
          error: null,
          isReducible: checkNextReduce.changed,
          highlightedRedexId: redexId, // Highlight the redex that was just reduced
        }));
        // After a short delay, clear the highlight if we want it to be transient
        setTimeout(() => {
            setState(s => ({...s, highlightedRedexId: checkNextReduce.changed ? checkNextReduce.redexId : undefined}))
        }, 500); // 500ms for highlight to be visible
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
    setRawExpression(initialExpression);
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
