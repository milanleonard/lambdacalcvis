import type { ASTNode, Lambda, Application } from './types';

function needsParentheses(node: ASTNode, context: 'func' | 'arg' | 'body' | 'top'): boolean {
  if (node.type === 'lambda' && (context === 'func' || context === 'arg')) return true;
  if (node.type === 'application' && context === 'arg') return true;
  // Application as function in another application: (M N) P -> needs parens for (M N)
  if (node.type === 'application' && context === 'func') return true; 
  return false;
}

export function print(node: ASTNode, context: 'func' | 'arg' | 'body' | 'top' = 'top'): string {
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
