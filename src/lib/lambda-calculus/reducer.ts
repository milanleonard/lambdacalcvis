
import type { ASTNode, Variable, Lambda, Application, ASTNodeId } from './types';
import { generateNodeId } from './types';

// Deep copy AST, generating new IDs and preserving sourcePrimitiveName
export function cloneAST(node: ASTNode): ASTNode {
  const newNode = { ...node, id: generateNodeId() } as ASTNode;
  if (newNode.type === 'lambda') {
    newNode.body = cloneAST(newNode.body);
  } else if (newNode.type === 'application') {
    newNode.func = cloneAST(newNode.func);
    newNode.arg = cloneAST(newNode.arg);
  }
  return newNode;
}

// Get free variables in an expression
function getFreeVariables(node: ASTNode, bound: Set<string> = new Set()): Set<string> {
  switch (node.type) {
    case 'variable':
      return bound.has(node.name) ? new Set() : new Set([node.name]);
    case 'lambda':
      const newBound = new Set(bound);
      newBound.add(node.param);
      return getFreeVariables(node.body, newBound);
    case 'application':
      const fvFunc = getFreeVariables(node.func, bound);
      const fvArg = getFreeVariables(node.arg, bound);
      return new Set([...fvFunc, ...fvArg]);
  }
}

// Alpha conversion: rename bound variable `param` to `newName` in `lambdaNode.body`
function alphaConvert(lambdaNode: Lambda, newParamName: string): Lambda {
  function substituteInBody(node: ASTNode, oldName: string, newName: string): ASTNode {
    const clonedNode = cloneAST(node);
    switch (clonedNode.type) {
      case 'variable':
        if (clonedNode.name === oldName) {
          clonedNode.name = newName;
        }
        return clonedNode;
      case 'lambda':
        if (clonedNode.param === oldName) {
            return clonedNode;
        }
        clonedNode.body = substituteInBody(clonedNode.body, oldName, newName);
        return clonedNode;
      case 'application':
        clonedNode.func = substituteInBody(clonedNode.func, oldName, newName);
        clonedNode.arg = substituteInBody(clonedNode.arg, oldName, newName);
        return clonedNode;
    }
  }
  return {
    ...lambdaNode,
    id: generateNodeId(),
    sourcePrimitiveName: lambdaNode.sourcePrimitiveName,
    param: newParamName,
    body: substituteInBody(lambdaNode.body, lambdaNode.param, newParamName),
  };
}


let freshVarCounter = 0;
function generateFreshVar(base: string, avoid: Set<string>): string {
  let newName = `${base}${freshVarCounter++}`;
  while (avoid.has(newName)) {
    newName = `${base}${freshVarCounter++}${freshVarCounter > 100 ? 'x' : ''}`;
    if (freshVarCounter > 200) {
        console.warn("High freshVarCounter, potential issue in var generation:", base, avoid);
        return `__fresh_${Date.now()}`;
    }
  }
  return newName;
}

// Substitute `replacement` for `varName` in `node`
function substitute(node: ASTNode, varName: string, replacement: ASTNode, boundInReplacementContext: Set<string> = new Set()): ASTNode {
  switch (node.type) {
    case 'variable':
      return node.name === varName ? cloneAST(replacement) : cloneAST(node);
    case 'lambda':
      if (node.param === varName) {
        return cloneAST(node);
      }
      const fvReplacement = getFreeVariables(replacement, boundInReplacementContext);
      if (fvReplacement.has(node.param)) {
        const combinedAvoidSet = new Set([...getFreeVariables(node.body), ...fvReplacement, varName]);
        const freshName = generateFreshVar(node.param, combinedAvoidSet);
        const alphaConvertedLambda = alphaConvert(node, freshName);
        return {
          ...alphaConvertedLambda,
          body: substitute(alphaConvertedLambda.body, varName, replacement, boundInReplacementContext),
        };
      }
      const newBoundInContext = new Set(boundInReplacementContext);
      newBoundInContext.add(node.param);
      return {
          ...cloneAST(node),
          body: substitute(node.body, varName, replacement, newBoundInContext)
        };
    case 'application':
      return {
        ...cloneAST(node),
        func: substitute(node.func, varName, replacement, boundInReplacementContext),
        arg: substitute(node.arg, varName, replacement, boundInReplacementContext),
      };
  }
}

// Perform one step of beta-reduction (leftmost outermost)
// This function now primarily returns the new AST and whether a change occurred.
// The redexId marking is handled by analyzeForRedex for the *next* step's highlighting.
export function reduceStep(inputNode: ASTNode): { newAst: ASTNode; changed: boolean } {
  freshVarCounter = 0;

  // Clone the input node to ensure no mutation of the original AST passed to this function
  const node = cloneAST(inputNode);

  function findAndReduceRecursive(currentNode: ASTNode): { resultNode: ASTNode; changedFlag: boolean } {
    if (currentNode.type === 'application') {
      if (currentNode.func.type === 'lambda') { // This is a redex
        const reducedBody = substitute(currentNode.func.body, currentNode.func.param, currentNode.arg);
        return { resultNode: reducedBody, changedFlag: true };
      }

      const funcReduction = findAndReduceRecursive(currentNode.func);
      if (funcReduction.changedFlag) {
        const newAppNode = { ...cloneAST(currentNode) } as Application; // Clone to get new ID for the app node
        newAppNode.func = funcReduction.resultNode;
        return { resultNode: newAppNode, changedFlag: true };
      }

      const argReduction = findAndReduceRecursive(currentNode.arg);
      if (argReduction.changedFlag) {
        const newAppNode = { ...cloneAST(currentNode) } as Application; // Clone to get new ID
        newAppNode.arg = argReduction.resultNode;
        return { resultNode: newAppNode, changedFlag: true };
      }
    } else if (currentNode.type === 'lambda') {
      const bodyReduction = findAndReduceRecursive(currentNode.body);
      if (bodyReduction.changedFlag) {
        const newLambdaNode = { ...cloneAST(currentNode) } as Lambda; // Clone to get new ID
        newLambdaNode.body = bodyReduction.resultNode;
        return { resultNode: newLambdaNode, changedFlag: true };
      }
    }
    return { resultNode: currentNode, changedFlag: false }; // No reduction found in this branch, return original (cloned) node
  }

  const { resultNode, changedFlag } = findAndReduceRecursive(node);
  return { newAst: resultNode, changed: changedFlag };
}


// New function to analyze an AST (without cloning/mutating) to find the next redex for highlighting.
export function analyzeForRedex(node: ASTNode): { isReducible: boolean; redexId?: ASTNodeId } {
  if (node.type === 'application') {
    if (node.func.type === 'lambda') {
      return { isReducible: true, redexId: node.id }; // Found a redex
    }
    // Check function part first (leftmost)
    const funcAnalysis = analyzeForRedex(node.func);
    if (funcAnalysis.isReducible) {
      return funcAnalysis;
    }
    // If not in function, check argument part
    return analyzeForRedex(node.arg);
  } else if (node.type === 'lambda') {
    // Redex can only be in the body of a lambda
    return analyzeForRedex(node.body);
  }
  // Variables are not reducible
  return { isReducible: false };
}
