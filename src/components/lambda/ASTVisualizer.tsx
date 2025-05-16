
"use client";
import React, { useMemo, useState, useRef, WheelEvent, MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateAstSvgData, AstSvgRenderData, SvgAstNode, SvgLambdaNode, SvgVariableNode, SvgApplicationNode } from '@/lib/lambda-calculus/ast-svg/ast-svg-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const NODE_FONT_SIZE = 14;
const NODE_RX = 6; // Corner radius
const MIN_SCALE = 0.05;
const MAX_SCALE = 5;
const FIT_PADDING_FACTOR = 0.9; // For "fit to view", show 90% of content, 5% padding each side
const MIN_VISIBLE_CONTENT_PERCENTAGE = 0.1; // For panning bounds, ensure at least 10% of content is visible

// Helper function to get node specific styles
const getNodeStyles = (node: SvgAstNode) => {
  let fill = 'hsl(var(--card))';
  let stroke = 'hsl(var(--border))';
  let textFill = 'hsl(var(--foreground))';

  switch (node.type) {
    case 'variable':
      fill = 'hsl(var(--ast-variable-bg))';
      stroke = 'hsl(var(--ast-variable-fg)/0.7)';
      textFill = 'hsl(var(--ast-variable-fg))';
      break;
    case 'lambda':
      fill = 'hsl(var(--ast-lambda-bg))';
      stroke = 'hsl(var(--ast-lambda-fg)/0.7)';
      textFill = 'hsl(var(--ast-lambda-fg))';
      break;
    case 'application':
      fill = 'hsl(var(--ast-application-bg))';
      stroke = 'hsl(var(--ast-application-fg)/0.7)';
      textFill = 'hsl(var(--ast-application-fg))';
      break;
  }

  if (node.isHighlighted) {
    stroke = 'hsl(var(--ast-highlight-bg))';
  }

  return { fill, stroke, textFill };
};

const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function ASTVisualizer() {
  const { currentAST, isLoading, error: contextError, highlightedRedexId } = useLambda();

  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const svgContainerRef = useRef<HTMLDivElement>(null);

  const svgRenderData: AstSvgRenderData | null = useMemo(() => {
    if (!currentAST) return null;
    try {
      return generateAstSvgData(currentAST, highlightedRedexId);
    } catch (e: any) {
      console.error("Error generating AST SVG data:", e);
      return { nodes: [], connectors: [], canvasWidth: 300, canvasHeight: 100, error: e.message || "Layout error" };
    }
  }, [currentAST, highlightedRedexId]);

  const layoutError = svgRenderData?.error;
  const displayError = contextError || layoutError;

  const getClampedTranslations = useCallback((targetTx: number, targetTy: number, currentScale: number) => {
    if (!svgContainerRef.current || !svgRenderData || svgRenderData.canvasWidth <= 0 || svgRenderData.canvasHeight <= 0) {
      return { x: targetTx, y: targetTy };
    }

    const containerWidth = svgContainerRef.current.clientWidth;
    const containerHeight = svgContainerRef.current.clientHeight;
    const contentScaledWidth = svgRenderData.canvasWidth * currentScale;
    const contentScaledHeight = svgRenderData.canvasHeight * currentScale;

    // Determine minimum visible part of the content
    const minVisibleX = Math.max(10, contentScaledWidth * MIN_VISIBLE_CONTENT_PERCENTAGE);
    const minVisibleY = Math.max(10, contentScaledHeight * MIN_VISIBLE_CONTENT_PERCENTAGE);
    
    const minTx = containerWidth - minVisibleX - contentScaledWidth;
    const maxTx = minVisibleX;

    const minTy = containerHeight - minVisibleY - contentScaledHeight;
    const maxTy = minVisibleY;
    
    return {
      x: clampValue(targetTx, minTx, maxTx),
      y: clampValue(targetTy, minTy, maxTy),
    };
  }, [svgRenderData]);


  const fitView = useCallback(() => {
    if (svgContainerRef.current && svgRenderData && svgRenderData.canvasWidth > 0 && svgRenderData.canvasHeight > 0) {
      const containerWidth = svgContainerRef.current.clientWidth;
      const containerHeight = svgContainerRef.current.clientHeight;

      if (containerWidth <=0 || containerHeight <=0) return; // Container not ready

      const scaleX = (containerWidth * FIT_PADDING_FACTOR) / svgRenderData.canvasWidth;
      const scaleY = (containerHeight * FIT_PADDING_FACTOR) / svgRenderData.canvasHeight;
      
      let newScale = Math.min(scaleX, scaleY);
      newScale = clampValue(newScale, MIN_SCALE, MAX_SCALE);

      const newTranslateX = (containerWidth - svgRenderData.canvasWidth * newScale) / 2;
      const newTranslateY = (containerHeight - svgRenderData.canvasHeight * newScale) / 2;

      setScale(newScale);
      // Clamping is not strictly needed for fitView as it should already be centered.
      // But if MIN_SCALE is hit, content might be larger than view, then clamping could apply.
      const clamped = getClampedTranslations(newTranslateX, newTranslateY, newScale);
      setTranslateX(clamped.x);
      setTranslateY(clamped.y);
    }
  }, [svgRenderData, getClampedTranslations]);

  React.useEffect(() => {
    fitView();
  }, [currentAST, svgRenderData, fitView]);


  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!svgContainerRef.current || !svgRenderData) return;

    const rect = svgContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; 
    const mouseY = e.clientY - rect.top;  

    const oldScale = scale;
    let newProposedScale = oldScale * (e.deltaY > 0 ? 0.9 : 1.1);
    const newScale = clampValue(newProposedScale, MIN_SCALE, MAX_SCALE);

    const newTx = mouseX - (mouseX - translateX) * (newScale / oldScale);
    const newTy = mouseY - (mouseY - translateY) * (newScale / oldScale);
    
    const clamped = getClampedTranslations(newTx, newTy, newScale);

    setScale(newScale);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; 
    setIsPanning(true);
    setPanStart({ x: e.clientX - translateX, y: e.clientY - translateY }); // Pan start relative to current translation
    svgContainerRef.current?.style.setProperty('cursor', 'grabbing');
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPanning || !svgContainerRef.current || !svgRenderData) return;
    
    const newTx = e.clientX - panStart.x;
    const newTy = e.clientY - panStart.y;

    const clamped = getClampedTranslations(newTx, newTy, scale);
    
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
    svgContainerRef.current?.style.setProperty('cursor', 'grab');
  };
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold">Abstract Syntax Tree</CardTitle>
        <Button variant="ghost" size="icon" onClick={fitView} title="Reset View">
          <Home className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent 
        ref={svgContainerRef}
        className="flex-grow overflow-auto cursor-grab relative" 
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave} 
      >
        {isLoading && !svgRenderData && (
          <div className="space-y-4 p-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        )}
        {displayError && (!svgRenderData || svgRenderData.nodes.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full text-destructive p-2">
            <AlertTriangle className="w-16 h-16 mb-4" />
            <p className="text-xl">Error visualizing AST.</p>
            <p className="text-sm text-muted-foreground">{displayError}</p>
          </div>
        )}
        {!isLoading && !displayError && !currentAST && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-2">
            <Info className="w-10 h-10 mb-3" />
            <p className="text-xl">Enter a Lambda Calculus expression.</p>
          </div>
        )}
        {svgRenderData && svgRenderData.nodes.length > 0 && !displayError && (
          <svg
            key={currentAST?.id || 'ast-svg'} 
            width="100%" 
            height="100%"
            viewBox={`0 0 ${svgRenderData.canvasWidth} ${svgRenderData.canvasHeight}`}
            xmlns="http://www.w3.org/2000/svg"
            className={cn("animate-fadeIn", {"border border-dashed border-destructive": !!layoutError})}
            preserveAspectRatio="xMidYMid meet" 
            style={{ minHeight: '200px' }} 
          >
            <g transform={`translate(${translateX / scale}, ${translateY / scale}) scale(${1})`}>
             {/* The main group for SVG content is effectively scaled by viewBox and preserveAspectRatio.
                 The individual translateX, translateY, and scale are for the *viewport* simulation within the SVG's coordinate system.
                 Thus, the transform on the <g> element should reflect the "camera" movement.
                 We apply inverse scale to translateX/Y because they are screen-space translations, 
                 but the <g> transform is in SVG units before the viewBox scaling.
                 Alternatively, and more simply, apply scale directly to the group and adjust viewBox:
            */}
            <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
              {svgRenderData.connectors.map(connector => (
                <path
                  key={connector.id}
                  d={connector.pathD}
                  stroke={connector.isHighlighted ? 'hsl(var(--ast-highlight-bg))' : 'hsl(var(--foreground)/0.5)'}
                  strokeWidth={connector.isHighlighted ? (2/scale) : (1.5/scale)} 
                  fill="none"
                />
              ))}
              {svgRenderData.nodes.map(node => {
                const styles = getNodeStyles(node);
                let textContent = '';
                switch (node.type) {
                  case 'variable':
                    textContent = (node as SvgVariableNode).name;
                    break;
                  case 'lambda':
                    textContent = `λ${(node as SvgLambdaNode).param}.`;
                    break;
                  case 'application':
                    textContent = '@'; 
                    break;
                }
                return (
                  <g key={node.svgId} transform={`translate(${node.x}, ${node.y})`}>
                    <rect
                      width={node.width}
                      height={node.height}
                      rx={NODE_RX}
                      ry={NODE_RX}
                      fill={styles.fill}
                      stroke={styles.stroke}
                      strokeWidth={node.isHighlighted ? (2/scale) : (1.5/scale)} 
                    />
                    <text
                      x={node.width / 2}
                      y={node.height / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={styles.textFill}
                      fontSize={NODE_FONT_SIZE} // Font size in SVG units, scales with group
                      fontFamily="var(--font-geist-mono)"
                    >
                      {textContent}
                    </text>
                  </g>
                );
              })}
            </g>
           </g>
          </svg>
        )}
         {svgRenderData && svgRenderData.nodes.length === 0 && !isLoading && !displayError && currentAST &&(
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                <Info className="w-10 h-10 mb-3" />
                <p className="text-lg">AST is empty or could not be drawn.</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
