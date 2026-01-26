/**
 * Embedding service using Xenova Transformers for local embedding generation.
 * This provides embeddings compatible with the sentence-transformers library
 */

import type { FeatureExtractionPipeline } from '@xenova/transformers';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

export class EmbeddingService {
  private readonly requestTimeoutMs = 30000;
  private localPipeline: Promise<FeatureExtractionPipeline> | null = null;

  /**
   * Generate embeddings for a single text
   */
  async embedText(text: string): Promise<number[]> {
    return this.embedWithLocalModel(text);
  }

  private async embedWithLocalModel(text: string): Promise<number[]> {
    const pipeline = await this.getLocalPipeline();
    const output = (await pipeline(text, { pooling: 'mean', normalize: true })) as {
      data: Float32Array | number[];
    };

    const vector = Array.from(output.data as Float32Array | number[]);
    return vector;
  }

  private async getLocalPipeline(): Promise<FeatureExtractionPipeline> {
    if (!this.localPipeline) {
      this.localPipeline = (async () => {
        const { pipeline } = await import('@xenova/transformers');
        return pipeline('feature-extraction', MODEL_NAME) as Promise<FeatureExtractionPipeline>;
      })();
    }

    return this.localPipeline;
  }

}

export const embeddingService = new EmbeddingService();
