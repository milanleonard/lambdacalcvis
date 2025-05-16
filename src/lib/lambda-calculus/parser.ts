
import type { ASTNode, Variable, Lambda, Application } from './types';
import { generateNodeId } from './types';
import type { NamedExpression } from './predefined';
import { predefinedExpressions } from './predefined';

// Parser state (scoped to a parse call)
interface ParserState {
  tokens: string[];
  currentTokenIndex: number;
  customTerms: NamedExpression[];
  // To prevent infinite recursion if a primitive's definition refers to itself directly without expansion
  parsingPrimitiveStack: string[]; 
}

function peek(state: ParserState): string | null {
  return state.currentTokenIndex < state.tokens.length ? state.tokens[state.currentTokenIndex] : null;
}

function consume(state: ParserState, expectedToken?: string): string {
  const token = state.tokens[state.currentTokenIndex];
  if (expectedToken && token !== expectedToken) {
    throw new Error(`Expected token "${expectedToken}" but found "${token}" at index ${state.currentTokenIndex}. Input: '${state.tokens.join(' ')}'`);
  }
  if (state.currentTokenIndex >= state.tokens.length) {
    throw new Error(`Unexpected end of input. Expected ${expectedToken ? '"' + expectedToken + '"' : 'more tokens'}.`);
  }
  state.currentTokenIndex++;
  return token;
}

function generateChurchNumeralString(n: number): string {
  if (n < 0) throw new Error("Church numerals are not defined for negative numbers.");
  let applications = 'x';
  for (let i = 0; i < n; i++) {
    applications = `f (${applications})`;
  }
  return `(λf.λx.${applications})`;
}

// Main parsing function for a sequence of terms (handles applications)
function parsePrimaryExpressionSequence(state: ParserState): ASTNode {
  let left = parseTerm(state);

  while (peek(state) !== null && peek(state) !== ')' && peek(state) !== '.') {
    const right = parseTerm(state); // Parse the next term in the sequence
    left = { type: 'application', func: left, arg: right, id: generateNodeId() };
  }
  return left;
}

// Parses a single term (variable, lambda, parenthesized expression, or primitive)
function parseTerm(state: ParserState): ASTNode {
  const token = peek(state);
  if (!token) throw new Error("Unexpected end of input in parseTerm");

  if (token.startsWith('_')) {
    consume(state); // Consume the primitive token

    if (state.parsingPrimitiveStack.includes(token)) {
        // This is a safeguard against simple self-referential primitive definitions like _X = _X
        // More complex recursion is usually handled by Y-combinator etc.
        // For direct parsing, treat as a variable if it's self-recursive during its own definition parsing.
        return { type: 'variable', name: token, id: generateNodeId() };
    }

    // Check for _N (Church numeral)
    if (/^_\d+$/.test(token)) {
      const n = parseInt(token.substring(1), 10);
      const churchString = generateChurchNumeralString(n);
      // Parse the generated string for the Church numeral
      // The new parser state for this sub-parse should inherit customTerms, but have a fresh token stream.
      const numeralAst = parseInternal(churchString, state.customTerms, [...state.parsingPrimitiveStack, token]);
      numeralAst.sourcePrimitiveName = token; // Tag the root
      return numeralAst;
    } else {
      // Check for _NAME (predefined or custom term)
      const allTerms = [...predefinedExpressions, ...state.customTerms];
      const foundTerm = allTerms.find(t => `_${t.name}` === token);
      if (foundTerm) {
        // Parse the lambda string of the found term
        const termAst = parseInternal(foundTerm.lambda, state.customTerms, [...state.parsingPrimitiveStack, token]);
        termAst.sourcePrimitiveName = token; // Tag the root
        return termAst;
      } else {
        // If not a known _N or _NAME, treat as a regular variable starting with _
        return { type: 'variable', name: token, id: generateNodeId() };
      }
    }
  } else if (token === '\\') {
    return parseLambda(state);
  } else if (token === '(') {
    consume(state, '(');
    const expr = parsePrimaryExpressionSequence(state);
    consume(state, ')');
    return expr;
  } else {
    if (token === '.' || token === ')') throw new Error(`Unexpected token "${token}" when expecting a variable, lambda, or parenthesized expression.`);
    return { type: 'variable', name: consume(state), id: generateNodeId() };
  }
}

function parseLambda(state: ParserState): Lambda {
  consume(state, '\\');
  const paramToken = peek(state);
  if (!paramToken || paramToken === '.' || paramToken === '(' || paramToken === ')') {
      throw new Error(`Invalid parameter name: expected variable after lambda but found "${paramToken || 'end of input'}"`);
  }
  const param = consume(state);
  if (!param.match(/^[a-zA-Z_][a-zA-Z0-9_']*$/) && !param.match(/^_[a-zA-Z0-9_']*$/)) {
      throw new Error(`Invalid parameter name syntax: "${param}"`);
  }
  consume(state, '.');
  const body = parsePrimaryExpressionSequence(state);
  return { type: 'lambda', param, body, id: generateNodeId() };
}

// Tokenizer
function tokenize(input: string): string[] {
  const sanitizedInput = input.replace(/[λL]/g, '\\');
  // Regex to capture lambda symbols, parentheses, dots, identifiers (_NAME, _NUMBER, regular vars)
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

// Internal parse function that takes an input string and sets up state
function parseInternal(input: string, customTerms: NamedExpression[], parsingPrimitiveStack: string[] = []): ASTNode {
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error("Input expression cannot be empty or is not a string for internal parse.");
  }
  
  const state: ParserState = {
    tokens: tokenize(input),
    currentTokenIndex: 0,
    customTerms: customTerms,
    parsingPrimitiveStack: parsingPrimitiveStack,
  };

  if (state.tokens.length === 0) {
    throw new Error(`Could not tokenize input: "${input}". No valid tokens found.`);
  }

  const ast = parsePrimaryExpressionSequence(state);

  if (peek(state) !== null) {
    throw new Error(`Unexpected token "${peek(state)}" after parsing. Remaining tokens: ${state.tokens.slice(state.currentTokenIndex).join(' ')}`);
  }
  return ast;
}

// Public parse function
export function parse(input: string, customTerms: NamedExpression[] = []): ASTNode {
   // Preprocessing (minimal, mainly for compatibility if other preprocessing steps were intended)
  // The main logic for _NAME and _N is now handled within parseTerm.
  // We can keep a light version of preprocessInput if necessary for other substitutions or cleanups.
  // For now, directly use the input for parseInternal.
  return parseInternal(input, customTerms, []);
}
