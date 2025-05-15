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
  name: z.string(), // Removed .describe()
});
export type SayHelloInput = z.infer<typeof SayHelloInputSchema>;

const SayHelloOutputSchema = z.string(); // Removed .describe()
export type SayHelloOutput = z.infer<typeof SayHelloOutputSchema>; // Standardized to infer

const helloFlowInternal = ai.defineFlow(
  {
    name: 'helloFlow',
    inputSchema: SayHelloInputSchema,
    outputSchema: SayHelloOutputSchema,
  },
  async (input) => {
    // Assuming input.name is guaranteed by the schema (e.g., not optional)
    return `Hello, ${input.name}! From Genkit.`;
  }
);

export async function sayHello(input: SayHelloInput): Promise<SayHelloOutput> {
  return helloFlowInternal(input);
}
