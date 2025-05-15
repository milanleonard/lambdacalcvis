
# LambdaVis: Lambda Calculus Expression Viewer & Evaluator

## 1. Core Objective

LambdaVis is a web-based interactive tool designed to help users input, visualize, and evaluate Lambda Calculus expressions. It aims to provide a clear understanding of lambda expression structures (Abstract Syntax Trees - ASTs) and the step-by-step process of β-reduction.

## 2. Key Features

### 2.1. Expression Input
*   **Manual Input**: A primary text area allows users to type or paste Lambda Calculus expressions.
*   **Lambda Symbol Support**: The parser accepts multiple representations for the lambda symbol:
    *   `λ` (actual lambda character)
    *   `L` (uppercase L)
    *   `\` (backslash)
*   **Flexible Parsing**: The parser is designed to correctly interpret expressions regardless of whitespace between tokens (e.g., `(Lx.x)` is equivalent to `( L x . x )`).
*   **Named Term Substitution**: Users can refer to predefined and custom terms within their expressions using an underscore prefix (e.g., `_ID`, `_TRUE`, `_MY_CUSTOM_TERM`). The parser preprocesses these, replacing them with their corresponding lambda definitions.
*   **Dynamic Church Numeral Generation**: Users can use `_N` (e.g., `_0`, `_1`, `_2`, `_10`) in expressions. The parser dynamically generates the corresponding Church numeral lambda string for these.

### 2.2. Abstract Syntax Tree (AST) Visualization
*   **Dynamic Rendering**: The AST of the currently entered or processed expression is visualized in real-time.
*   **Layout**: The expression input/controls panel and the AST visualization panel are displayed side-by-side.
*   **Node Representation**:
    *   **Variables**: Displayed with their names.
    *   **Lambda Abstractions**: Clearly show the `λ`, the bound parameter, and the body.
    *   **Applications**: Show the function part and the argument part.
*   **Visual Hierarchy**: The tree structure is visually intuitive, showing nesting and relationships.
*   **Node Styling**:
    *   Distinct background and foreground colors for variable, lambda, and application nodes, adhering to the Monokai-like theme.
    *   Rounded corners and shadows for a professional feel.
*   **Redex Highlighting**: During single-step reduction, the specific redex (reducible expression, typically an application of a lambda to an argument) in the AST is visually highlighted.
*   **Animations**: Subtle animations (e.g., fade-in, pulse) are used to indicate changes in the AST upon reduction or new expression input.
*   **Compact Display**:
    *   Node padding and text sizes are optimized for compactness.
    *   Application nodes stack their function and argument vertically to reduce horizontal width and improve visibility of wider trees.

### 2.3. Expression Evaluation & Display
*   **Single-Step Reduction**:
    *   A "Reduce Step" button allows users to perform one β-reduction (leftmost-outermost strategy).
    *   The string representation of the expression after the reduction step is displayed in a dedicated "Current Form" area.
    *   The AST visualization updates to reflect the reduced expression.
    *   The application indicates if the resulting expression is still reducible.
*   **Reduce to Normal Form**:
    *   A "Reduce to Normal Form" button evaluates the expression fully until it reaches its normal form (or a predefined maximum number of steps is exceeded to prevent infinite loops).
    *   The string representation of the final normal form (or the expression at the step limit) is displayed in a dedicated "Normal Form" area.
    *   Toasts/notifications inform the user about the outcome (e.g., "Normal Form Reached", "Max Steps Reached").
*   **Reset Functionality**: A "Reset" button clears the current expression and evaluation state, typically reverting to a default example expression.

### 2.4. Named Expressions (Predefined & Custom Terms)
*   **Predefined Terms Panel**:
    *   A scrollable horizontal panel displays a collection of built-in, commonly used lambda calculus terms.
    *   Examples include: `ID`, `TRUE`, `FALSE`, `NOT`, `AND`, `OR`, Church numerals (`ZERO`, `ONE`, `TWO`, `THREE`), `SUCC` (successor), `PLUS`, `MULT`, `POW` (exponentiation), `Y-COMB` (Y Combinator).
    *   Each term is represented by a button showing its name.
    *   Hovering over a term button displays a tooltip with a brief description and its full lambda string.
    *   Clicking a term button inserts its lambda definition, automatically wrapped in parentheses (e.g., `(λx.x)`), into the main expression input field.
*   **Custom Terms Management**:
    *   **Definition**: A UI section (input fields for "Term Name" and "Lambda Expression") allows users to define their own named lambda expressions.
        *   Input validation for name (e.g., starts with a letter, alphanumeric + underscore) and lambda syntax.
    *   **Storage**: Custom terms are saved in the browser's `localStorage`, persisting across sessions.
    *   **Display**: Custom terms are displayed in the same panel as predefined terms, possibly distinguished by a "Custom" badge.
    *   **Usage**: Custom terms can be referenced in expressions using the `_CUSTOM_NAME` syntax.
    *   **Deletion**: Users can delete their custom terms, typically via a small 'X' icon next to the custom term in the panel. This updates `localStorage` and refreshes the panel and current expression if needed.

### 2.5. User Interface & Styling
*   **Theme**: A Monokai-like theme with a dark background and light foreground text.
*   **Accent Color**: Teal (`#008080`) is used for primary actions, highlights, and important UI elements.
*   **Error Handling**: Clear and user-friendly error messages (e.g., using toast notifications) for:
    *   Invalid lambda expression syntax (parse errors).
    *   Reduction errors.
    *   Errors in custom term definitions.
*   **Responsiveness**: The layout should adapt reasonably to different screen sizes, although primarily designed for desktop use.

## 3. Technical Stack (Implied)
*   **Frontend Framework**: Next.js (App Router) with React.
*   **Language**: TypeScript.
*   **UI Components**: ShadCN UI.
*   **Styling**: Tailwind CSS.
*   **AI/Flows**: Genkit (currently minimal usage for core lambda features, but part of the project structure).

## 4. Lambda Calculus Specifics
*   **Reduction Strategy**: Leftmost-outermost β-reduction.
*   **Alpha Conversion**: Correctly implemented to rename bound variables during substitution to avoid variable capture.
*   **Parsing & Printing**: Robust parsing of lambda expressions and accurate printing (pretty-printing) of ASTs back into string form, including necessary parentheses for maintaining precedence.
*   **AST Node Identification**: Unique IDs for AST nodes to facilitate React rendering and animations.

This document should provide a comprehensive overview of the LambdaVis application's intended features and behavior.
