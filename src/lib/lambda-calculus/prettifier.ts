
import type { ASTNode } from './types';
import type { NamedExpression } from './predefined';
import { parse } from './parser';
import { print } from './printer';

interface ProcessedNamedTerm {
  name: string;
  lambda: string; // original lambda string
  printedLambda: string; // canonical printed form
}

// Pre-processes named expressions to get their canonical printed form and sort them for greedy matching.
function getProcessedNamedTerms(
  customExpressions: NamedExpression[],
  predefinedExpressionsForContext: NamedExpression[]
): ProcessedNamedTerm[] {
  const allExpressions = [...predefinedExpressionsForContext, ...customExpressions];
  const processedTerms: ProcessedNamedTerm[] = [];

  for (const expr of allExpressions) {
    try {
      // Parse in isolation (no custom terms from the main context, only predefined if absolutely necessary for this term itself, but usually not)
      const ast = parse(expr.lambda, []); 
      const printed = print(ast, 'top'); // Get canonical form for matching

      // Filter out very simple terms or those whose printed form is trivial (e.g. just a variable name).
      // A simple heuristic: printed form should likely contain 'L', '(', or be longer than a typical var name.
      // This aims to prevent replacing "x" with "_MY_X_VAR" if _MY_X_VAR was defined as "x".
      const isComplexEnough = printed.includes('λ') || printed.includes('(') || printed.length > 5;
      const isNotJustAVariable = ast.type !== 'variable';


      if (printed.length > 0 && isComplexEnough && isNotJustAVariable) {
        processedTerms.push({
          name: expr.name,
          lambda: expr.lambda,
          printedLambda: printed,
        });
      } else if (printed.length > 0 && expr.name.match(/^([0-9]+|TRUE|FALSE|ZERO|ONE|TWO|THREE)$/)) {
        // Allow specific simple predefined terms like numbers or booleans even if their print form is short
         processedTerms.push({
          name: expr.name,
          lambda: expr.lambda,
          printedLambda: printed,
        });
      }

    } catch (e) {
      // Ignore terms that fail to parse (should have been caught at definition time for custom terms)
      console.warn(`Could not parse/process named term ${expr.name} for prettifying: ${e}`);
    }
  }

  // Sort by length of printedLambda, longest first for greedy matching.
  processedTerms.sort((a, b) => b.printedLambda.length - a.printedLambda.length);
  return processedTerms;
}

export function prettifyAST(
  node: ASTNode | null,
  customExpressions: NamedExpression[],
  predefinedExpressionsForContext: NamedExpression[]
): string {
  if (!node) {
    return "";
  }

  let currentPrintedString = print(node, 'top');
  
  const allProcessableTerms = getProcessedNamedTerms(customExpressions, predefinedExpressionsForContext);

  for (const term of allProcessableTerms) {
    if (term.printedLambda.length === 0) continue;

    // Replace all occurrences of the term's canonical printed form with _TERM_NAME
    // Ensure to handle cases where printedLambda might contain characters special to regex if we were using regex.
    // String.split().join() is a safe way for literal string replacement.
    currentPrintedString = currentPrintedString.split(term.printedLambda).join(`_${term.name}`);
  }

  return currentPrintedString;
}
