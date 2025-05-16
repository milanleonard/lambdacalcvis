
import type { ASTNode, Variable, Lambda, Application, ASTNodeId } from './types';
import { generateNodeId } from './types';
import { print } from './printer'; // For debugging

// Deep copy AST, generating new IDs and preserving sourcePrimitiveName
export function cloneAST(node: ASTNode): ASTNode {
  const newNode = { ...node, id: generateNodeId() } as ASTNode; // Shallow copy base, new ID, copy sourcePrimitiveName
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
    const clonedNode = cloneAST(node); // Clone first to get new ID and preserve original tags
    switch (clonedNode.type) {
      case 'variable':
        if (clonedNode.name === oldName) {
          clonedNode.name = newName;
        }
        return clonedNode;
      case 'lambda':
        // If the lambda's parameter is the one we're renaming, or would capture the new name,
        // it means we're inside a scope that shadows or conflicts.
        // The substitution should not proceed into this lambda's body for `oldName` if `clonedNode.param === oldName`.
        // If `clonedNode.param === newName`, it means this lambda would capture the `newName`,
        // which implies an error in how `generateFreshVar` was called or a very tricky situation.
        // For alpha conversion, we are renaming `lambdaNode.param`.
        // The `substituteInBody` is to update occurrences of `lambdaNode.param` *within its body*.
        if (clonedNode.param === oldName) { // This lambda shadows the var we are renaming, so stop here for this var.
            return clonedNode; 
        }
        // If this lambda's param is `newName`, it would capture. This shouldn't happen if `newParamName` was chosen well.
        // Proceed to substitute in the body.
        clonedNode.body = substituteInBody(clonedNode.body, oldName, newName);
        return clonedNode;
      case 'application':
        clonedNode.func = substituteInBody(clonedNode.func, oldName, newName);
        clonedNode.arg = substituteInBody(clonedNode.arg, oldName, newName);
        return clonedNode;
    }
  }
  return {
    ...lambdaNode, // Copy type, original param (to be replaced), original body (to be transformed)
    id: generateNodeId(),
    sourcePrimitiveName: lambdaNode.sourcePrimitiveName, // Preserve tag
    param: newParamName,
    body: substituteInBody(lambdaNode.body, lambdaNode.param, newParamName),
  };
}


let freshVarCounter = 0;
function generateFreshVar(base: string, avoid: Set<string>): string {
  let newName = `${base}${freshVarCounter++}`;
  while (avoid.has(newName)) {
    newName = `${base}${freshVarCounter++}${freshVarCounter > 100 ? 'x' : ''}`; // Add 'x' if too many attempts
    if (freshVarCounter > 200) { // Emergency break for extreme cases
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
      // If it's the variable we're looking for, return a clone of the replacement.
      // The replacement AST carries its own `sourcePrimitiveName` if it came from a primitive.
      return node.name === varName ? cloneAST(replacement) : cloneAST(node);
    case 'lambda':
      // If the lambda's parameter is the same as the variable we're substituting,
      // it shadows `varName`, so no substitution in the body.
      if (node.param === varName) {
        return cloneAST(node);
      }
      // Capture avoidance:
      // If the lambda's parameter `node.param` is free in `replacement`
      // AND `varName` is free in `node.body` (implicit: we are substituting into `node.body`)
      // then `node.param` would capture free variables in `replacement`.
      const fvReplacement = getFreeVariables(replacement, boundInReplacementContext);
      if (fvReplacement.has(node.param)) {
        // Need to alpha-convert `node` (the lambda).
        const combinedAvoidSet = new Set([...getFreeVariables(node.body), ...fvReplacement, varName]);
        const freshName = generateFreshVar(node.param, combinedAvoidSet);
        const alphaConvertedLambda = alphaConvert(node, freshName); 
        // Now substitute into the body of the alpha-converted lambda.
        return {
          ...alphaConvertedLambda, // id, new param, sourcePrimitiveName are set by alphaConvert
          body: substitute(alphaConvertedLambda.body, varName, replacement, boundInReplacementContext),
        };
      }
      // No capture, proceed to substitute in the body.
      // The new lambda node keeps its original `sourcePrimitiveName`.
      const newBoundInContext = new Set(boundInReplacementContext);
      newBoundInContext.add(node.param);
      return { 
          ...cloneAST(node), // Clone to get new ID, preserves sourcePrimitiveName from original lambda
          body: substitute(node.body, varName, replacement, newBoundInContext) 
        };
    case 'application':
      // Substitute in both function and argument.
      // The new application node keeps its original `sourcePrimitiveName`.
      return {
        ...cloneAST(node), // Clone to get new ID, preserves sourcePrimitiveName from original application
        func: substitute(node.func, varName, replacement, boundInReplacementContext),
        arg: substitute(node.arg, varName, replacement, boundInReplacementContext),
      };
  }
}

// Perform one step of beta-reduction (leftmost outermost)
export function reduceStep(node: ASTNode): { newAst: ASTNode; changed: boolean; redexId?: ASTNodeId } {
  freshVarCounter = 0; 
  
  function clearRedexMarks(currentNode: ASTNode): ASTNode {
    currentNode.isRedex = false;
    if (currentNode.type === 'lambda') {
      clearRedexMarks(currentNode.body);
    } else if (currentNode.type === 'application') {
      clearRedexMarks(currentNode.func);
      clearRedexMarks(currentNode.arg);
    }
    return currentNode;
  }
  const nodeWithoutRedexMarks = cloneAST(node);
  clearRedexMarks(nodeWithoutRedexMarks);


  function findAndReduce(currentNode: ASTNode): { newAst: ASTNode; changed: boolean; redexId?: ASTNodeId } {
    if (currentNode.type === 'application') {
      if (currentNode.func.type === 'lambda') { // This is a redex
        currentNode.isRedex = true;
        currentNode.func.isRedex = true; // Mark the lambda part of the redex
        // currentNode.arg can also be considered part of the redex implicitly

        const reducedBody = substitute(currentNode.func.body, currentNode.func.param, currentNode.arg);
        // The reducedBody inherits sourcePrimitiveName from the original body of the lambda, if any.
        return { newAst: reducedBody, changed: true, redexId: currentNode.id };
      }
      
      // Not a redex at this level, try reducing the function part
      const funcReduction = findAndReduce(currentNode.func);
      if (funcReduction.changed) {
        // If func changed, create new application node. It inherits current node's sourcePrimitiveName.
        const newAppNode = cloneAST(currentNode) as Application;
        newAppNode.func = funcReduction.newAst;
        return { newAst: newAppNode, changed: true, redexId: funcReduction.redexId };
      }

      // Function part didn't change, try reducing the argument part
      const argReduction = findAndReduce(currentNode.arg);
      if (argReduction.changed) {
        // If arg changed, create new application node. It inherits current node's sourcePrimitiveName.
        const newAppNode = cloneAST(currentNode) as Application;
        newAppNode.arg = argReduction.newAst;
        return { newAst: newAppNode, changed: true, redexId: argReduction.redexId };
      }
    } else if (currentNode.type === 'lambda') {
      // Try reducing the body of the lambda
      const bodyReduction = findAndReduce(currentNode.body);
      if (bodyReduction.changed) {
        // If body changed, create new lambda node. It inherits current node's sourcePrimitiveName.
        const newLambdaNode = cloneAST(currentNode) as Lambda;
        newLambdaNode.body = bodyReduction.newAst;
        return { newAst: newLambdaNode, changed: true, redexId: bodyReduction.redexId };
      }
    }
    // No reduction found in this branch
    return { newAst: currentNode, changed: false };
  }
  
  return findAndReduce(nodeWithoutRedexMarks);
}
