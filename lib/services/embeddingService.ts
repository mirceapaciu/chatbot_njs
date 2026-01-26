/**
 * Embedding service using Xenova Transformers for local embedding generation.
 * This provides embeddings compatible with the sentence-transformers library
 */

import type { FeatureExtractionPipeline } from '@xenova/transformers';

type FeatureExtractionOutput = number[] | number[][] | number[][][];

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

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings = await Promise.all(
      texts.map(text => this.embedText(text))
    );
    return embeddings;
  }

  /**
   * Normalize to a single embedding vector
   */
  private normalizeEmbedding(embedding: FeatureExtractionOutput): number[] {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return [];
    }

    if (this.isNumberArray(embedding)) {
      return embedding;
    }

    if (this.isNumberMatrix(embedding)) {
      return this.meanPool(embedding);
    }

    if (this.isNumberTensor3D(embedding)) {
      const pooled2D = embedding.map(matrix => this.meanPool(matrix));
      return this.meanPool(pooled2D);
    }

    return [];
  }

  private isNumberArray(value: unknown): value is number[] {
    return Array.isArray(value) && value.every(item => typeof item === 'number');
  }

  private isNumberMatrix(value: unknown): value is number[][] {
    return (
      Array.isArray(value) &&
      value.every(
        item => Array.isArray(item) && item.every(entry => typeof entry === 'number')
      )
    );
  }

  private isNumberTensor3D(value: unknown): value is number[][][] {
    return (
      Array.isArray(value) &&
      value.every(
        item =>
          Array.isArray(item) &&
          item.every(
            entry => Array.isArray(entry) && entry.every(val => typeof val === 'number')
          )
      )
    );
  }

  private meanPool(vectors: number[][]): number[] {
    const dimension = vectors[0]?.length ?? 0;
    if (dimension === 0) {
      return [];
    }

    const mean = new Array(dimension).fill(0);
    for (const vector of vectors) {
      for (let i = 0; i < dimension; i++) {
        mean[i] += vector[i] ?? 0;
      }
    }
    for (let i = 0; i < dimension; i++) {
      mean[i] /= vectors.length;
    }
    return mean;
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

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Embedding request timed out')), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

}

export const embeddingService = new EmbeddingService();
