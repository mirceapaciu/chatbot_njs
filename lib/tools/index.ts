/**
 * Tools for fetching external economic data
 * These are function definitions for OpenAI function calling
 */

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

/**
 * Fetch real GDP growth from IMF API
 */
export async function getRealGDPGrowth(
  countryCode: string,
  period: string
): Promise<string> {
  try {
    const url = `https://www.imf.org/external/datamapper/api/v1/NGDP_RPCH/${countryCode}?periods=${period}`;
    const response = await fetch(url, { next: { revalidate: 3600 } });
    
    if (!response.ok) {
      throw new Error(`IMF API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.values?.NGDP_RPCH) {
      const countryData = data.values.NGDP_RPCH[countryCode.toUpperCase()];
      if (countryData && countryData[period] !== undefined) {
        const growthRate = countryData[period];
        return `Real GDP growth rate for ${countryCode.toUpperCase()} in ${period}: ${growthRate}%`;
      }
    }

    return `Could not fetch real GDP growth rate for ${countryCode.toUpperCase()} for period ${period}. Please check that the country code and period are valid.`;
  } catch (error) {
    console.error('Error fetching GDP growth:', error);
    return `Error fetching real GDP growth data: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Fetch exchange rate data (placeholder - customize based on your data source)
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<string> {
  try {
    // Using a free API like exchangerate-api.com or similar
    // You may need to sign up for an API key
    const apiUrl = `https://api.exchangerate-api.com/v4/latest/${fromCurrency.toUpperCase()}`;
    
    const response = await fetch(apiUrl, { next: { revalidate: 3600 } });
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rate = data.rates?.[toCurrency.toUpperCase()];

    if (rate) {
      return `Exchange rate from ${fromCurrency.toUpperCase()} to ${toCurrency.toUpperCase()}: ${rate}`;
    }

    return `Could not fetch exchange rate for ${fromCurrency}/${toCurrency}`;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return `Error fetching exchange rate: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Query CPI data from the database
 */
export async function getCPI(
  countryCode: string,
  year?: string,
  month?: string,
  sqlStore?: any
): Promise<string> {
  try {
    if (!sqlStore) {
      return 'CPI data service not available';
    }

    const data = await sqlStore.getCPIData(countryCode, year, month);

    if (data.length === 0) {
      const filters = [];
      if (year) filters.push(`year ${year}`);
      if (month) filters.push(`month ${month}`);
      const filterText = filters.length > 0 ? ` for ${filters.join(', ')}` : '';
      
      return `No CPI inflation data found for ${countryCode.toUpperCase()}${filterText}. Please check that the country code is valid and data is available.`;
    }

    const row = data[0];
    let period = 'recent period';
    if (year || month) {
      period = '';
      if (year) period += `year=${year}`;
      if (month) period += ` month=${month}`;
    }

    return `CPI inflation rate for ${row.ref_area_name} (${countryCode.toUpperCase()}) in ${period}: ${row.inflation_pct.toFixed(2)}%`;
  } catch (error) {
    console.error('Error fetching CPI:', error);
    return `Error fetching CPI data: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Tool definitions for OpenAI function calling
 */
export const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_real_gdp_growth',
      description: 'Get the real GDP growth rate for a specific country and period from IMF data.',
      parameters: {
        type: 'object',
        properties: {
          country_code: {
            type: 'string',
            description: "The 3-letter ISO country code (e.g., 'USA', 'GBR', 'FRA', 'MDA', 'DEU')",
          },
          period: {
            type: 'string',
            description: "The year for which to get the GDP growth rate (e.g., '2024', '2025')",
          },
        },
        required: ['country_code', 'period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_exchange_rate',
      description: 'Get the exchange rate between two currencies.',
      parameters: {
        type: 'object',
        properties: {
          from_currency: {
            type: 'string',
            description: "The source currency code (e.g., 'USD', 'EUR', 'GBP')",
          },
          to_currency: {
            type: 'string',
            description: "The target currency code (e.g., 'USD', 'EUR', 'GBP')",
          },
          date: {
            type: 'string',
            description: "Optional date in YYYY-MM-DD format",
          },
        },
        required: ['from_currency', 'to_currency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_cpi',
      description: 'Get Consumer Price Index (CPI) inflation data for a specific country.',
      parameters: {
        type: 'object',
        properties: {
          country_code: {
            type: 'string',
            description: "The 3-letter ISO country code (e.g., 'USA', 'GBR', 'FRA', 'DEU')",
          },
          year: {
            type: 'string',
            description: "Optional year filter (e.g., '2024', '2025')",
          },
          month: {
            type: 'string',
            description: 'Optional month filter (1-12)',
          },
        },
        required: ['country_code'],
      },
    },
  },
];
