
"use client";
import React, { useMemo } from 'react';
import { useLambda } from '@/contexts/LambdaContext';
import { generateAstSvgData, AstSvgRenderData, SvgAstNode, SvgLambdaNode, SvgVariableNode, SvgApplicationNode, SvgConnector } from '@/lib/lambda-calculus/ast-svg/ast-svg-loader'; // Assuming loader file
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const NODE_FONT_SIZE = 14;
const NODE_RX = 6; // Corner radius

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Abstract Syntax Tree (SVG)</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto"> {/* Use overflow-auto for native SVG scrolling for now */}
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
            width="100%" // Make SVG responsive
            height="100%"
            viewBox={`0 0 ${svgRenderData.canvasWidth} ${svgRenderData.canvasHeight}`}
            xmlns="http://www.w3.org/2000/svg"
            className={cn("animate-fadeIn", {"border border-dashed border-destructive": !!layoutError})}
            preserveAspectRatio="xMidYMid meet"
            style={{ minHeight: '200px' }} // Ensure SVG has some minimum size
          >
            {/* Render Connectors First (typically behind nodes) */}
            {svgRenderData.connectors.map(connector => (
              <path
                key={connector.id}
                d={connector.pathD}
                stroke={connector.isHighlighted ? 'hsl(var(--ast-highlight-bg))' : 'hsl(var(--foreground)/0.5)'}
                strokeWidth={connector.isHighlighted ? 2 : 1}
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
                  textContent = '@'; // Or 'App'
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
                    strokeWidth={node.isHighlighted ? 2 : 1.5}
                  />
                  <text
                    x={node.width / 2}
                    y={node.height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={styles.textFill}
                    fontSize={NODE_FONT_SIZE}
                    fontFamily="var(--font-geist-mono)"
                  >
                    {textContent}
                  </text>
                </g>
              );
            })}
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
