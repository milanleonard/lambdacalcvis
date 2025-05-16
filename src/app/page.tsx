
"use client"; // Required for Tabs and local state

import { useState } from 'react';
import { LambdaProvider } from '@/contexts/LambdaContext';
import { ExpressionInputCard } from '@/components/lambda/ExpressionInputCard';
import { ASTVisualizer } from '@/components/lambda/ASTVisualizer';
import { TrompDiagramVisualizer } from '@/components/lambda/TrompDiagramVisualizer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type VisualizationStyle = "ast" | "tromp";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<VisualizationStyle>("tromp");

  return (
    <LambdaProvider>
      <main className="flex flex-col md:flex-row h-screen max-h-screen p-4 gap-4 bg-background overflow-hidden">
        <div className="w-full md:w-2/5 lg:w-1/3 h-full max-h-full overflow-y-auto">
          <ExpressionInputCard />
        </div>
        <div className="w-full md:w-3/5 lg:w-2/3 h-full max-h-full flex flex-col">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as VisualizationStyle)} className="flex flex-col h-full">
            <TabsList className="mb-2 shrink-0">
              <TabsTrigger value="ast">Abstract Syntax Tree</TabsTrigger>
              <TabsTrigger value="tromp">Tromp Diagram</TabsTrigger>
            </TabsList>
            <TabsContent value="ast" className="flex-grow h-[calc(100%-2.5rem)]">
              <ASTVisualizer />
            </TabsContent>
            <TabsContent value="tromp" className="flex-grow h-[calc(100%-2.5rem)]">
              <TrompDiagramVisualizer />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </LambdaProvider>
  );
}

