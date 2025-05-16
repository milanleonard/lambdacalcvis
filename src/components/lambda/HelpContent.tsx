
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parse } from '@/lib/lambda-calculus/parser';
import { generateTrompDiagramData, type TrompDiagramRenderData } from '@/lib/lambda-calculus/tromp-diagram/renderer';
import type { SvgElementData } from '@/lib/lambda-calculus/tromp-diagram/tromp-types';
import type { ASTNode } from '@/lib/lambda-calculus/types';
import { predefinedExpressions } from '@/lib/lambda-calculus/predefined'; // For parser context
import { cn } from "@/lib/utils";

// Primitive colors - consistent with TrompDiagramVisualizer
const primitiveColors: Record<string, string> = {
  "_0": "hsl(var(--ast-variable-bg))",
  "_1": "hsl(var(--ast-variable-bg))",
  "_2": "hsl(var(--ast-variable-bg))",
  "_3": "hsl(var(--ast-variable-bg))",
  "_TRUE": "hsl(var(--ast-lambda-fg))",
  "_FALSE": "hsl(var(--ast-application-fg))",
  "_NOT": "hsl(var(--ring))",
  "_AND": "hsl(var(--secondary))",
  "_OR": "hsl(var(--secondary-foreground))",
  "_SUCC": "hsl(var(--ast-lambda-bg))",
  "_PLUS": "hsl(var(--ast-application-bg))",
  "_MULT": "hsl(var(--destructive))",
  "_POW": "hsl(var(--primary))",
  "_ID": "hsl(var(--muted-foreground))",
  "_Y-COMB": "hsl(var(--accent))",
};

// getPrimitiveColor function - consistent with TrompDiagramVisualizer
function getPrimitiveColor(primitiveName?: string): string | undefined {
    if (!primitiveName) return undefined;
    if (primitiveColors[primitiveName]) {
        return primitiveColors[primitiveName];
    }
    if (/^_\d+$/.test(primitiveName)) { // For _4, _5 etc.
        return primitiveColors["_0"] || "hsl(var(--ast-variable-bg))";
    }
    return undefined;
}

interface StaticTrompDiagramProps {
  termString: string;
  displayName: string;
  targetWidth: number;
  maxHeight: number;
  className?: string;
}

const StaticTrompDiagram: React.FC<StaticTrompDiagramProps> = ({
  termString,
  displayName,
  targetWidth,
  maxHeight,
  className,
}) => {
  const diagramData: TrompDiagramRenderData | null = useMemo(() => {
    try {
      // Pass predefined expressions as context for parsing _ID, _0 etc.
      const ast: ASTNode = parse(termString, predefinedExpressions);

      // First pass to get grid units (scale = 1 for this)
      const initialDiagramData = generateTrompDiagramData(ast, 1);
      if (!initialDiagramData || initialDiagramData.widthInGridUnits <= 0 || initialDiagramData.heightInGridUnits <= 0) {
        return null;
      }

      const { widthInGridUnits, heightInGridUnits } = initialDiagramData;

      const paddingFactor = 0.85; // Use 85% of available space
      const availableWidth = targetWidth * paddingFactor;
      const availableHeight = maxHeight * paddingFactor;

      let calculatedScale = 10; // Default scale
      if (widthInGridUnits > 0 && heightInGridUnits > 0) {
          const scaleX = availableWidth / widthInGridUnits;
          const scaleY = availableHeight / heightInGridUnits;
          calculatedScale = Math.max(1, Math.min(scaleX, scaleY));
      }

      return generateTrompDiagramData(ast, calculatedScale);
    } catch (error) {
      console.error(`Error generating Tromp diagram for ${displayName}:`, error);
      return null;
    }
  }, [termString, displayName, targetWidth, maxHeight]);

  if (!diagramData) {
    return (
      <div className={cn("flex items-center justify-center border rounded-md bg-muted text-destructive text-xs p-2", className)} style={{width: targetWidth, height: maxHeight / 2}}>
        Error generating diagram for {displayName}.
      </div>
    );
  }

  const strokeW = Math.max(0.1, 1 / (diagramData.actualWidthPx / diagramData.widthInGridUnits)); // Adjusted stroke width

  return (
    <div className={cn("flex flex-col items-center border rounded-md p-2 bg-background", className)}>
      <p className="font-medium text-sm mb-1 text-center">{displayName}</p>
      <svg
        width={diagramData.actualWidthPx}
        height={diagramData.actualHeightPx}
        viewBox={diagramData.viewBox}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
        className="border border-dashed border-border"
      >
        <g transform="translate(0.5 0.5)">
          {diagramData.svgElements.map((el: SvgElementData) => {
            const color = getPrimitiveColor(el.sourcePrimitiveName) || "hsl(var(--foreground))";
            const commonProps = {
              stroke: color,
              strokeWidth: strokeW,
              fill: "none",
            };
            if (el.type === 'line') {
              return (
                <line
                  key={el.key}
                  x1={el.x1}
                  y1={el.y1}
                  x2={el.x2}
                  y2={el.y2}
                  {...commonProps}
                >
                  {el.title && <title>{el.title} (Primitive: {el.sourcePrimitiveName || 'N/A'})</title>}
                </line>
              );
            } else if (el.type === 'polyline') {
              return (
                <polyline
                  key={el.key}
                  points={el.points}
                  {...commonProps}
                >
                   {el.sourcePrimitiveName && <title>Primitive: {el.sourcePrimitiveName}</title>}
                </polyline>
              );
            }
            return null;
          })}
        </g>
      </svg>
       <p className="text-xs text-muted-foreground text-center mt-1">
        {termString}
      </p>
    </div>
  );
};


export function HelpContent() {
  return (
    <ScrollArea className="h-full w-full p-1">
      <div className="space-y-6 p-4 max-w-4xl mx-auto help-content">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Welcome to LambdaVis!</CardTitle>
            <CardDescription className="text-lg">
              An interactive tool for visualizing and evaluating Lambda Calculus expressions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              LambdaVis helps you understand the structure of lambda expressions through Abstract Syntax Trees (ASTs)
              and an alternative representation called Tromp diagrams. You can also see expressions reduce step-by-step
              or to their normal form.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">1. Lambda Calculus Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>Lambda Calculus is a foundational system for computation based on function abstraction and application.</p>
            <div>
              <h4 className="font-semibold text-lg mb-1">Core Syntax:</h4>
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong>Variable:</strong> A name, like <code>x</code>, <code>y</code>, <code>f</code>.</li>
                <li><strong>Abstraction (Function Definition):</strong> <code>λx.M</code> (or <code>Lx.M</code>, <code>\\x.M</code> in this tool). This defines a function that takes an argument <code>x</code> and its body is the expression <code>M</code>. <code>x</code> is a bound variable within <code>M</code>.</li>
                <li><strong>Application (Function Call):</strong> <code>M N</code>. This applies the function <code>M</code> to the argument <code>N</code>.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-1">Key Rule: β-Reduction (Beta Reduction)</h4>
              <p>This is the primary computation rule. It describes how to apply a function to an argument:</p>
              <p className="my-2 p-2 bg-muted rounded-md">
                <code>(λx.M) N  →  M[x:=N]</code>
              </p>
              <p>
                This means: in the body <code>M</code> of the lambda function, replace all free occurrences of the bound variable <code>x</code> with the argument expression <code>N</code>.
                Care must be taken to avoid "capturing" free variables in <code>N</code> if they have the same name as a binder in <code>M</code> (this is handled by α-conversion).
              </p>
            </div>
             <div>
              <h4 className="font-semibold text-lg mb-1">α-Conversion (Alpha Conversion)</h4>
              <p>Renaming bound variables. An expression <code>λx.M</code> is equivalent to <code>λy.M[x:=y]</code>, as long as <code>y</code> is not free in <code>M</code> and does not get captured. This tool handles α-conversion automatically during reductions.</p>
              <p className="my-2 p-2 bg-muted rounded-md">
                Example: <code>λx.x</code> is the same as <code>λy.y</code> or <code>λz.z</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">2. Conventions in LambdaVis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h4 className="font-semibold text-lg mb-1">Booleans (Church Booleans):</h4>
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li><code>_TRUE</code> (or <code>λx.λy.x</code>): A function that takes two arguments and returns the first.</li>
                <li><code>_FALSE</code> (or <code>λx.λy.y</code>): A function that takes two arguments and returns the second.</li>
                <li><code>_NOT</code> (or <code>λp.p _FALSE _TRUE</code>): A function that inverts a Church boolean.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-1">Numbers (Church Numerals):</h4>
              <p>Numbers are represented as functions that apply another function a certain number of times.</p>
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li><code>_0</code> (<code>λf.λx.x</code>): Applies <code>f</code> zero times to <code>x</code>.</li>
                <li><code>_1</code> (<code>λf.λx.f x</code>): Applies <code>f</code> one time to <code>x</code>.</li>
                <li><code>_2</code> (<code>λf.λx.f (f x)</code>): Applies <code>f</code> two times to <code>x</code>.</li>
                <li>Generally, <code>_N</code> (<code>λf.λx.fⁿ x</code>): Applies <code>f</code> N times to <code>x</code>.</li>
                <li>LambdaVis allows you to type <code>_N</code> (e.g., <code>_5</code>, <code>_10</code>) directly.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-1">Predefined & Custom Terms:</h4>
               <p>Use <code>_NAME</code> (e.g., <code>_ID</code>, <code>_PLUS</code>, or <code>_MY_FUNC</code> if you define it) to refer to common or custom lambda expressions. Click terms in the panel to insert them.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">3. Understanding Tromp Diagrams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>Tromp diagrams visualize lambda terms as abstract circuits or interaction nets. They emphasize connections and sharing.</p>
            <div>
              <h4 className="font-semibold text-lg mb-1">Key Visual Elements:</h4>
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li><strong>Lambda Abstraction (<code>λx.M</code>):</strong> Represented by a horizontal bar. The variable <code>x</code> is "bound" or "introduced" at this bar. The body <code>M</code> is drawn below.</li>
                <li><strong>Variable Occurrence (<code>x</code>):</strong> A vertical line connecting an occurrence of <code>x</code> back up to the horizontal bar where it was bound.</li>
                <li><strong>Application (<code>M N</code>):</strong> Represented by "hook" or "corner" shapes. The function <code>M</code> and argument <code>N</code> are inputs, and the result is an output.
                  <ul className="list-circle list-inside pl-6 mt-1">
                     <li><code>(┌)</code> shape: Indicates the function part of an application.</li>
                     <li><code>(┐)</code> shape: Indicates the argument part of an application.</li>
                     <li><code>(└┘)</code> or U-shape: Often used at the root of an application, connecting the function and argument results.</li>
                  </ul>
                </li>
              </ul>
              <p className="mt-2">Data generally flows from top-to-bottom and left-to-right. Shared sub-expressions are naturally represented by lines converging.</p>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-1">Example Diagrams:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 items-start">
                <StaticTrompDiagram termString="_ID" displayName="Identity (_ID)" targetWidth={150} maxHeight={120} />
                <StaticTrompDiagram termString="_0" displayName="Church Numeral 0 (_0)" targetWidth={150} maxHeight={120} />
                <StaticTrompDiagram termString="_NOT" displayName="Boolean NOT (_NOT)" targetWidth={200} maxHeight={180} />
                <StaticTrompDiagram termString="_3" displayName="Church Numeral 3 (_3)" targetWidth={200} maxHeight={180} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">4. Using LambdaVis Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li><strong>Expression Input:</strong> Type lambda expressions. Use <code>λ</code>, capital <code>L</code>, or <code>\\</code> for the lambda symbol. Spaces are often optional, e.g., <code>(Lx.x)</code> works.</li>
              <li><strong>Predefined & Custom Terms:</strong> Use <code>_NAME</code> (e.g., <code>_ID</code>, <code>_TRUE</code>, <code>_MY_CUSTOM_TERM</code>) to insert known terms. Click buttons in the panel to insert them.</li>
              <li><strong>Church Numerals:</strong> Type <code>_N</code> (e.g., <code>_0</code>, <code>_5</code>, <code>_42</code>) directly for Church numerals.</li>
              <li><strong>Reduction:</strong>
                <ul>
                  <li>"Reduce Step": Performs one β-reduction (leftmost-outermost).</li>
                  <li>"Reduce to Normal Form": Evaluates until no more reductions are possible (or max steps reached).</li>
                </ul>
              </li>
              <li><strong>Displays:</strong>
                <ul>
                  <li>"Current Form": The expression after the last step-reduction.</li>
                  <li>"Prettified Form": Tries to show the current expression using <code>_NAME</code> for known sub-terms.</li>
                  <li>"Normal Form": The result of full reduction.</li>
                </ul>
              </li>
              <li><strong>Abstract Syntax Tree (AST) Visualizer:</strong>
                <ul>
                  <li>Shows the tree structure of your expression.</li>
                  <li>Pan by dragging, zoom with the mouse wheel.</li>
                  <li>Click the "Home" icon to reset the view.</li>
                  <li>If the entire AST represents a single known term (e.g., <code>_ID</code>, <code>_6</code>), it will display collapsed. Click to expand/re-collapse.</li>
                </ul>
              </li>
              <li><strong>Tromp Diagram Visualizer:</strong>
                <ul>
                  <li>An alternative "circuit-like" visualization.</li>
                  <li>Automatically scales to fit. Colored by originating primitives.</li>
                </ul>
              </li>
              <li><strong>Custom Terms:</strong> Define your own named expressions at the bottom of the input panel. They are saved in your browser. Delete them via the 'X' icon in the terms panel.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
