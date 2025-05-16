
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateTrompDiagramData, TrompDiagramRenderData } from '@/lib/lambda-calculus/tromp-diagram/renderer';
import type { SvgElementData } from '@/lib/lambda-calculus/tromp-diagram/tromp-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

const DEFAULT_SCALE = 20;
const MIN_SCALE = 5;
const MAX_SCALE = 50;

const primitiveColors: Record<string, string> = {
  // Church Numerals like _0, _1, _2 ...
  "_0": "hsl(var(--ast-variable-bg))", // Example color for ZERO
  "_1": "hsl(var(--ast-variable-bg))",
  "_2": "hsl(var(--ast-variable-bg))",
  "_3": "hsl(var(--ast-variable-bg))",
  // Add more numerals or a pattern if needed
  
  // Boolean Logic
  "_TRUE": "hsl(var(--ast-lambda-fg))",
  "_FALSE": "hsl(var(--ast-application-fg))",
  "_NOT": "hsl(var(--ring))", // A different accent
  "_AND": "hsl(var(--secondary))",
  "_OR": "hsl(var(--secondary-foreground))", // Careful with fg/bg usage

  // Arithmetic
  "_SUCC": "hsl(var(--ast-lambda-bg))",
  "_PLUS": "hsl(var(--ast-application-bg))",
  "_MULT": "hsl(var(--destructive))",
  "_POW": "hsl(var(--primary))",

  // Combinators
  "_ID": "hsl(var(--muted-foreground))",
  "_Y-COMB": "hsl(var(--accent))",

  // Add custom terms dynamically if possible, or pre-define common ones
  // For example, if a user defines _MYFUNC, it won't have a color here unless added.
};

// Helper to get color for a primitive
function getPrimitiveColor(primitiveName?: string): string | undefined {
    if (!primitiveName) return undefined;

    // Direct match
    if (primitiveColors[primitiveName]) {
        return primitiveColors[primitiveName];
    }
    // Match for church numerals _N
    if (/^_\d+$/.test(primitiveName)) {
        // Use a consistent color for all numerals not explicitly listed, or a hash-based one
        return primitiveColors["_0"] || "hsl(var(--ast-variable-bg))"; // Default to _0's color or a fallback
    }
    return undefined; // Default (will use foreground)
}


export function TrompDiagramVisualizer() {
  const { currentAST, isLoading: contextIsLoading, error: contextError } = useLambda();
  const [diagramData, setDiagramData] = useState<TrompDiagramRenderData | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);

  useEffect(() => {
    if (currentAST) {
      setInternalLoading(true);
      setInternalError(null);
      requestAnimationFrame(() => {
        try {
          const data = generateTrompDiagramData(currentAST, scale);
          setDiagramData(data);
        } catch (e: any) {
          console.error("Error generating Tromp diagram:", e);
          setInternalError(e.message || "Failed to generate Tromp diagram.");
          setDiagramData(null);
        } finally {
          setInternalLoading(false);
        }
      });
    } else {
      setDiagramData(null);
      setInternalError(null);
    }
  }, [currentAST, scale]);

  const isLoading = contextIsLoading || internalLoading;
  const error = contextError || internalError;

  const memoizedSvgElements = useMemo(() => {
    if (!diagramData) return [];
    return diagramData.svgElements.map((el: SvgElementData) => {
      const strokeW = 1 / scale; 
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
    });
  }, [diagramData, scale]);


  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4">
        <CardTitle className="text-xl font-semibold">Tromp Diagram</CardTitle>
        <div className="w-1/3 min-w-[200px]">
          <Label htmlFor="tromp-scale" className="text-xs text-muted-foreground mr-2">Scale: {scale.toFixed(0)}</Label>
          <Slider
            id="tromp-scale"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={1}
            value={[scale]}
            onValueChange={(value) => setScale(value[0])}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full p-1" viewportClassName="flex items-center justify-center">
          {isLoading && (
            <div className="space-y-4 w-full p-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {error && !diagramData && ( 
            <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
              <AlertTriangle className="w-12 h-12 mb-3" />
              <p className="text-lg">Error generating diagram.</p>
              <p className="text-xs text-muted-foreground max-w-md">{error}</p>
            </div>
          )}
          {!isLoading && !error && !currentAST && (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Info className="w-10 h-10 mb-3" />
                <p className="text-lg">Enter a Lambda Calculus expression.</p>
            </div>
          )}
           {!isLoading && !error && currentAST && !diagramData && !internalError && ( 
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Info className="w-10 h-10 mb-3" />
                <p className="text-lg">Diagram will appear here.</p>
            </div>
          )}
          {diagramData && diagramData.svgElements.length > 0 && (
            <svg
              width={diagramData.actualWidthPx}
              height={diagramData.actualHeightPx}
              viewBox={diagramData.viewBox}
              xmlns="http://www.w3.org/2000/svg"
              className="transition-all duration-100 ease-in-out border border-dashed border-border"
              preserveAspectRatio="xMidYMid meet"
            >
              <g transform="translate(0.5 0.5)"> 
                {memoizedSvgElements}
              </g>
            </svg>
          )}
           {diagramData && diagramData.svgElements.length === 0 && !isLoading && !error && (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Info className="w-10 h-10 mb-3" />
                <p className="text-lg">Diagram is empty for this expression.</p>
                <p className="text-xs">(Perhaps a single variable?)</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
