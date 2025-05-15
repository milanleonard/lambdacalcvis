
import type { ASTNode, Variable, Lambda, Application } from './types';
import { generateNodeId } from './types';
import type { NamedExpression } from './predefined'; // Import NamedExpression
import { predefinedExpressions } from './predefined'; // Import predefinedExpressions for use in preprocess


// Basic tokenizer
function tokenize(input: string): string[] {
  const sanitizedInput = input.replace(/[λL]/g, '\\');
  // Adjusted regex to better separate tokens, especially around _NAME patterns
  const regex = /(\\)|(\()|(\))|(\.)|(_[a-zA-Z_][a-zA-Z0-9_']*)|(_\d+)|([a-zA-Z][a-zA-Z0-9_']*)/g;
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
    // Check if it's a _NAME or _NUMBER token, which should have been preprocessed.
    // If they still exist here, it means they were not found during preprocessing (error or literal variable _name).
    if (token.startsWith('_')) {
        // Allow variables to start with underscore if they were not preprocessed (e.g. _myVar if not a defined term)
        // However, parser expects _NAME to be expanded. If it reaches here, it's treated as a var.
        // This behavior is acceptable for now.
    }
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
  if (!param.match(/^[a-zA-Z_][a-zA-Z0-9_']*$/) && !param.match(/^_[a-zA-Z0-9_']*$/) /* allow vars like _temp */) {
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

function generateChurchNumeral(n: number): string {
  if (n < 0) throw new Error("Church numerals are not defined for negative numbers.");
  let applications = 'x';
  for (let i = 0; i < n; i++) {
    applications = `f (${applications})`;
  }
  return `(λf.λx.${applications})`;
}

// Preprocess input to replace _NAME and _NUMBER references
function preprocessInput(input: string, customTerms: NamedExpression[]): string {
  let processedInput = input;
  let changedInIteration = true;
  const maxIterations = 10; // Prevent infinite loops in substitution

  // Phase 1: Substitute dynamic Church numerals _N
  // This regex finds _ followed by one or more digits
  processedInput = processedInput.replace(/\b_(\d+)\b/g, (match, numberStr) => {
    const n = parseInt(numberStr, 10);
    try {
      return generateChurchNumeral(n);
    } catch (e) {
      // If numeral generation fails (e.g., _-1), keep original for parser to handle/error
      return match; 
    }
  });
  
  // Phase 2: Substitute predefined and custom named expressions _NAME
  const allTerms = [...predefinedExpressions, ...customTerms];
  // Iteratively replace to handle nested definitions
  for (let i = 0; i < maxIterations && changedInIteration; i++) {
    changedInIteration = false;
    // This regex finds _ followed by a letter, then letters, numbers, or underscores
    processedInput = processedInput.replace(/\b_([a-zA-Z][a-zA-Z0-9_']*)\b/g, (match, termName) => {
      const term = allTerms.find(t => t.name === termName);
      if (term) {
        changedInIteration = true;
        return `(${term.lambda})`; // Wrap in parentheses to maintain precedence
      }
      return match; // If not found, leave it (parser will treat as variable or error)
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
