
"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateTrompDiagramData, TrompDiagramRenderData } from '@/lib/lambda-calculus/tromp-diagram/renderer';
import type { SvgElementData } from '@/lib/lambda-calculus/tromp-diagram/tromp-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info } from 'lucide-react';
// Slider and Label are removed as we are implementing auto-scaling
// import { Slider } from "@/components/ui/slider";
// import { Label } from "@/components/ui/label";

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

function getPrimitiveColor(primitiveName?: string): string | undefined {
    if (!primitiveName) return undefined;
    if (primitiveColors[primitiveName]) {
        return primitiveColors[primitiveName];
    }
    if (/^_\d+$/.test(primitiveName)) {
        return primitiveColors["_0"] || "hsl(var(--ast-variable-bg))";
    }
    return undefined;
}

export function TrompDiagramVisualizer() {
  const { currentAST, isLoading: contextIsLoading, error: contextError } = useLambda();
  const [diagramData, setDiagramData] = useState<TrompDiagramRenderData | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [autoScale, setAutoScale] = useState<number>(10); // Initial sensible default

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    resizeObserver.observe(currentContainer);
    // Set initial size
    const { width, height } = currentContainer.getBoundingClientRect();
    setContainerSize({ width, height });
    
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (currentAST && containerSize.width > 0 && containerSize.height > 0) {
      setInternalLoading(true);
      setInternalError(null);
      // requestAnimationFrame not strictly necessary here, but can be kept if complex calcs were added
      try {
        // First pass to get grid units (scale = 1 for this)
        const initialDiagramData = generateTrompDiagramData(currentAST, 1);

        if (!initialDiagramData || initialDiagramData.widthInGridUnits <= 0 || initialDiagramData.heightInGridUnits <= 0) {
          setDiagramData(initialDiagramData); 
          setInternalLoading(false);
          setAutoScale(10); // Reset to default on empty/error
          return;
        }

        const { widthInGridUnits, heightInGridUnits } = initialDiagramData;
        
        const padding = 0.90; // 90% of available space, 5% padding on each side
        const scaleX = (containerSize.width * padding) / widthInGridUnits;
        const scaleY = (containerSize.height * padding) / heightInGridUnits;
        const calculatedScale = Math.max(1, Math.min(scaleX, scaleY)); 

        setAutoScale(calculatedScale);

        const finalDiagramData = generateTrompDiagramData(currentAST, calculatedScale);
        setDiagramData(finalDiagramData);

      } catch (e: any) {
        console.error("Error generating Tromp diagram:", e);
        setInternalError(e.message || "Failed to generate Tromp diagram.");
        setDiagramData(null);
      } finally {
        setInternalLoading(false);
      }
    } else if (!currentAST) {
      setDiagramData(null);
      setInternalError(null);
      setAutoScale(10); // Reset scale
    }
  }, [currentAST, containerSize]); // Rerun when AST or container size changes

  const isLoading = contextIsLoading || internalLoading;
  const error = contextError || internalError;

  const memoizedSvgElements = useMemo(() => {
    if (!diagramData) return [];
    // Stroke width in viewBox units. Aims for ~1px visual thickness.
    // Min 0.02 to prevent it from disappearing if autoScale is huge.
    const strokeW = Math.max(0.02, 1 / autoScale); 
    return diagramData.svgElements.map((el: SvgElementData) => {
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
            className="transition-all duration-200"
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
            className="transition-all duration-200"
          >
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
        {/* Scale slider and label removed */}
      </CardHeader>
      <CardContent ref={containerRef} className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full w-full" viewportClassName="flex items-center justify-center">
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
              key={currentAST?.id} // Key for fade-in animation trigger
              width={diagramData.actualWidthPx}
              height={diagramData.actualHeightPx}
              viewBox={diagramData.viewBox}
              xmlns="http://www.w3.org/2000/svg"
              className="transition-opacity duration-300 ease-in-out border border-dashed border-border animate-trompDiagramFadeIn"
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
