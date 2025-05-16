
"use client";
import type { ASTNode, ASTNodeId } from '@/lib/lambda-calculus/types';
import type { NamedExpression } from '@/lib/lambda-calculus/predefined';
import { predefinedExpressions } from '@/lib/lambda-calculus/predefined';
import { parse } from '@/lib/lambda-calculus/parser';
import { print } from '@/lib/lambda-calculus/printer';
import { reduceStep, cloneAST } from '@/lib/lambda-calculus/reducer';
import { prettifyAST } from '@/lib/lambda-calculus/prettifier';
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
  fullyReducedString: string; 
  prettifiedExpressionString: string; // New state for prettified output
  isReducible: boolean;
  highlightedRedexId?: string;
  customExpressions: NamedExpression[];
}

interface LambdaContextType extends LambdaState {
  setRawExpression: (value: string | ((prevState: string) => string)) => void;
  performReductionStep: () => void;
  reduceToNormalForm: () => void;
  resetState: (initialExpression?: string) => void;
  addCustomExpression: (name: string, lambda: string) => boolean;
  removeCustomExpression: (name: string) => void;
}

const LambdaContext = createContext<LambdaContextType | undefined>(undefined);

const INITIAL_EXPRESSION = "(λx.λy.x y) (λz.z)";
const MAX_FULL_REDUCTION_STEPS = 5000;

export const LambdaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<LambdaState>({
    rawExpression: INITIAL_EXPRESSION,
    currentAST: null,
    astHistory: [],
    error: null,
    isLoading: false,
    reducedExpressionString: "",
    fullyReducedString: "",
    prettifiedExpressionString: "", // Initialize new state
    isReducible: false,
    customExpressions: [],
  });

  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedCustomExpressions = localStorage.getItem(CUSTOM_EXPRESSIONS_STORAGE_KEY);
      if (storedCustomExpressions) {
        const parsedExpressions: NamedExpression[] = JSON.parse(storedCustomExpressions);
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

  const updatePrettifiedString = useCallback((ast: ASTNode | null, currentCustomExprs: NamedExpression[]) => {
    if (ast) {
      const prettified = prettifyAST(ast, currentCustomExprs, predefinedExpressions);
      setState(prevState => ({ ...prevState, prettifiedExpressionString: prettified }));
    } else {
      setState(prevState => ({ ...prevState, prettifiedExpressionString: "" }));
    }
  }, []);


  const parseAndSetAST = useCallback((expression: string, currentCustomExpressions: NamedExpression[]) => {
    setState(prevState => ({ ...prevState, isLoading: true, error: null, fullyReducedString: "" }));
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
      updatePrettifiedString(ast, currentCustomExpressions);
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
      updatePrettifiedString(null, currentCustomExpressions);
    }
  }, [toast, updatePrettifiedString]);

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
      updatePrettifiedString(null, state.customExpressions);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [state.rawExpression, state.customExpressions]); // parseAndSetAST is stable due to useCallback

  const setRawExpression = (value: string | ((prevState: string) => string)) => {
    const newRawExpression = typeof value === 'function' ? value(state.rawExpression) : value;
    setState(prevState => ({ ...prevState, rawExpression: newRawExpression, fullyReducedString: "", prettifiedExpressionString: "" })); 
  };

  const performReductionStep = () => {
    if (!state.currentAST || !state.isReducible) {
      toast({ title: "Cannot Reduce", description: "Expression is not reducible or no AST.", variant: "default" });
      return;
    }
    setState(prevState => ({ ...prevState, isLoading: true, fullyReducedString: "" }));
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
        updatePrettifiedString(newAst, state.customExpressions);
        setTimeout(() => {
            setState(s => ({...s, highlightedRedexId: checkNextReduce.changed ? checkNextReduce.redexId : undefined}))
        }, 500); // Delay highlight update for next redex
      } else {
        toast({ title: "Normal Form", description: "Expression is in normal form.", variant: "default" });
        setState(prevState => ({ ...prevState, isLoading: false, isReducible: false, highlightedRedexId: undefined }));
        updatePrettifiedString(state.currentAST, state.customExpressions); // Update prettified for final form
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast({ title: "Reduction Error", description: errorMessage, variant: "destructive" });
      setState(prevState => ({ ...prevState, error: errorMessage, isLoading: false, isReducible: false }));
       updatePrettifiedString(state.currentAST, state.customExpressions); // Still try to prettify current state
    }
  };

  const reduceToNormalForm = () => {
    if (!state.currentAST) {
      toast({ title: "Cannot Reduce", description: "No AST to reduce.", variant: "default" });
      setState(prevState => ({ ...prevState, fullyReducedString: "Error: No AST" }));
      return;
    }
    setState(prevState => ({ ...prevState, isLoading: true, fullyReducedString: "Reducing..." }));
  
    let astForFullReduction = cloneAST(state.currentAST); 
    let steps = 0;
    let reducibleCurrent = true;
    let tempAstHistoryForFullReduction: ASTNode[] = [astForFullReduction];
  
    try {
      while (reducibleCurrent && steps < MAX_FULL_REDUCTION_STEPS) {
        const { newAst, changed } = reduceStep(astForFullReduction); 
        if (changed) {
          astForFullReduction = newAst;
          tempAstHistoryForFullReduction.push(astForFullReduction);
          steps++;
        } else {
          reducibleCurrent = false;
        }
      }
  
      const finalString = print(astForFullReduction);
      setState(prevState => ({
        ...prevState,
        isLoading: false,
        fullyReducedString: finalString,
        // Optionally, update currentAST to the fully reduced form, if desired.
        // For now, full reduction result is separate.
        // currentAST: astForFullReduction,
        // reducedExpressionString: finalString,
        // astHistory: [...prevState.astHistory, ...tempAstHistoryForFullReduction.slice(1)], // Append steps
        // isReducible: false,
        // highlightedRedexId: undefined,
      }));
      // Prettify the final normal form
      // updatePrettifiedString(astForFullReduction, state.customExpressions); 
      // ^ This would update the main prettified display. Might be confusing if main AST isn't updated.
  
      if (steps === MAX_FULL_REDUCTION_STEPS && reducibleCurrent) {
        toast({ title: "Max Steps Reached", description: `Reduction stopped after ${MAX_FULL_REDUCTION_STEPS} steps. Result may not be normal form.`, variant: "destructive" });
      } else if (!reducibleCurrent) {
        toast({ title: "Normal Form Reached", description: `Reduced to normal form in ${steps} step(s).`, variant: "default" });
      }
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast({ title: "Full Reduction Error", description: errorMessage, variant: "destructive" });
      setState(prevState => ({ ...prevState, isLoading: false, fullyReducedString: `Error: ${errorMessage}` }));
    }
  };
  
  const resetState = (initialExpression: string = INITIAL_EXPRESSION) => {
    setRawExpression(initialExpression); 
    setState(prevState => ({ ...prevState, fullyReducedString: ""})); 
    // parseAndSetAST (called via useEffect on rawExpression change) will handle prettified string reset.
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
      // parseAndSetAST will be re-triggered by useEffect due to customExpressions change,
      // which will also update the prettified string.
      toast({ title: "Success", description: `Custom term "${name}" saved!`, variant: "default" });
      return true;
    } catch (error) {
        console.error("Failed to save custom expressions to localStorage:", error);
        toast({ title: "Storage Error", description: "Could not save custom term due to local storage issue.", variant: "destructive" });
        return false;
    }
  };

  const removeCustomExpression = (name: string) => {
    const updatedCustomExpressions = state.customExpressions.filter(expr => expr.name !== name);
    try {
      localStorage.setItem(CUSTOM_EXPRESSIONS_STORAGE_KEY, JSON.stringify(updatedCustomExpressions));
      setState(prevState => ({
        ...prevState,
        customExpressions: updatedCustomExpressions,
      }));
      // parseAndSetAST will be re-triggered by useEffect due to customExpressions change,
      // which will also update the prettified string.
      toast({ title: "Success", description: `Custom term "${name}" removed.`, variant: "default" });
    } catch (error) {
      console.error("Failed to remove custom expression from localStorage:", error);
      toast({ title: "Storage Error", description: "Could not remove custom term due to local storage issue.", variant: "destructive" });
    }
  };


  return (
    <LambdaContext.Provider value={{ ...state, setRawExpression, performReductionStep, reduceToNormalForm, resetState, addCustomExpression, removeCustomExpression }}>
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

    
