'use server';
/**
 * @fileOverview A simple Genkit flow that returns a greeting.
 *
 * - sayHello - A function that invokes the helloFlow.
 * - SayHelloInput - The input type for the sayHello function.
 * - SayHelloOutput - The return type for the sayHello function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const SayHelloInputSchema = z.object({
  name: z.string().optional().describe('The name to greet. Defaults to "World" if not provided.'),
});
export type SayHelloInput = z.infer<typeof SayHelloInputSchema>;

// Explicitly defining output schema as z.string()
const SayHelloOutputSchema = z.string().describe('The greeting message from Genkit.');
export type SayHelloOutput = z.infer<typeof SayHelloOutputSchema>;

const helloFlowInternal = ai.defineFlow(
  {
    name: 'helloFlow',
    inputSchema: SayHelloInputSchema,
    outputSchema: SayHelloOutputSchema,
  },
  async (input: SayHelloInput): Promise<SayHelloOutput> => {
    const targetName = input.name?.trim() ? input.name.trim() : 'World';
    return `Hello, ${targetName}! From Genkit.`;
  }
);

export async function sayHello(input: SayHelloInput): Promise<SayHelloOutput> {
  return helloFlowInternal(input);
}
