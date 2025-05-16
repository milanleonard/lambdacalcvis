
import type { ASTNode, Lambda, Application } from './types';

// Determines if parentheses are needed around a node in a given context.
function needsParentheses(node: ASTNode, context: 'func' | 'arg' | 'body' | 'top'): boolean {
  if (node.type === 'lambda' && (context === 'func' || context === 'arg')) return true;
  if (node.type === 'application' && context === 'arg') return true;
  if (node.type === 'application' && context === 'func') return true;
  return false;
}

// --- Canonical Printing Logic ---

interface PrintState {
  canonicalVarCounter: number;
  // Maps original_param_name bound in the current print recursion
  // to its canonical_param_name (e.g., @a, @b)
  boundVarsMap: Map<string, string>;
}

function getCanonicalVarName(index: number): string {
  // Using a simple scheme like @a, @b, ... then @10, @11 for deeper nesting
  // to avoid conflicts with typical single-letter variable names.
  if (index < 26) {
    return `@${String.fromCharCode('a'.charCodeAt(0) + index)}`;
  }
  return `@${index}`; // Fallback for very deep nesting
}

// Internal recursive print function that produces a canonical representation.
function _printRecursive(
  node: ASTNode,
  context: 'func' | 'arg' | 'body' | 'top',
  state: PrintState // Passed effectively by reference
): string {
  // If the node is tagged as a specific Church numeral (e.g., _7, _10), print that name directly.
  // This bypasses canonical renaming for its internal structure, treating _N as an atom.
  if (node.sourcePrimitiveName && /^_\d+$/.test(node.sourcePrimitiveName)) {
    const numeralName = node.sourcePrimitiveName;
    return needsParentheses(node, context) ? `(${numeralName})` : numeralName;
  }

  let result = '';
  switch (node.type) {
    case 'variable':
      // If the variable name is in boundVarsMap, it's a bound variable from an enclosing lambda
      // encountered during this specific print call; use its canonical name.
      // Otherwise, it's a free variable or a sourcePrimitiveName that's not _N.
      result = state.boundVarsMap.get(node.name) || node.name;
      break;
    case 'lambda':
      const lambdaNode = node as Lambda;
      const canonicalParamName = getCanonicalVarName(state.canonicalVarCounter);
      state.canonicalVarCounter++; // Increment for the next distinct bound variable

      // Create a new map for the body's scope, inheriting parent scope's mappings.
      // This new map will associate the original lambdaNode.param with its canonicalParamName.
      const bodyBoundVarsMap = new Map(state.boundVarsMap);
      bodyBoundVarsMap.set(lambdaNode.param, canonicalParamName);

      // Temporarily update state.boundVarsMap for the recursive call for the body.
      const originalCallerBoundVarsMap = state.boundVarsMap;
      state.boundVarsMap = bodyBoundVarsMap;

      const bodyStr = _printRecursive(lambdaNode.body, 'body', state);

      // Restore the caller's boundVarsMap. The canonicalVarCounter remains incremented
      // as it tracks unique canonical names across the entire term being printed.
      state.boundVarsMap = originalCallerBoundVarsMap;

      result = `λ${canonicalParamName}.${bodyStr}`;
      break;
    case 'application':
      const appNode = node as Application;
      // The state (counter and map) flows through:
      // The map used for func and arg is the one from the parent scope of the application.
      // The counter is incremented by lambdas within func, and that incremented counter is then used when printing arg.
      const funcStr = _printRecursive(appNode.func, 'func', state);
      const argStr = _printRecursive(appNode.arg, 'arg', state);
      result = `${funcStr} ${argStr}`;
      break;
  }
  return needsParentheses(node, context) ? `(${result})` : result;
}

// The main exported print function.
// It sets up the initial state for canonical printing.
export function print(node: ASTNode, context: 'func' | 'arg' | 'body' | 'top' = 'top'): string {
  const initialState: PrintState = {
    canonicalVarCounter: 0,
    boundVarsMap: new Map(),
  };
  return _printRecursive(node, context, initialState);
}

    