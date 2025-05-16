
"use client"; // Required for Tabs and local state

import { useState } from 'react';
import { LambdaProvider } from '@/contexts/LambdaContext';
import { ExpressionInputCard } from '@/components/lambda/ExpressionInputCard';
import { ASTVisualizer } from '@/components/lambda/ASTVisualizer';
import { TrompDiagramVisualizer } from '@/components/lambda/TrompDiagramVisualizer';
import { ExperimentalTrompDiagram } from '@/components/lambda/ExperimentalTrompDiagram'; // New Import
import { HelpContent } from '@/components/lambda/HelpContent';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Beaker } from 'lucide-react'; // Added Beaker for experimental

type VisualizationStyle = "tromp" | "experimental_tromp" | "ast" | "help"; // Added new style

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
              <TabsTrigger value="tromp">Tromp Diagram</TabsTrigger>
              <TabsTrigger value="experimental_tromp">
                <Beaker className="mr-2 h-4 w-4 text-primary" />
                Experimental Diagram
              </TabsTrigger>
              <TabsTrigger value="ast">Abstract Syntax Tree</TabsTrigger>
              <TabsTrigger 
                value="help" 
                className="font-semibold data-[state=active]:text-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-inner hover:text-primary/90 text-foreground"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Help
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tromp" className="flex-grow h-[calc(100%-2.5rem)]">
              <TrompDiagramVisualizer />
            </TabsContent>
            <TabsContent value="experimental_tromp" className="flex-grow h-[calc(100%-2.5rem)]">
              <ExperimentalTrompDiagram />
            </TabsContent>
            <TabsContent value="ast" className="flex-grow h-[calc(100%-2.5rem)]">
              <ASTVisualizer />
            </TabsContent>
            <TabsContent value="help" className="flex-grow h-[calc(100%-2.5rem)] bg-card rounded-md border">
              <HelpContent />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </LambdaProvider>
  );
}
