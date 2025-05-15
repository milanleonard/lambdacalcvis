
export interface NamedExpression {
  name: string;
  lambda: string;
  description?: string;
}

export const predefinedExpressions: NamedExpression[] = [
  { name: "ID", lambda: "λx.x", description: "Identity function (I)" },
  { name: "TRUE", lambda: "λx.λy.x", description: "Church Boolean True (Kestrel)" },
  { name: "FALSE", lambda: "λx.λy.y", description: "Church Boolean False (Kite)" },
  { name: "NOT", lambda: "λp.p (λx.λy.y) (λx.λy.x)", description: "Boolean NOT (λp.p FALSE TRUE)" },
  { name: "AND", lambda: "λp.λq.p q (λx.λy.y)", description: "Boolean AND (λp.λq.p q FALSE)" },
  { name: "OR", lambda: "λp.λq.p (λx.λy.x) q", description: "Boolean OR (λp.λq.p TRUE q)" },
  { name: "ZERO", lambda: "λf.λx.x", description: "Church Numeral 0" },
  { name: "ONE", lambda: "λf.λx.f x", description: "Church Numeral 1" },
  { name: "TWO", lambda: "λf.λx.f (f x)", description: "Church Numeral 2" },
  { name: "THREE", lambda: "λf.λx.f (f (f x))", description: "Church Numeral 3" },
  { name: "SUCC", lambda: "λn.λf.λx.f (n f x)", description: "Successor: λn.λf.λx.f (n f x)" },
  { name: "PLUS", lambda: "λm.λn.λf.λx.m f (n f x)", description: "Addition: λm.λn.λf.λx.m f (n f x)" },
  { name: "MULT", lambda: "λm.λn.λf.m (n f)", description: "Multiplication: λm.λn.λf.m (n f)" },
  { name: "POW", lambda: "λb.λe.e b", description: "Exponentiation (b^e): λb.λe.e b (base, exponent)"},
  { name: "Y-COMB", lambda: "λf.(λx.f (x x)) (λx.f (x x))", description: "Y Combinator (fixed-point combinator)" },
];
