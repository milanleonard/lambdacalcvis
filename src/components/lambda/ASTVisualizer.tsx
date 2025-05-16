
"use client";
import React, { useMemo, useState, useRef, WheelEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect } from 'react';
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
const FIT_PADDING_FACTOR = 0.9; 
const MIN_VISIBLE_CONTENT_PERCENTAGE = 0.1; // Ensure at least 10% of content is visible when larger than view

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
    
    // Content dimensions in its own coordinate system (before scaling)
    const contentNaturalWidth = svgRenderData.canvasWidth;
    const contentNaturalHeight = svgRenderData.canvasHeight;

    // Content dimensions scaled to screen space
    const contentScaledWidth = contentNaturalWidth * currentScale;
    const contentScaledHeight = contentNaturalHeight * currentScale;

    let minTx, maxTx, minTy, maxTy;

    if (contentScaledWidth <= containerWidth) {
      // Content is narrower than or same width as container.
      // Allow panning from fully left to fully right.
      minTx = 0;
      maxTx = containerWidth - contentScaledWidth;
    } else {
      // Content is wider than container.
      // Ensure at least MIN_VISIBLE_CONTENT_PERCENTAGE of the content is visible, or 10px.
      const minVisiblePartX = Math.max(10, contentScaledWidth * MIN_VISIBLE_CONTENT_PERCENTAGE);
      
      // Left edge of content (targetTx) cannot be further right than (containerWidth - minVisiblePartX)
      maxTx = containerWidth - minVisiblePartX;
      // Right edge of content (targetTx + contentScaledWidth) cannot be further left than minVisiblePartX
      minTx = minVisiblePartX - contentScaledWidth;
    }

    if (contentScaledHeight <= containerHeight) {
      minTy = 0;
      maxTy = containerHeight - contentScaledHeight;
    } else {
      const minVisiblePartY = Math.max(10, contentScaledHeight * MIN_VISIBLE_CONTENT_PERCENTAGE);
      maxY = containerHeight - minVisiblePartY;
      minTy = minVisiblePartY - contentScaledHeight;
    }
    
    // If container is very small, min might become > max. Swap them or pick a strategy.
    // For now, if this happens (e.g. minVisiblePartX > containerWidth), clamp will effectively pin it.
    if (minTx > maxTx) { 
      // This can happen if minVisiblePartX is larger than containerWidth (e.g. content is huge, 10% of it is > Cw)
      // Or if contentScaledWidth is slightly larger than containerWidth, but minVisiblePartX pushes maxTx below minTx.
      // A reasonable fallback is to center it as much as possible or allow full pan.
      // For simplicity, let's swap to ensure clampValue works as expected. The values might be "tight".
       [minTx, maxTx] = [(containerWidth - contentScaledWidth)/2, (containerWidth - contentScaledWidth)/2]; // Effectively lock if confused
       // A better strategy might be:
       // minTx = containerWidth - contentScaledWidth; // Align right edge
       // maxTx = 0; // Align left edge
       // Then clamp will pick one.
       // The current logic minX = minVisiblePartX - Ws, maxX = Cw - minVisiblePartX should work generally.
       // If maxTx < minTx, it means there's no valid range, often because minVisiblePartX is too large for Cw.
       // In this scenario, effectively, the content must fill the view.
       // tx can range from Cw - Ws to 0.
       if (contentScaledWidth > containerWidth) { // Re-check for this specific sub-case
            minTx = containerWidth - contentScaledWidth;
            maxTx = 0;
       }
    }
    if (minTy > maxTy) {
       if (contentScaledHeight > containerHeight) {
            minTy = containerHeight - contentScaledHeight;
            maxTy = 0;
       }
    }

    return {
      x: clampValue(targetTx, minTx, maxTx),
      y: clampValue(targetTy, minTy, maxTy),
    };
  }, [svgRenderData]);


  const fitView = useCallback(() => {
    if (svgContainerRef.current && svgRenderData && svgRenderData.canvasWidth > 0 && svgRenderData.canvasHeight > 0) {
      const containerWidth = svgContainerRef.current.clientWidth;
      const containerHeight = svgContainerRef.current.clientHeight;

      if (containerWidth <=0 || containerHeight <=0) return; 

      const scaleX = (containerWidth * FIT_PADDING_FACTOR) / svgRenderData.canvasWidth;
      const scaleY = (containerHeight * FIT_PADDING_FACTOR) / svgRenderData.canvasHeight;
      
      let newScale = Math.min(scaleX, scaleY);
      newScale = clampValue(newScale, MIN_SCALE, MAX_SCALE);

      // These translations are to center the scaled content in the container.
      // These are effectively screen-space translations for the <g> element.
      const newTranslateX = (containerWidth - svgRenderData.canvasWidth * newScale) / 2;
      const newTranslateY = (containerHeight - svgRenderData.canvasHeight * newScale) / 2;
      
      // No clamping needed for fitView as it's calculating the ideal centered position.
      // Clamping is for user-driven pan/zoom.
      // However, if MIN_SCALE makes content larger than view, clamping during pan IS important.
      // The getClampedTranslations is more for AFTER user interaction.
      // For fitView, the calculated newTranslateX,Y should be directly used.
      setScale(newScale);
      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
    }
  }, [svgRenderData]);

  useEffect(() => {
    fitView();
  }, [currentAST, svgRenderData, fitView]); // fitView dependency is fine as it's memoized


  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!svgContainerRef.current || !svgRenderData) return;

    const rect = svgContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; 
    const mouseY = e.clientY - rect.top;  

    const oldScale = scale;
    let newProposedScale = oldScale * (e.deltaY > 0 ? 0.9 : 1.1);
    const newScale = clampValue(newProposedScale, MIN_SCALE, MAX_SCALE);

    // Point in content's original coordinate system that was under the mouse
    const worldMouseX = (mouseX - translateX) / oldScale;
    const worldMouseY = (mouseY - translateY) / oldScale;

    // New translations to keep worldMouseX,Y at the same screen position (mouseX,mouseY)
    const newTx = mouseX - worldMouseX * newScale;
    const newTy = mouseY - worldMouseY * newScale;
    
    const clamped = getClampedTranslations(newTx, newTy, newScale);

    setScale(newScale);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; 
    setIsPanning(true);
    // Pan start relative to current translation and mouse position
    setPanStart({ x: e.clientX - translateX, y: e.clientY - translateY }); 
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
    if (isPanning) { // Only reset cursor if panning was active
        setIsPanning(false);
        if (svgContainerRef.current) {
            svgContainerRef.current.style.setProperty('cursor', 'grab');
        }
    }
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
        className="flex-grow overflow-auto cursor-grab relative bg-background" 
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
            // No viewBox here if we are using screen-space transforms in the <g>
            xmlns="http://www.w3.org/2000/svg"
            className={cn("animate-fadeIn", {"border border-dashed border-destructive": !!layoutError})}
            style={{ minHeight: '200px' }} 
          >
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
                      fontSize={NODE_FONT_SIZE} // Font size in content units, scales with group
                      fontFamily="var(--font-geist-mono)"
                    >
                      {textContent}
                    </text>
                  </g>
                );
              })}
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


      