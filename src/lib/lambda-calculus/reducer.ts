import type { ASTNode, Variable, Lambda, Application } from './types';
import { generateNodeId } from './types';
import { print } from './printer'; // For debugging

// Deep copy AST, generating new IDs
function cloneAST(node: ASTNode): ASTNode {
  const newNode = { ...node, id: generateNodeId() } as ASTNode; // Shallow copy base, new ID
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
    switch (node.type) {
      case 'variable':
        return node.name === oldName ? { ...node, name: newName, id: generateNodeId() } : { ...node, id: generateNodeId() };
      case 'lambda':
        // If the lambda binds the oldName, don't substitute inside, but also don't recurse if it binds newName to avoid capture
        if (node.param === oldName || node.param === newName) {
            // If it binds newName, this newName is now "shadowed", so we must rename this inner lambda's param first
            // This case is complex and for a simpler alpha conversion, we assume newName is globally fresh enough
            // For now, if it binds oldName, substitution stops here for this branch.
            // if it binds newName, we should ideally rename node.param to something else too.
            // For robust alpha conversion, ensure newName is truly fresh relative to FV(body of this inner lambda).
            return { ...node, body: node.param === oldName ? cloneAST(node.body) : substituteInBody(node.body, oldName, newName), id: generateNodeId() };
        }
        return { ...node, body: substituteInBody(node.body, oldName, newName), id: generateNodeId() };
      case 'application':
        return {
          ...node,
          id: generateNodeId(),
          func: substituteInBody(node.func, oldName, newName),
          arg: substituteInBody(node.arg, oldName, newName),
        };
    }
  }
  return {
    ...lambdaNode,
    id: generateNodeId(),
    param: newParamName,
    body: substituteInBody(lambdaNode.body, lambdaNode.param, newParamName),
  };
}


let freshVarCounter = 0;
function generateFreshVar(base: string, avoid: Set<string>): string {
  let newName = `${base}${freshVarCounter++}`;
  while (avoid.has(newName)) {
    newName = `${base}${freshVarCounter++}`;
  }
  return newName;
}

// Substitute `replacement` for `varName` in `node`
function substitute(node: ASTNode, varName: string, replacement: ASTNode, boundInReplacementContext: Set<string> = new Set()): ASTNode {
  switch (node.type) {
    case 'variable':
      return node.name === varName ? cloneAST(replacement) : { ...node, id: generateNodeId() };
    case 'lambda':
      if (node.param === varName) { // Variable is bound by this lambda, no substitution in body
        return { ...node, id: generateNodeId(), body: cloneAST(node.body) };
      }
      // Capture avoidance: if node.param is free in `replacement`
      const fvReplacement = getFreeVariables(replacement, boundInReplacementContext);
      if (fvReplacement.has(node.param)) {
        // Alpha-convert `node` to use a fresh parameter name
        const combinedAvoidSet = new Set([...getFreeVariables(node.body), ...fvReplacement, varName]);
        const freshName = generateFreshVar(node.param, combinedAvoidSet);
        const alphaConvertedLambda = alphaConvert(node, freshName);
        return {
          ...alphaConvertedLambda,
          id: generateNodeId(),
          body: substitute(alphaConvertedLambda.body, varName, replacement, boundInReplacementContext),
        };
      }
      // No capture, proceed with substitution in body
      const newBoundInContext = new Set(boundInReplacementContext);
      newBoundInContext.add(node.param);
      return { ...node, id: generateNodeId(), body: substitute(node.body, varName, replacement, newBoundInContext) };
    case 'application':
      return {
        ...node,
        id: generateNodeId(),
        func: substitute(node.func, varName, replacement, boundInReplacementContext),
        arg: substitute(node.arg, varName, replacement, boundInReplacementContext),
      };
  }
}

// Perform one step of beta-reduction (leftmost outermost)
export function reduceStep(node: ASTNode): { newAst: ASTNode; changed: boolean; redexId?: ASTNodeId } {
  freshVarCounter = 0; // Reset fresh variable counter for each reduction step for deterministic fresh names (if base is same)
  
  // Mark all nodes as not redex initially
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
  clearRedexMarks(node);


  function findAndReduce(currentNode: ASTNode): { newAst: ASTNode; changed: boolean; redexId?: ASTNodeId } {
    if (currentNode.type === 'application') {
      // Case 1: (λx.M) N  (redex)
      if (currentNode.func.type === 'lambda') {
        currentNode.isRedex = true;
        currentNode.func.isRedex = true; // Mark the lambda part of redex
        // currentNode.arg.isRedex = true; // Optionally mark argument
        const reducedBody = substitute(currentNode.func.body, currentNode.func.param, currentNode.arg);
        return { newAst: reducedBody, changed: true, redexId: currentNode.id };
      }
      
      // Case 2: Try to reduce in the function part
      const funcReduction = findAndReduce(currentNode.func);
      if (funcReduction.changed) {
        return { newAst: { ...currentNode, func: funcReduction.newAst, id: generateNodeId() }, changed: true, redexId: funcReduction.redexId };
      }

      // Case 3: Try to reduce in the argument part
      const argReduction = findAndReduce(currentNode.arg);
      if (argReduction.changed) {
        return { newAst: { ...currentNode, arg: argReduction.newAst, id: generateNodeId() }, changed: true, redexId: argReduction.redexId };
      }
    } else if (currentNode.type === 'lambda') {
      // Case 4: Try to reduce in the body of a lambda
      const bodyReduction = findAndReduce(currentNode.body);
      if (bodyReduction.changed) {
        return { newAst: { ...currentNode, body: bodyReduction.newAst, id: generateNodeId() }, changed: true, redexId: bodyReduction.redexId };
      }
    }
    // No reduction possible in this branch
    return { newAst: currentNode, changed: false };
  }
  
  return findAndReduce(node);
}
