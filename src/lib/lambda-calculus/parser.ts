import type { ASTNode, Variable, Lambda, Application } from './types';
import { generateNodeId } from './types';

// Basic tokenizer
function tokenize(input: string): string[] {
  const sanitizedInput = input.replace(/λ/g, '\\');
  // Add spaces around parentheses and dot for easier splitting, but not if dot is part of a var name (though typically vars are single char)
  // This tokenizer is very basic and expects space-separated tokens or specific symbols.
  const spacedInput = sanitizedInput
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .replace(/\\/g, ' \\ ')
    .replace(/\./g, ' . ');
  return spacedInput.trim().split(/\s+/).filter(token => token.length > 0);
}

// Parser state
let tokens: string[] = [];
let currentTokenIndex = 0;

function peek(): string | null {
  return currentTokenIndex < tokens.length ? tokens[currentTokenIndex] : null;
}

function consume(expectedToken?: string): string {
  const token = tokens[currentTokenIndex];
  if (expectedToken && token !== expectedToken) {
    throw new Error(`Expected token "${expectedToken}" but found "${token}" at index ${currentTokenIndex}`);
  }
  currentTokenIndex++;
  return token;
}

// expr := variable | lambda | application | ( expr )
function parseExpression(): ASTNode {
  const token = peek();
  if (!token) throw new Error("Unexpected end of input");

  if (token === '\\') {
    return parseLambda();
  } else if (token === '(') {
    consume('(');
    let node = parseExpression();
    // Handle applications within parentheses: (M N) or more complex ((M N) P)
    while(peek() !== ')') {
      const arg = parseExpression(); // This might be too greedy. For M N P, it becomes App(M,N) then App(App(M,N),P)
      node = { type: 'application', func: node, arg, id: generateNodeId() };
      if (peek() === null) throw new Error("Missing closing parenthesis for expression");
    }
    consume(')');
    return node;
  } else {
    // Variable or start of an application sequence (e.g., x y z)
    let node: ASTNode = { type: 'variable', name: consume(), id: generateNodeId() };
    // Left-associative application parsing: x y z -> ((x y) z)
    while (peek() !== null && peek() !== ')' && peek() !== '.') {
      const arg = parseExpression(); // This recursive call needs to be careful not to consume too much
      node = { type: 'application', func: node, arg, id: generateNodeId() };
    }
    return node;
  }
}


// Simplified application parsing - assumes M N P is App(App(M,N),P)
// And relies on parentheses for other groupings.
// This is a common challenge in Pratt parsers or recursive descent with operator precedence.
// For simplicity, we'll adjust. The main `parse` function will handle sequences.

function parseTerm(): ASTNode {
  const token = peek();
  if (!token) throw new Error("Unexpected end of input in parseTerm");

  if (token === '\\') {
    return parseLambda();
  } else if (token === '(') {
    consume('(');
    const expr = parsePrimaryExpressionSequence(); // Changed from parseExpression to handle sequence
    consume(')');
    return expr;
  } else {
    // Variable
    return { type: 'variable', name: consume(), id: generateNodeId() };
  }
}

// lambda := \ variable . expr
function parseLambda(): Lambda {
  consume('\\');
  const param = consume(); // Variable name
  if (!param.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) { // Basic variable name validation
      throw new Error(`Invalid parameter name: ${param}`);
  }
  consume('.');
  const body = parsePrimaryExpressionSequence(); // Changed from parseExpression
  return { type: 'lambda', param, body, id: generateNodeId() };
}

// Parses a sequence of terms that form left-associative applications
// e.g. t1 t2 t3  becomes ((t1 t2) t3)
function parsePrimaryExpressionSequence(): ASTNode {
  let left = parseTerm();

  while (peek() !== null && peek() !== ')' && peek() !== '.') {
    const right = parseTerm();
    left = { type: 'application', func: left, arg: right, id: generateNodeId() };
  }
  return left;
}


export function parse(input: string): ASTNode {
  if (!input.trim()) {
    throw new Error("Input expression cannot be empty.");
  }
  tokens = tokenize(input);
  currentTokenIndex = 0;
  
  const ast = parsePrimaryExpressionSequence();

  if (currentTokenIndex < tokens.length) {
    throw new Error(`Unexpected token "${peek()}" after parsing. Remaining tokens: ${tokens.slice(currentTokenIndex).join(' ')}`);
  }
  return ast;
}
