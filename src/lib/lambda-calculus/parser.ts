
import type { ASTNode, Variable, Lambda, Application } from './types';
import { generateNodeId } from './types';

// Basic tokenizer
function tokenize(input: string): string[] {
  const sanitizedInput = input.replace(/λ/g, '\\').replace(/L/g, '\\'); // Added .replace(/L/g, '\\')
  // Add spaces around parentheses and dot for easier splitting, but not if dot is part of a var name (though typically vars are single char)
  // This tokenizer is very basic and expects space-separated tokens or specific symbols.
  const spacedInput = sanitizedInput
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .replace(/\\/g, ' \\ ') // Ensure our internal representation '\' is spaced
    .replace(/\.(?!\w)/g, ' . '); // Space around dot unless it's part of an identifier (e.g. x.y, though not common in pure LC var names)
                                // More robustly, ensure dot is spaced if it's for lambda: \x.y vs application x.y (latter invalid syntax typically)
                                // For LC, dot is primarily for lambda abstraction.
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
    throw new Error(`Expected token "${expectedToken}" but found "${token}" at index ${currentTokenIndex}. Input: '${tokens.join(' ')}'`);
  }
  if (currentTokenIndex >= tokens.length) {
    throw new Error(`Unexpected end of input. Expected ${expectedToken ? '"' + expectedToken + '"' : 'more tokens'}.`);
  }
  currentTokenIndex++;
  return token;
}

// expr := variable | lambda | application | ( expr )
// This function was part of an older parsing attempt, replaced by parsePrimaryExpressionSequence and parseTerm
// function parseExpression(): ASTNode { ... }


// term := variable | lambda | ( sequence )
function parseTerm(): ASTNode {
  const token = peek();
  if (!token) throw new Error("Unexpected end of input in parseTerm");

  if (token === '\\') { // Using internal representation '\'
    return parseLambda();
  } else if (token === '(') {
    consume('(');
    const expr = parsePrimaryExpressionSequence(); 
    consume(')');
    return expr;
  } else {
    // Variable
    if (token === '.' || token === ')') throw new Error(`Unexpected token "${token}" when expecting a variable, lambda, or parenthesized expression.`);
    return { type: 'variable', name: consume(), id: generateNodeId() };
  }
}

// lambda := \ variable . sequence
function parseLambda(): Lambda {
  consume('\\'); // Using internal representation '\'
  const paramToken = peek();
  if (!paramToken || paramToken === '.' || paramToken === '(' || paramToken === ')') {
      throw new Error(`Invalid parameter name: expected variable after lambda but found "${paramToken || 'end of input'}"`);
  }
  const param = consume(); 
  if (!param.match(/^[a-zA-Z_][a-zA-Z0-9_']*$/)) { // Allow apostrophes for freshness
      throw new Error(`Invalid parameter name syntax: "${param}"`);
  }
  consume('.');
  const body = parsePrimaryExpressionSequence(); 
  return { type: 'lambda', param, body, id: generateNodeId() };
}

// Parses a sequence of terms that form left-associative applications
// e.g. t1 t2 t3  becomes ((t1 t2) t3)
function parsePrimaryExpressionSequence(): ASTNode {
  let left = parseTerm();

  while (peek() !== null && peek() !== ')' && peek() !== '.') {
    // If the next token is not suitable to start a new term (e.g. another lambda '\' or opening '(', or variable), it's an error.
    // This is implicitly handled by parseTerm() which will throw if it encounters unexpected tokens where it expects a term.
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

