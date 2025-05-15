
"use client";
import type { ASTNode } from '@/lib/lambda-calculus/types';
import type { NamedExpression } from '@/lib/lambda-calculus/predefined';
import { predefinedExpressions } from '@/lib/lambda-calculus/predefined';
import { parse } from '@/lib/lambda-calculus/parser';
import { print } from '@/lib/lambda-calculus/printer';
import { reduceStep } from '@/lib/lambda-calculus/reducer';
import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

const CUSTOM_EXPRESSIONS_STORAGE_KEY = 'lambdaVisCustomExpressions';

interface LambdaState {
  rawExpression: string;
  currentAST: ASTNode | null;
  astHistory: (ASTNode | null)[];
  error: string | null;
  isLoading: boolean;
  reducedExpressionString: string;
  isReducible: boolean;
  highlightedRedexId?: string;
  customExpressions: NamedExpression[];
}

interface LambdaContextType extends LambdaState {
  setRawExpression: (value: string | ((prevState: string) => string)) => void;
  performReductionStep: () => void;
  resetState: (initialExpression?: string) => void;
  addCustomExpression: (name: string, lambda: string) => boolean;
  // removeCustomExpression: (name: string) => void; // Future: for removing expressions
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
    customExpressions: [],
  });

  const { toast } = useToast();

  // Load custom expressions from localStorage on mount
  useEffect(() => {
    try {
      const storedCustomExpressions = localStorage.getItem(CUSTOM_EXPRESSIONS_STORAGE_KEY);
      if (storedCustomExpressions) {
        const parsedExpressions: NamedExpression[] = JSON.parse(storedCustomExpressions);
         // Basic validation
        if (Array.isArray(parsedExpressions) && parsedExpressions.every(item => typeof item.name === 'string' && typeof item.lambda === 'string')) {
            setState(prevState => ({ ...prevState, customExpressions: parsedExpressions }));
        } else {
            console.warn("Invalid custom expressions found in localStorage. Clearing.");
            localStorage.removeItem(CUSTOM_EXPRESSIONS_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Failed to load custom expressions from localStorage:", error);
      toast({ title: "Error", description: "Could not load custom terms from local storage.", variant: "destructive" });
    }
  }, [toast]);


  const parseAndSetAST = useCallback((expression: string, currentCustomExpressions: NamedExpression[]) => {
    setState(prevState => ({ ...prevState, isLoading: true, error: null }));
    try {
      const ast = parse(expression, currentCustomExpressions);
      const printedAst = print(ast);
      const checkReduce = reduceStep(ast);
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
    if (typeof state.rawExpression === 'string') {
      parseAndSetAST(state.rawExpression, state.customExpressions);
    } else {
      console.error("rawExpression is not a string:", state.rawExpression);
      setState(prevState => ({
        ...prevState,
        error: "Internal error: expression is not a string.",
        isLoading: false,
        reducedExpressionString: "Error",
        isReducible: false,
      }));
    }
  }, [state.rawExpression, state.customExpressions, parseAndSetAST]);


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
      // Pass custom expressions to reduceStep if it involves parsing (it doesn't directly, but good practice if it could)
      // For now, reduceStep itself doesn't re-parse strings with _NAME syntax. Substitution happens on AST.
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
    setRawExpression(initialExpression);
    parseAndSetAST(initialExpression, state.customExpressions);
  };

  const addCustomExpression = (name: string, lambda: string): boolean => {
    if (!name.trim() || !lambda.trim()) {
      toast({ title: "Invalid Input", description: "Name and Lambda expression cannot be empty.", variant: "destructive" });
      return false;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_']*$/.test(name)) {
      toast({ title: "Invalid Name", description: "Name must start with a letter and contain only letters, numbers, or underscores.", variant: "destructive" });
      return false;
    }
    if (predefinedExpressions.some(expr => expr.name === name) || state.customExpressions.some(expr => expr.name === name)) {
      toast({ title: "Name Exists", description: `The name "${name}" is already in use.`, variant: "destructive" });
      return false;
    }

    try {
      // Try to parse the lambda to ensure it's valid. Pass an empty array for customTerms to avoid self-reference issues during validation.
      parse(lambda, []); 
    } catch (e: any) {
      const parseError = e instanceof Error ? e.message : String(e);
      toast({ title: "Invalid Lambda", description: `The lambda expression for "${name}" is invalid: ${parseError}`, variant: "destructive" });
      return false;
    }

    const newCustomExpression: NamedExpression = { name, lambda };
    const updatedCustomExpressions = [...state.customExpressions, newCustomExpression];
    
    try {
      localStorage.setItem(CUSTOM_EXPRESSIONS_STORAGE_KEY, JSON.stringify(updatedCustomExpressions));
      setState(prevState => ({ ...prevState, customExpressions: updatedCustomExpressions }));
      toast({ title: "Success", description: `Custom term "${name}" saved!`, variant: "default" });
      // Re-parse current expression with the new custom term available
      parseAndSetAST(state.rawExpression, updatedCustomExpressions);
      return true;
    } catch (error) {
        console.error("Failed to save custom expressions to localStorage:", error);
        toast({ title: "Storage Error", description: "Could not save custom term due to local storage issue.", variant: "destructive" });
        return false;
    }
  };

  return (
    <LambdaContext.Provider value={{ ...state, setRawExpression, performReductionStep, resetState, addCustomExpression }}>
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
