
import type { ASTNode, Lambda, Application } from './types';

function needsParentheses(node: ASTNode, context: 'func' | 'arg' | 'body' | 'top'): boolean {
  if (node.type === 'lambda' && (context === 'func' || context === 'arg')) return true;
  if (node.type === 'application' && context === 'arg') return true;
  // Application as function in another application: (M N) P -> needs parens for (M N)
  if (node.type === 'application' && context === 'func') return true; 
  return false;
}

export function print(node: ASTNode, context: 'func' | 'arg' | 'body' | 'top' = 'top'): string {
  // If the node is tagged as a specific Church numeral (e.g., _7, _10), print that name directly.
  if (node.sourcePrimitiveName && /^_\d+$/.test(node.sourcePrimitiveName)) {
    // This string representation is treated like a variable name by needsParentheses
    // if the original node.type requires it.
    const numeralName = node.sourcePrimitiveName;
    // An _N term is atomic, like a variable. It only needs parens if it's, e.g.,
    // an application node itself being used as a function or argument, which an _N term isn't.
    // So, we can usually just return the name.
    // However, the needsParentheses function bases its decision on the node *type*.
    // If node is Lambda { sourcePrimitiveName: "_7" }, needsParentheses(node, 'func') might be true.
    // So, we let needsParentheses decide based on the original node structure.
    return needsParentheses(node, context) ? `(${numeralName})` : numeralName;
  }

  let result = '';
  switch (node.type) {
    case 'variable':
      result = node.name;
      break;
    case 'lambda':
      const lambdaNode = node as Lambda;
      result = `λ${lambdaNode.param}.${print(lambdaNode.body, 'body')}`;
      break;
    case 'application':
      const appNode = node as Application;
      const funcStr = print(appNode.func, 'func');
      const argStr = print(appNode.arg, 'arg');
      result = `${funcStr} ${argStr}`;
      break;
  }
  return needsParentheses(node, context) ? `(${result})` : result;
}

