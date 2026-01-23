import { getSupabaseAdmin } from '../supabase';
import { Document } from '@/types';

interface MatchDocumentRow {
  id: Document['id'];
  content: Document['content'];
  metadata: Document['metadata'];
}

export class VectorStoreService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseAdmin();
  }

  /**
   * Add documents to the vector store with embeddings
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .from('documents')
      .insert(
        documents.map(doc => ({
          content: doc.content,
          embedding: doc.embedding,
          metadata: doc.metadata,
        }))
      );

    if (error) {
      throw new Error(`Failed to add documents: ${error.message}`);
    }
  }

  /**
   * Perform similarity search using pgvector
   */
  async similaritySearch(
    queryEmbedding: number[],
    k: number = 5
  ): Promise<Document[]> {
    const { data, error } = await this.supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: k,
    });

    if (error) {
      throw new Error(`Similarity search failed: ${error.message}`);
    }

    return data.map((row: MatchDocumentRow) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
    }));
  }

  /**
   * Check if the vector store is empty
   */
  async isEmpty(): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Failed to check if vector store is empty: ${error.message}`);
    }

    return count === 0;
  }

  /**
   * Clear all documents from the vector store
   */
  async reset(): Promise<void> {
    const { error } = await this.supabase
      .from('documents')
      .delete()
      .neq('id', 0); // Delete all rows

    if (error) {
      throw new Error(`Failed to reset vector store: ${error.message}`);
    }
  }

  /**
   * Get count of documents in the store
   */
  async getDocumentCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Failed to get document count: ${error.message}`);
    }

    return count || 0;
  }
}
