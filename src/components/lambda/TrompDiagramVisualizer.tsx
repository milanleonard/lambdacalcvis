
"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateTrompDiagramData, TrompDiagramRenderData } from '@/lib/lambda-calculus/tromp-diagram/renderer';
import type { SvgElementData } from '@/lib/lambda-calculus/tromp-diagram/tromp-types';
import type { ASTNodeId } from '@/lib/lambda-calculus/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info } from 'lucide-react';

const primitiveColors: Record<string, string> = {
  "_0": "hsl(var(--ast-variable-bg))",
  "_1": "hsl(var(--ast-variable-bg))",
  "_2": "hsl(var(--ast-variable-bg))",
  "_3": "hsl(var(--ast-variable-bg))",
  "_TRUE": "hsl(var(--ast-lambda-fg))",
  "_FALSE": "hsl(var(--ast-application-fg))",
  "_NOT": "hsl(var(--ring))", // Using ring color for NOT, can be adjusted
  "_AND": "hsl(var(--secondary))",
  "_OR": "hsl(var(--secondary-foreground))", // Might be hard to see on dark bg, consider alt
  "_SUCC": "hsl(var(--ast-lambda-bg))",
  "_PLUS": "hsl(var(--ast-application-bg))",
  "_MULT": "hsl(var(--destructive))",
  "_POW": "hsl(var(--primary))",
  "_ID": "hsl(var(--muted-foreground))",
  "_Y-COMB": "hsl(var(--accent))",
};

function getPrimitiveColor(primitiveName?: string): string | undefined {
    if (!primitiveName) return undefined;
    if (primitiveColors[primitiveName]) {
        return primitiveColors[primitiveName];
    }
    // Fallback for _N where N > 3 or other _Names not in primitiveColors
    if (/^_\d+$/.test(primitiveName)) { // For _4, _5 etc.
        return primitiveColors["_0"] || "hsl(var(--ast-variable-bg))";
    }
    return undefined; // Default if no match
}

const HIGHLIGHT_COLOR = "hsl(var(--ast-highlight-bg))";
const SECONDARY_HIGHLIGHT_COLOR = "hsl(var(--ring))"; // Example: Use ring color for secondary
const DEFAULT_STROKE_COLOR = "hsl(var(--foreground))";

export function TrompDiagramVisualizer() {
  const { currentAST, isLoading: contextIsLoading, error: contextError, highlightedRedexId } = useLambda();
  const [diagramData, setDiagramData] = useState<TrompDiagramRenderData | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [autoScale, setAutoScale] = useState<number>(10); // Default scale

  // Effect for observing container size
  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    resizeObserver.observe(currentContainer);
    // Initial size
    const { width, height } = currentContainer.getBoundingClientRect();
    setContainerSize({ width, height });
    
    return () => resizeObserver.disconnect();
  }, []);

  // Effect for generating diagram data when AST, size, or redex ID changes
  useEffect(() => {
    if (currentAST && containerSize.width > 0 && containerSize.height > 0) {
      setInternalLoading(true);
      setInternalError(null);
      try {
        // First pass to get grid units (scale = 1 for this)
        const initialDiagramData = generateTrompDiagramData(currentAST, 1, highlightedRedexId);

        if (!initialDiagramData || initialDiagramData.widthInGridUnits <= 0 || initialDiagramData.heightInGridUnits <= 0) {
          // Handle cases like single variable which might have 0x0 grid initially, or error.
          setDiagramData(initialDiagramData); // Still set it, might contain error or be empty
          setInternalLoading(false);
          setAutoScale(10); // Reset scale
          return;
        }

        const { widthInGridUnits, heightInGridUnits } = initialDiagramData;
        
        // Calculate scale to fit, with padding
        const padding = 0.90; // Use 90% of available space
        const scaleX = (containerSize.width * padding) / widthInGridUnits;
        const scaleY = (containerSize.height * padding) / heightInGridUnits;
        const calculatedScale = Math.max(1, Math.min(scaleX, scaleY)); // Ensure scale is at least 1

        setAutoScale(calculatedScale); // Store the calculated scale for stroke width adjustments

        // Second pass with the calculated scale
        const finalDiagramData = generateTrompDiagramData(currentAST, calculatedScale, highlightedRedexId);
        setDiagramData(finalDiagramData);

      } catch (e: any) {
        console.error("Error generating Tromp diagram:", e);
        setInternalError(e.message || "Failed to generate Tromp diagram.");
        setDiagramData(null);
      } finally {
        setInternalLoading(false);
      }
    } else if (!currentAST) {
      // Clear diagram if no AST
      setDiagramData(null);
      setInternalError(null);
      setAutoScale(10); // Reset scale
    }
  }, [currentAST, containerSize, highlightedRedexId]);


  const isLoading = contextIsLoading || internalLoading;
  const error = contextError || internalError;

  const memoizedSvgElements = useMemo(() => {
    if (!diagramData) return [];
    
    // Adjust stroke width based on the autoScale, aiming for a visually consistent thickness.
    // Max ensures it's not too thin on very large scales. Min ensures it's visible.
    const baseStrokeW = Math.max(0.02, 1 / autoScale); 
    const highlightedStrokeW = Math.max(0.04, 2 / autoScale); // Highlighted lines slightly thicker

    return diagramData.svgElements.map((el: SvgElementData) => {
      let strokeColor = getPrimitiveColor(el.sourcePrimitiveName) || DEFAULT_STROKE_COLOR;
      let currentStrokeWidth = baseStrokeW;

      if (el.isHighlighted) {
        strokeColor = HIGHLIGHT_COLOR;
        currentStrokeWidth = highlightedStrokeW;
      } else if (el.isSecondaryHighlight) {
        strokeColor = SECONDARY_HIGHLIGHT_COLOR;
        currentStrokeWidth = highlightedStrokeW * 0.8; // Slightly thinner than primary highlight
      }
      
      const commonProps = {
        stroke: strokeColor, 
        strokeWidth: currentStrokeWidth,
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
            className="transition-all duration-200" // For color/stroke changes
          >
            {/* Tooltip for line: shows name if it's a lambda bar, or primitive */}
            {el.title && <title>{el.title} (Primitive: {el.sourcePrimitiveName || 'N/A'})</title>}
            {!el.title && el.sourcePrimitiveName && <title>Primitive: {el.sourcePrimitiveName}</title>}
          </line>
        );
      } else if (el.type === 'polyline') {
        return (
          <polyline
            key={el.key}
            points={el.points}
            {...commonProps}
            className="transition-all duration-200" // For color/stroke changes
          >
             {/* Tooltip for polyline: shows primitive */}
             {el.sourcePrimitiveName && <title>Primitive: {el.sourcePrimitiveName}</title>}
          </polyline>
        );
      }
      return null;
    });
  }, [diagramData, autoScale]);


  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 shrink-0">
        <CardTitle className="text-xl font-semibold">Tromp Diagram</CardTitle>
      </CardHeader>
      <CardContent ref={containerRef} className="flex-grow overflow-hidden p-0"> {/* Ensure p-0 if ScrollArea handles padding */}
        <ScrollArea className="h-full w-full" viewportClassName="flex items-center justify-center">
          {isLoading && (
            <div className="space-y-4 w-full p-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
          {error && !diagramData && ( // Only show major error if no diagram data at all
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
           {/* Case where AST is present, but diagram might be empty or couldn't generate (e.g. single var might be empty) */}
           {!isLoading && !error && currentAST && !diagramData && !internalError && ( 
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Info className="w-10 h-10 mb-3" />
                <p className="text-lg">Diagram will appear here.</p>
            </div>
          )}
          {diagramData && diagramData.svgElements.length > 0 && (
            <svg
              // Key ensures re-mount on AST change for fade-in. Include redexId for highlight changes.
              key={`${currentAST?.id}-${highlightedRedexId || 'no-highlight'}`} 
              width={diagramData.actualWidthPx}
              height={diagramData.actualHeightPx}
              viewBox={diagramData.viewBox}
              xmlns="http://www.w3.org/2000/svg"
              className="transition-opacity duration-300 ease-in-out border border-dashed border-border animate-trompDiagramFadeIn"
              preserveAspectRatio="xMidYMid meet" // Ensures diagram scales to fit its allocated SVG space
            >
              {/* Group for global transform if needed, also for consistent stroke scaling */}
              <g transform="translate(0.5 0.5)"> {/* Offset by 0.5px for sharper lines */}
                {memoizedSvgElements}
              </g>
            </svg>
          )}
           {/* Case: Diagram data exists but has no elements (e.g., single variable) */}
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
