
"use client";
import React, { useMemo, useState, useRef, WheelEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateAstSvgData, AstSvgRenderData, SvgAstNode, SvgLambdaNode, SvgVariableNode, SvgApplicationNode } from '@/lib/lambda-calculus/ast-svg/ast-svg-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const NODE_FONT_SIZE = 14;
const NODE_RX = 6; // Corner radius
const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

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

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!svgContainerRef.current || !svgRenderData) return;

    const rect = svgContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // Mouse X relative to container
    const mouseY = e.clientY - rect.top;  // Mouse Y relative to container

    const oldScale = scale;
    let newScale = oldScale * (e.deltaY > 0 ? 0.9 : 1.1);
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));


    // Adjust translateX and translateY to zoom towards the mouse point
    // The point (mouseX, mouseY) on the screen corresponds to a point in the SVG's coordinate system.
    // SVG point before zoom: ( (mouseX - translateX) / oldScale, (mouseY - translateY) / oldScale )
    // We want this SVG point to be at the same screen position (mouseX, mouseY) after zoom.
    // So, newTranslateX = mouseX - svgPointX * newScale
    // newTranslateY = mouseY - svgPointY * newScale
    
    setTranslateX(prevTx => mouseX - (mouseX - prevTx) * (newScale / oldScale));
    setTranslateY(prevTy => mouseY - (mouseY - prevTy) * (newScale / oldScale));
    setScale(newScale);
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only pan with left mouse button
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    svgContainerRef.current?.style.setProperty('cursor', 'grabbing');
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setTranslateX(prev => prev + dx);
    setTranslateY(prev => prev + dy);
    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUpOrLeave = () => {
    setIsPanning(false);
    svgContainerRef.current?.style.setProperty('cursor', 'grab');
  };
  
  // Reset transform when AST changes to re-center/fit
  React.useEffect(() => {
    setScale(1);
    // Basic recentering: place top-left of content (considering padding) towards center of view
    if (svgRenderData && svgContainerRef.current) {
        const containerWidth = svgContainerRef.current.clientWidth;
        const containerHeight = svgContainerRef.current.clientHeight;
        // This is a very rough centering, assumes content starts near 0,0 in its own coordinate system.
        // A more sophisticated fit would consider svgRenderData.canvasWidth/Height
        setTranslateX((containerWidth - svgRenderData.canvasWidth) / 2);
        setTranslateY(50); // Small offset from top
    } else {
        setTranslateX(0);
        setTranslateY(0);
    }
  }, [currentAST, svgRenderData]);


  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Abstract Syntax Tree</CardTitle>
      </CardHeader>
      <CardContent 
        ref={svgContainerRef}
        className="flex-grow overflow-auto cursor-grab" // overflow-auto still useful for overall scroll
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave} // Stop panning if mouse leaves container
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
            key={currentAST?.id || 'ast-svg'} // Key to help with re-renders if needed
            width="100%" 
            height="100%"
            viewBox={`0 0 ${svgRenderData.canvasWidth} ${svgRenderData.canvasHeight}`}
            xmlns="http://www.w3.org/2000/svg"
            className={cn("animate-fadeIn", {"border border-dashed border-destructive": !!layoutError})}
            preserveAspectRatio="xMidYMid meet" // Keeps aspect ratio, fits within bounds
            style={{ minHeight: '200px' }} 
          >
            <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
              {/* Render Connectors First */}
              {svgRenderData.connectors.map(connector => (
                <path
                  key={connector.id}
                  d={connector.pathD}
                  stroke={connector.isHighlighted ? 'hsl(var(--ast-highlight-bg))' : 'hsl(var(--foreground)/0.5)'}
                  strokeWidth={connector.isHighlighted ? (2/scale) : (1.5/scale)} // Scale stroke width
                  fill="none"
                />
              ))}
              {/* Render Nodes */}
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
                      strokeWidth={node.isHighlighted ? (2/scale) : (1.5/scale)} // Scale stroke width
                    />
                    <text
                      x={node.width / 2}
                      y={node.height / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={styles.textFill}
                      fontSize={NODE_FONT_SIZE / Math.sqrt(scale)} // Adjust font size with scale
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

