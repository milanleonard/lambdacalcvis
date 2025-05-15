
import type { ASTNode, Variable, Lambda, Application } from './types';
import { generateNodeId } from './types';
import type { NamedExpression } from './predefined'; // Import NamedExpression
import { predefinedExpressions } from './predefined'; // Import predefinedExpressions for use in preprocess


// Basic tokenizer
function tokenize(input: string): string[] {
  const sanitizedInput = input.replace(/[λL]/g, '\\');
  const regex = /(\\)|(\()|(\))|(\.)|([a-zA-Z_][a-zA-Z0-9_']*)/g;
  const tokens: string[] = [];
  let match;
  while ((match = regex.exec(sanitizedInput)) !== null) {
    if (match[0]) {
        tokens.push(match[0]);
    }
  }
  return tokens;
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

function parseTerm(): ASTNode {
  const token = peek();
  if (!token) throw new Error("Unexpected end of input in parseTerm");

  if (token === '\\') {
    return parseLambda();
  } else if (token === '(') {
    consume('(');
    const expr = parsePrimaryExpressionSequence();
    consume(')');
    return expr;
  } else {
    if (token === '.' || token === ')') throw new Error(`Unexpected token "${token}" when expecting a variable, lambda, or parenthesized expression.`);
    return { type: 'variable', name: consume(), id: generateNodeId() };
  }
}

function parseLambda(): Lambda {
  consume('\\');
  const paramToken = peek();
  if (!paramToken || paramToken === '.' || paramToken === '(' || paramToken === ')') {
      throw new Error(`Invalid parameter name: expected variable after lambda but found "${paramToken || 'end of input'}"`);
  }
  const param = consume();
  if (!param.match(/^[a-zA-Z_][a-zA-Z0-9_']*$/)) {
      throw new Error(`Invalid parameter name syntax: "${param}"`);
  }
  consume('.');
  const body = parsePrimaryExpressionSequence();
  return { type: 'lambda', param, body, id: generateNodeId() };
}

function parsePrimaryExpressionSequence(): ASTNode {
  let left = parseTerm();

  while (peek() !== null && peek() !== ')' && peek() !== '.') {
    const right = parseTerm();
    left = { type: 'application', func: left, arg: right, id: generateNodeId() };
  }
  return left;
}

// Preprocess input to replace _NAME references with their definitions
function preprocessInput(input: string, customTerms: NamedExpression[]): string {
  const allTerms = [...predefinedExpressions, ...customTerms];
  let processedInput = input;
  let changedInIteration = true;

  // Iteratively replace to handle nested definitions, though direct recursion via _NAME isn't supported in definitions themselves
  // This loop primarily ensures that terms defined using other _OTHER_TERMS are expanded.
  // A fixed number of iterations can prevent infinite loops if such a case was allowed. Max 10 levels of nesting.
  for (let i = 0; i < 10 && changedInIteration; i++) {
    changedInIteration = false;
    processedInput = processedInput.replace(/\b_([a-zA-Z][a-zA-Z0-9_']*)\b/g, (match, termName) => {
      const term = allTerms.find(t => t.name === termName);
      if (term) {
        changedInIteration = true;
        return `(${term.lambda})`; // Wrap in parentheses to maintain precedence
      }
      return match; // If not found, leave it as is (parser will likely error or treat as var)
    });
  }
  return processedInput;
}


export function parse(input: string, customTerms: NamedExpression[] = []): ASTNode {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error("Input expression cannot be empty or is not a string.");
  }

  const processedInput = preprocessInput(input, customTerms);
  
  tokens = tokenize(processedInput);
  currentTokenIndex = 0;

  if (tokens.length === 0 && processedInput.trim().length > 0) {
    throw new Error(`Could not tokenize input: "${processedInput}" (after preprocessing from "${input}"). No valid tokens found.`);
  }
  if (tokens.length === 0 && processedInput.trim().length === 0) {
    throw new Error("Input expression is empty after sanitization or consists only of whitespace.");
  }

  const ast = parsePrimaryExpressionSequence();

  if (currentTokenIndex < tokens.length) {
    throw new Error(`Unexpected token "${peek()}" after parsing. Remaining tokens: ${tokens.slice(currentTokenIndex).join(' ')}`);
  }
  return ast;
}
