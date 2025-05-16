
"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateTrompDiagramData, TrompDiagramRenderData } from '@/lib/lambda-calculus/tromp-diagram/renderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

const DEFAULT_SCALE = 20;
const MIN_SCALE = 5;
const MAX_SCALE = 50;

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
      // Use requestAnimationFrame to avoid blocking the main thread for potentially complex calculations
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
    return diagramData.svgElements.map(el => {
      // For a ~1px visual stroke independent of zoom, make strokeWidth proportional to 1/scale.
      // If scale is DEFAULT_SCALE (20), strokeWidth = 1/20 = 0.05 for a 1px line.
      // So, strokeWidth = (1 / scale) effectively.
      const strokeW = 1 / scale; 

      const commonProps = {
        stroke: "hsl(var(--foreground))", 
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
            {el.title && <title>{el.title}</title>}
          </line>
        );
      } else if (el.type === 'polyline') {
        return (
          <polyline
            key={el.key}
            points={el.points}
            {...commonProps}
          />
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
          {error && !diagramData && ( // Show error if diagramData is null due to error
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
           {!isLoading && !error && currentAST && !diagramData && !internalError && ( // AST exists, but no data and no specific internal error yet
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
              // Preserve aspect ratio and center the diagram
              preserveAspectRatio="xMidYMid meet"
            >
              {/* translate(0.5,0.5) for crisp lines, applied to the group containing all elements */}
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
