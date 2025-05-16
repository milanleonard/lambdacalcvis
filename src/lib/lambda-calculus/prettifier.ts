
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
      const isComplexEnough = printed.includes('λ') || printed.includes('(') || printed.length > 5;
      const isNotJustAVariable = ast.type !== 'variable';


      if (printed.length > 0 && isComplexEnough && isNotJustAVariable) {
        processedTerms.push({
          name: expr.name,
          lambda: expr.lambda,
          printedLambda: printed,
        });
      } else if (printed.length > 0 && expr.name.match(/^([0-9]+|TRUE|FALSE)$/i)) { 
        // Allow specific simple predefined terms like numbers (0,1,2,3) or booleans.
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

// Tries to interpret an ASTNode as a Church numeral.
// Returns the numeral value (e.g., 0, 1, 15) or null if it's not a Church numeral.
function tryGetChurchNumeralValue(node: ASTNode): number | null {
  if (node.type !== 'lambda') return null;
  const lambdaF = node;

  if (lambdaF.body.type !== 'lambda') return null;
  const lambdaX = lambdaF.body;

  const fParamName = lambdaF.param;
  const xParamName = lambdaX.param;

  let currentBody = lambdaX.body;
  let count = 0;

  // Max count to prevent infinite loops on malformed structures or very large N
  const MAX_CHURCH_APPLICATIONS = 200; 

  while (count <= MAX_CHURCH_APPLICATIONS) {
    if (currentBody.type === 'variable' && currentBody.name === xParamName) {
      // Reached the innermost 'x'
      return count;
    }
    if (
      currentBody.type === 'application' &&
      currentBody.func.type === 'variable' &&
      currentBody.func.name === fParamName
    ) {
      // It's an application of 'f'
      count++;
      currentBody = currentBody.arg; // Move to the argument of 'f'
    } else {
      // Structure does not match f(...), so not a simple Church numeral
      return null;
    }
  }
  // Exceeded max applications, likely not a Church numeral or too large to prettify this way
  return null; 
}


export function prettifyAST(
  node: ASTNode | null,
  customExpressions: NamedExpression[],
  predefinedExpressionsForContext: NamedExpression[]
): string {
  if (!node) {
    return "";
  }

  // Attempt to recognize if the entire AST is a Church numeral
  const numeralValue = tryGetChurchNumeralValue(node);
  if (numeralValue !== null) {
    return `_${numeralValue}`;
  }

  // If the node itself was originally an _N input (e.g. user typed _7), prioritize that.
  // This handles cases where print() might not produce _N if N > 3 or if it's not top-level.
  if (node.sourcePrimitiveName && /^_\d+$/.test(node.sourcePrimitiveName)) {
    return node.sourcePrimitiveName;
  }

  let currentPrintedString = print(node, 'top');
  
  const allProcessableTerms = getProcessedNamedTerms(customExpressions, predefinedExpressionsForContext);

  for (const term of allProcessableTerms) {
    if (term.printedLambda.length === 0) continue;

    // Replace all occurrences of the term's canonical printed form with _TERM_NAME
    currentPrintedString = currentPrintedString.split(term.printedLambda).join(`_${term.name}`);
  }

  return currentPrintedString;
}

