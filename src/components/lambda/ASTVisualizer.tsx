
"use client";
import React, { useMemo, useState, useRef, WheelEvent, MouseEvent as ReactMouseEvent, useCallback, useEffect } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateAstSvgData, AstSvgRenderData, SvgAstNode, SvgLambdaNode, SvgVariableNode, SvgApplicationNode, generateSingleNodeSvgData } from '@/lib/lambda-calculus/ast-svg/ast-svg-loader';
import { prettifyAST } from '@/lib/lambda-calculus/prettifier';
import { print } from '@/lib/lambda-calculus/printer';
import { predefinedExpressions } from '@/lib/lambda-calculus/predefined';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ASTNodeId } from '@/lib/lambda-calculus/types';

const NODE_FONT_SIZE = 14;
const NODE_RX = 6;
const MIN_SCALE = 0.05;
const MAX_SCALE = 5;
const FIT_PADDING_FACTOR = 0.9;
const MIN_VISIBLE_CONTENT_PERCENTAGE = 0.1;

const getNodeStyles = (node: SvgAstNode) => {
  let fill = 'hsl(var(--card))';
  let stroke = 'hsl(var(--border))';
  let textFill = 'hsl(var(--foreground))';
  let effectiveSourcePrimitive = node.sourcePrimitiveName;

  // If it's a collapsed node displaying a prettified name, use that for coloring.
  if (node.type === 'variable' && node.name.startsWith('_')) {
    effectiveSourcePrimitive = node.name;
  }

  switch (node.type) {
    case 'variable':
      fill = 'hsl(var(--ast-variable-bg))';
      stroke = 'hsl(var(--ast-variable-fg)/0.7)';
      textFill = 'hsl(var(--ast-variable-fg))';
      if (effectiveSourcePrimitive) {
        if (effectiveSourcePrimitive.startsWith("_POW") || effectiveSourcePrimitive.startsWith("_MULT") || effectiveSourcePrimitive.startsWith("_PLUS")) {
           fill = 'hsl(var(--ast-application-bg))'; textFill = 'hsl(var(--ast-application-fg))'; stroke = 'hsl(var(--ast-application-fg)/0.7)';
        }
        else if (effectiveSourcePrimitive.startsWith("_SUCC") || effectiveSourcePrimitive.startsWith("_Y-COMB") || effectiveSourcePrimitive.startsWith("_NOT") || effectiveSourcePrimitive.startsWith("_ID") || effectiveSourcePrimitive.startsWith("_TRUE") || effectiveSourcePrimitive.startsWith("_FALSE") || /^_\d+$/.test(effectiveSourcePrimitive) ) {
            fill = 'hsl(var(--ast-lambda-bg))'; textFill = 'hsl(var(--ast-lambda-fg))'; stroke = 'hsl(var(--ast-lambda-fg)/0.7)';
        }
      }
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

const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function ASTVisualizer() {
  const { currentAST, isLoading, error: contextError, highlightedRedexId, customExpressions } = useLambda();

  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [isGloballyCollapsedMode, setIsGloballyCollapsedMode] = useState(true);
  const [significantPrettifiedName, setSignificantPrettifiedName] = useState<string | null>(null);
  const [expandedSubtreeNodeIds, setExpandedSubtreeNodeIds] = useState<Set<ASTNodeId>>(new Set());

  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentAST) {
      const prettyName = prettifyAST(currentAST, customExpressions, predefinedExpressions);
      const canonicalPrintVal = print(currentAST);
      const isSignificantGlobalCollapse = prettyName !== canonicalPrintVal && !prettyName.includes(" ") && prettyName.startsWith('_');

      if (isSignificantGlobalCollapse) {
        setSignificantPrettifiedName(prettyName);
        setIsGloballyCollapsedMode(true);
      } else {
        setSignificantPrettifiedName(null);
        setIsGloballyCollapsedMode(false);
      }
      setExpandedSubtreeNodeIds(new Set()); // Reset subtree expansions on AST change
    } else {
      setSignificantPrettifiedName(null);
      setIsGloballyCollapsedMode(false);
      setExpandedSubtreeNodeIds(new Set());
    }
  }, [currentAST, customExpressions]);


  const svgRenderData: AstSvgRenderData | null = useMemo(() => {
    if (!currentAST) return null;
    try {
      if (isGloballyCollapsedMode && significantPrettifiedName) {
        return generateSingleNodeSvgData(significantPrettifiedName, currentAST.id, significantPrettifiedName);
      }
      return generateAstSvgData(currentAST, highlightedRedexId, customExpressions, predefinedExpressions, expandedSubtreeNodeIds);
    } catch (e: any) {
      console.error("Error generating AST SVG data:", e);
      return { nodes: [], connectors: [], canvasWidth: 300, canvasHeight: 100, error: e.message || "Layout error" };
    }
  }, [currentAST, highlightedRedexId, isGloballyCollapsedMode, significantPrettifiedName, customExpressions, predefinedExpressions, expandedSubtreeNodeIds]);

  const layoutError = svgRenderData?.error;
  const displayError = contextError || layoutError;

  const getClampedTranslations = useCallback((targetTx: number, targetTy: number, currentScale: number) => {
    if (!svgContainerRef.current || !svgRenderData || svgRenderData.canvasWidth <= 0 || svgRenderData.canvasHeight <= 0) {
      return { x: targetTx, y: targetTy };
    }
    const containerWidth = svgContainerRef.current.clientWidth;
    const containerHeight = svgContainerRef.current.clientHeight;
    const contentNaturalWidth = svgRenderData.canvasWidth;
    const contentNaturalHeight = svgRenderData.canvasHeight;
    const contentScaledWidth = contentNaturalWidth * currentScale;
    const contentScaledHeight = contentNaturalHeight * currentScale;

    let minTx, maxTx, minTy, maxTy;

    if (contentScaledWidth <= containerWidth) {
      minTx = (containerWidth - contentScaledWidth) / 2; // Center if smaller
      maxTx = (containerWidth - contentScaledWidth) / 2;
    } else {
      const minVisiblePartX = Math.max(10, contentScaledWidth * MIN_VISIBLE_CONTENT_PERCENTAGE);
      maxTx = containerWidth - minVisiblePartX;
      minTx = minVisiblePartX - contentScaledWidth;
    }

    if (contentScaledHeight <= containerHeight) {
      minTy = (containerHeight - contentScaledHeight) / 2; // Center if smaller
      maxTy = (containerHeight - contentScaledHeight) / 2;
    } else {
      const minVisiblePartY = Math.max(10, contentScaledHeight * MIN_VISIBLE_CONTENT_PERCENTAGE);
      maxTy = containerHeight - minVisiblePartY;
      minTy = minVisiblePartY - contentScaledHeight;
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

      const newTranslateX = (containerWidth - svgRenderData.canvasWidth * newScale) / 2;
      const newTranslateY = (containerHeight - svgRenderData.canvasHeight * newScale) / 2;

      const clamped = getClampedTranslations(newTranslateX, newTranslateY, newScale);
      setScale(newScale);
      setTranslateX(clamped.x);
      setTranslateY(clamped.y);
    }
  }, [svgRenderData, getClampedTranslations]);

  useEffect(() => {
    fitView();
  }, [svgRenderData, fitView]);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!svgContainerRef.current || !svgRenderData) return;
    const rect = svgContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const oldScale = scale;
    let newProposedScale = oldScale * (e.deltaY > 0 ? 0.9 : 1.1);
    const newScale = clampValue(newProposedScale, MIN_SCALE, MAX_SCALE);
    const worldMouseX = (mouseX - translateX) / oldScale;
    const worldMouseY = (mouseY - translateY) / oldScale;
    const newTx = mouseX - worldMouseX * newScale;
    const newTy = mouseY - worldMouseY * newScale;
    const clamped = getClampedTranslations(newTx, newTy, newScale);
    setScale(newScale);
    setTranslateX(clamped.x);
    setTranslateY(clamped.y);
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Prevent panning if the click target is an individual SVG node that handled the click
    const targetIsNodeGroup = (e.target as SVGElement).closest('g[data-ast-node-id]');
    if (targetIsNodeGroup) {
        // Individual node click handler will manage event if needed
        return;
    }

    setIsPanning(true);
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
    if (isPanning) {
        setIsPanning(false);
        if (svgContainerRef.current) {
            svgContainerRef.current.style.setProperty('cursor', 'grab');
        }
    }
  };

  const handleGlobalSvgClick = () => {
    if (significantPrettifiedName) {
      setIsGloballyCollapsedMode(prev => !prev);
      setExpandedSubtreeNodeIds(new Set()); // Reset subtree expansions on global toggle
    }
  };

  const handleSubtreeNodeClick = (event: ReactMouseEvent<SVGElement>, clickedNodeId: ASTNodeId, isNodeGreedilyCollapsible?: boolean) => {
    event.stopPropagation(); // Prevent global click
    if (isNodeGreedilyCollapsible) {
      setExpandedSubtreeNodeIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(clickedNodeId)) {
          newSet.delete(clickedNodeId);
        } else {
          newSet.add(clickedNodeId);
        }
        return newSet;
      });
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
        onClick={handleGlobalSvgClick}
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
            key={currentAST?.id ? `${currentAST.id}-${isGloballyCollapsedMode}-${[...expandedSubtreeNodeIds].sort().join('-')}` : `ast-svg-${isGloballyCollapsedMode}`}
            width="100%"
            height="100%"
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

                if (isGloballyCollapsedMode && significantPrettifiedName && node.name === significantPrettifiedName && node.type === 'variable') {
                    textContent = node.name;
                }
                else if (node.type === 'variable' && node.name.startsWith('_') && node.isGreedilyCollapsible && !expandedSubtreeNodeIds.has(node.id)) {
                    textContent = node.name;
                }
                else {
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
                }

                return (
                  <g
                    key={node.svgId}
                    transform={`translate(${node.x}, ${node.y})`}
                    data-ast-node-id={node.id} // For click handling
                    onClick={(e) => handleSubtreeNodeClick(e, node.id, node.isGreedilyCollapsible)}
                    className={cn(node.isGreedilyCollapsible && 'cursor-pointer')}
                  >
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
                      fontSize={NODE_FONT_SIZE}
                      fontFamily="var(--font-geist-mono)"
                      style={{ pointerEvents: 'none' }}
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
