'use server';
/**
 * @fileOverview A simple Genkit flow that returns a greeting.
 *
 * - sayHello - A function that invokes the helloFlow.
 * - SayHelloInput - The input type for the sayHello function.
 * - SayHelloOutput - The return type for the sayHello function.
 */

import {ai} from '@/ai/genkit';
// Zod import and schema definitions have been removed for simplification.

export interface SayHelloInput {
  name: string;
}

export type SayHelloOutput = string;

const helloFlowInternal = ai.defineFlow(
  {
    name: 'helloFlow',
    // inputSchema and outputSchema are removed for this diagnostic step.
    // Genkit flows can operate without explicit schemas, using 'any' implicitly or defined TS types.
  },
  async (input: SayHelloInput) => {
    // Basic input check since Zod is not used here.
    // In a real scenario without Zod, you'd want more robust validation.
    if (typeof input?.name !== 'string' || input.name.trim() === '') {
      return `Hello, anonymous user! (Please provide a name). From Genkit.`;
    }
    return `Hello, ${input.name}! From Genkit.`;
  }
);

export async function sayHello(input: SayHelloInput): Promise<SayHelloOutput> {
  return helloFlowInternal(input);
}
