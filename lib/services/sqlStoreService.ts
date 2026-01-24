import { getSupabaseAdmin } from '../supabase';
import { FileStatus, CPIData } from '@/types';

export class SQLStoreService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseAdmin();
  }

  /**
   * Update the load status for a specific file
   */
  async updateStatus(
    dataSourceId: string,
    fileName: string,
    target: 'vector' | 'sql',
    status: 'loaded' | 'not_loaded' | 'failed' | 'loading',
    message?: string,
    url?: string
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      data_source_id: dataSourceId,
      file_name: fileName,
      target,
      status,
      message,
      updated_at: new Date().toISOString(),
    };

    if (url) {
      payload.url = url;
    }

    const { error } = await this.supabase
      .from('t_file')
      .upsert(payload);

    if (error) {
      throw new Error(`Failed to update status: ${error.message}`);
    }
  }

  /**
   * Get the load status for a specific file
   */
  async getStatus(
    dataSourceId: string,
    fileName: string,
    target: 'vector' | 'sql'
  ): Promise<FileStatus | null> {
    const { data, error } = await this.supabase
      .from('t_file')
      .select('*')
      .eq('data_source_id', dataSourceId)
      .eq('file_name', fileName)
      .eq('target', target)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected
      throw new Error(`Failed to get status: ${error.message}`);
    }

    return data as FileStatus | null;
  }

  /**
   * List all file statuses
   */
  async listStatuses(): Promise<FileStatus[]> {
    const { data, error } = await this.supabase
      .from('t_file')
      .select('*')
      .order('data_source_id')
      .order('file_name')
      .order('target');

    if (error) {
      throw new Error(`Failed to list statuses: ${error.message}`);
    }

    return data as FileStatus[];
  }

  /**
   * Reset statuses for specific targets
   */
  async resetStatuses(targets: ('vector' | 'sql')[]): Promise<void> {
    const { error } = await this.supabase
      .from('t_file')
      .update({
        status: 'not_loaded',
        message: 'Reset for reload',
        updated_at: new Date().toISOString(),
      })
      .in('target', targets);

    if (error) {
      throw new Error(`Failed to reset statuses: ${error.message}`);
    }
  }

  /**
   * Insert CPI data
   */
  async insertCPIData(data: Array<{
    ref_area_code: string;
    ref_area_name: string;
    time_period: string;
    inflation_pct: number;
  }>): Promise<void> {
    const { error } = await this.supabase
      .from('t_cpi_monthly')
      .upsert(data, {
        onConflict: 'ref_area_code,time_period',
      });

    if (error) {
      throw new Error(`Failed to insert CPI data: ${error.message}`);
    }
  }

  /**
   * Query CPI data
   */
  async getCPIData(
    countryCode: string,
    year?: string,
    month?: string
  ): Promise<CPIData[]> {
    let query = this.supabase
      .from('t_cpi_monthly')
      .select('ref_area_code, ref_area_name, inflation_pct')
      .eq('ref_area_code', countryCode.toUpperCase());

    if (year) {
      const startDate = month 
        ? `${year}-${month.padStart(2, '0')}-01`
        : `${year}-01-01`;
      const endDate = month
        ? `${year}-${month.padStart(2, '0')}-31`
        : `${year}-12-31`;
      
      query = query.gte('time_period', startDate).lte('time_period', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query CPI data: ${error.message}`);
    }

    // Calculate average inflation if multiple rows
    if (data && data.length > 0) {
      const avgInflation = data.reduce((sum, row) => sum + row.inflation_pct, 0) / data.length;
      return [{
        ref_area_code: data[0].ref_area_code,
        ref_area_name: data[0].ref_area_name,
        inflation_pct: avgInflation,
      }];
    }

    return [];
  }

  /**
   * Clear all CPI data
   */
  async clearCPIData(): Promise<void> {
    const { error } = await this.supabase
      .from('t_cpi_monthly')
      .delete()
      .neq('id', 0);

    if (error) {
      throw new Error(`Failed to clear CPI data: ${error.message}`);
    }
  }
}
