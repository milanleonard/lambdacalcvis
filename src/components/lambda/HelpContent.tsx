
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from 'next/image';

export function HelpContent() {
  return (
    <ScrollArea className="h-full w-full p-1">
      <div className="space-y-6 p-4 max-w-4xl mx-auto">
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
                <li><strong>Lambda Abstraction (<code>λx.M</code>):</strong> Represented by a horizontal bar. The variable <code>x</code> is "bound" or "introduced" at this bar (its name might appear above it). The body <code>M</code> is drawn below.</li>
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
              <h4 className="font-semibold text-lg mb-1">Example Diagrams (Illustrative):</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="border p-2 rounded-md bg-card-foreground/5">
                  <p className="font-medium text-center">_ID (<code>λx.x</code>)</p>
                  <div className="flex justify-center items-center h-32">
                    <Image src="https://placehold.co/150x100.png" alt="Tromp Diagram for ID" width={150} height={100} data-ai-hint="lambda calculus diagram" className="rounded"/>
                  </div>
                  <p className="text-xs text-center mt-1">A simple horizontal bar for λx, and a vertical line connecting x in the body back to the bar.</p>
                </div>
                <div className="border p-2 rounded-md bg-card-foreground/5">
                  <p className="font-medium text-center">_0 (<code>λf.λx.x</code>)</p>
                   <div className="flex justify-center items-center h-32">
                    <Image src="https://placehold.co/200x150.png" alt="Tromp Diagram for Church Numeral 0" width={200} height={150} data-ai-hint="lambda calculus zero" className="rounded"/>
                  </div>
                  <p className="text-xs text-center mt-1">Two nested lambda bars (for f and x). The body 'x' connects directly to the inner λx bar.</p>
                </div>
                <div className="border p-2 rounded-md bg-card-foreground/5">
                  <p className="font-medium text-center">_NOT (<code>λp.p _FALSE _TRUE</code>) - conceptual</p>
                  <div className="flex justify-center items-center h-32">
                     <Image src="https://placehold.co/300x200.png" alt="Tromp Diagram for NOT (conceptual)" width={300} height={200} data-ai-hint="lambda calculus NOT" className="rounded"/>
                  </div>
                  <p className="text-xs text-center mt-1">A lambda bar for 'p'. Below it, an application structure for 'p _FALSE', then its result applied to '_TRUE'.</p>
                </div>
                 <div className="border p-2 rounded-md bg-card-foreground/5">
                  <p className="font-medium text-center">_3 (<code>λf.λx.f(f(fx))</code>) - conceptual</p>
                  <div className="flex justify-center items-center h-32">
                     <Image src="https://placehold.co/300x250.png" alt="Tromp Diagram for Church Numeral 3 (conceptual)" width={300} height={250} data-ai-hint="lambda calculus three" className="rounded"/>
                  </div>
                  <p className="text-xs text-center mt-1">Shows nested applications of 'f' connecting back to the λf bar, and 'x' connecting to λx bar.</p>
                </div>
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

