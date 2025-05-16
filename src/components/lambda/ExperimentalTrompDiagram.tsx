
"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateTrompDiagramData, TrompDiagramRenderData } from '@/lib/lambda-calculus/tromp-diagram/renderer';
import type { SvgElementData } from '@/lib/lambda-calculus/tromp-diagram/tromp-types';
import type { ASTNodeId } from '@/lib/lambda-calculus/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info, Beaker } from 'lucide-react'; // Added Beaker

// Colors and helpers (copied from TrompDiagramVisualizer)
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

const HIGHLIGHT_COLOR = "hsl(var(--ast-highlight-bg))";
const SECONDARY_HIGHLIGHT_COLOR = "hsl(var(--ring))"; 
const DEFAULT_STROKE_COLOR = "hsl(var(--foreground))";


export function ExperimentalTrompDiagram() {
  const { currentAST, isLoading: contextIsLoading, error: contextError, highlightedRedexId } = useLambda();
  const [diagramData, setDiagramData] = useState<TrompDiagramRenderData | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [autoScale, setAutoScale] = useState<number>(10);

  useEffect(() => {
    const currentContainer = containerRef.current;
    if (!currentContainer) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
    });

    resizeObserver.observe(currentContainer);
    const { width, height } = currentContainer.getBoundingClientRect();
    setContainerSize({ width, height });
    
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (currentAST && containerSize.width > 0 && containerSize.height > 0) {
      setInternalLoading(true);
      setInternalError(null);
      try {
        const initialDiagramData = generateTrompDiagramData(currentAST, 1, highlightedRedexId);

        if (!initialDiagramData || initialDiagramData.widthInGridUnits <= 0 || initialDiagramData.heightInGridUnits <= 0) {
          setDiagramData(initialDiagramData); 
          setInternalLoading(false);
          setAutoScale(10); 
          return;
        }

        const { widthInGridUnits, heightInGridUnits } = initialDiagramData;
        
        const padding = 0.90; 
        const scaleX = (containerSize.width * padding) / widthInGridUnits;
        const scaleY = (containerSize.height * padding) / heightInGridUnits;
        const calculatedScale = Math.max(1, Math.min(scaleX, scaleY)); 

        setAutoScale(calculatedScale); 

        const finalDiagramData = generateTrompDiagramData(currentAST, calculatedScale, highlightedRedexId);
        setDiagramData(finalDiagramData);

      } catch (e: any) {
        console.error("Error generating Experimental Tromp diagram:", e);
        setInternalError(e.message || "Failed to generate Experimental Tromp diagram.");
        setDiagramData(null);
      } finally {
        setInternalLoading(false);
      }
    } else if (!currentAST) {
      setDiagramData(null);
      setInternalError(null);
      setAutoScale(10); 
    }
  }, [currentAST, containerSize, highlightedRedexId]);


  const isLoading = contextIsLoading || internalLoading;
  const error = contextError || internalError;

  const { argumentElementsJsx, otherElementsJsx } = useMemo(() => {
    if (!diagramData || !diagramData.svgElements) {
      return { argumentElementsJsx: [], otherElementsJsx: [] };
    }

    const baseStrokeW = Math.max(0.02, 1 / autoScale);
    const highlightedStrokeW = Math.max(0.04, 2 / autoScale);

    const renderElementToJsx = (el: SvgElementData) => {
      let strokeColor = getPrimitiveColor(el.sourcePrimitiveName) || DEFAULT_STROKE_COLOR;
      let currentStrokeWidth = baseStrokeW;

      if (el.isHighlighted) {
        strokeColor = HIGHLIGHT_COLOR;
        currentStrokeWidth = highlightedStrokeW;
      } else if (el.isSecondaryHighlight) {
        strokeColor = SECONDARY_HIGHLIGHT_COLOR;
        currentStrokeWidth = highlightedStrokeW * 0.8;
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
          >
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
          >
            {el.sourcePrimitiveName && <title>Primitive: {el.sourcePrimitiveName}</title>}
          </polyline>
        );
      }
      return null;
    };

    const argJsx: JSX.Element[] = [];
    const otherJsx: JSX.Element[] = [];

    diagramData.svgElements.forEach((el) => {
      const jsxEl = renderElementToJsx(el);
      if (jsxEl) {
        if (el.isSecondaryHighlight) {
          argJsx.push(jsxEl);
        } else {
          otherJsx.push(jsxEl);
        }
      }
    });

    return { argumentElementsJsx: argJsx, otherElementsJsx: otherJsx };
  }, [diagramData, autoScale]);


  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 shrink-0">
        <div className="flex items-center">
          <Beaker className="mr-2 h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-semibold">Experimental Tromp Diagram</CardTitle>
        </div>
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
                <p className="text-lg">Diagram will appear here for experimentation.</p>
            </div>
          )}
          {diagramData && diagramData.svgElements.length > 0 && (
            <svg
              key={`experimental-${currentAST?.id}-${highlightedRedexId || 'no-highlight'}`} 
              width={diagramData.actualWidthPx}
              height={diagramData.actualHeightPx}
              viewBox={diagramData.viewBox}
              xmlns="http://www.w3.org/2000/svg"
              className="border border-dashed border-border" 
              preserveAspectRatio="xMidYMid meet" 
            >
              <g transform="translate(0.5 0.5)"> 
                {otherElementsJsx}
                {argumentElementsJsx.length > 0 && (
                  <g id="redex-argument-block-group">
                    {argumentElementsJsx}
                  </g>
                )}
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

