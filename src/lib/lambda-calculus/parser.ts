
import type { ASTNode, Variable, Lambda, Application } from './types';
import { generateNodeId } from './types';

// Basic tokenizer
function tokenize(input: string): string[] {
  const sanitizedInput = input.replace(/[λL]/g, '\\'); // Normalize lambda symbols (λ, L) to '\'
  // Regex to match lambda symbol '\', parentheses '()', dot '.', or variable names.
  // Variable names are sequences of letters, numbers, underscore, or apostrophe, starting with a letter or underscore.
  const regex = /(\\)|(\()|(\))|(\.)|([a-zA-Z_][a-zA-Z0-9_']*)/g;
  const tokens: string[] = [];
  let match;
  // Iterate over all matches in the input string
  while ((match = regex.exec(sanitizedInput)) !== null) {
    // match[0] contains the matched token
    if (match[0]) { // Ensure the matched token is not empty
        tokens.push(match[0]);
    }
  }
  return tokens; // The regex is designed to only match valid tokens.
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
    const right = parseTerm();
    left = { type: 'application', func: left, arg: right, id: generateNodeId() };
  }
  return left;
}


export function parse(input: string): ASTNode {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error("Input expression cannot be empty or is not a string.");
  }
  tokens = tokenize(input);
  currentTokenIndex = 0;

  if (tokens.length === 0 && input.trim().length > 0) {
    throw new Error(`Could not tokenize input: "${input}". No valid tokens found.`);
  }
   if (tokens.length === 0 && input.trim().length === 0) {
    throw new Error("Input expression is empty after sanitization or consists only of whitespace.");
  }


  const ast = parsePrimaryExpressionSequence();

  if (currentTokenIndex < tokens.length) {
    throw new Error(`Unexpected token "${peek()}" after parsing. Remaining tokens: ${tokens.slice(currentTokenIndex).join(' ')}`);
  }
  return ast;
}
