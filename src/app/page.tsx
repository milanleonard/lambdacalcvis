import { LambdaProvider } from '@/contexts/LambdaContext';
import { ExpressionInputCard } from '@/components/lambda/ExpressionInputCard';
import { ASTVisualizer } from '@/components/lambda/ASTVisualizer';

export default function HomePage() {
  return (
    <LambdaProvider>
      <main className="flex flex-col md:flex-row h-screen max-h-screen p-4 gap-4 bg-background overflow-hidden">
        <div className="w-full md:w-2/5 lg:w-1/3 h-full max-h-full overflow-y-auto">
          <ExpressionInputCard />
        </div>
        <div className="w-full md:w-3/5 lg:w-2/3 h-full max-h-full overflow-y-auto">
          <ASTVisualizer />
        </div>
      </main>
    </LambdaProvider>
  );
}
