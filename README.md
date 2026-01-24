# Financial Insights Chatbot - Next.js + Supabase

## Features

- 🧠 **Agentic Chatbot** - Conversational AI that responds with inline citations
- 📚 **Vector Database** - Powered by Supabase pgvector for semantic document search
- 📊 **SQL Database** - PostgreSQL for structured data (CPI, file status tracking)
- 🔄 **Interactive Loader** - Load and manage source documents
- 📝 **Citation Popovers** - Click citations to view source excerpts and URLs
- 🛠️ **Function Calling** - Fetch real-time GDP growth, exchange rates, and inflation data
- ✅ **Input Validation** - Prevents prompt injection and filters profanity
- 📥 **Export History** - Download chat conversations as JSON
- 🎨 **Modern UI** - Built with React, TypeScript, and Tailwind CSS

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React** - Component-based UI

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL with pgvector extension
  - Real-time subscriptions
  - Row-level security
- **OpenAI API** - GPT-4o-mini for chat completions and function calling
- **HuggingFace API** - Sentence transformers for embeddings

### Data Sources
- IMF World Economic Outlook
- OECD Economic Outlook
- OECD CPI Monthly Data

## Prerequisites

- **Node.js** 18+ and npm/yarn/pnpm
- **Supabase Account** - [Sign up for free](https://supabase.com)
- **OpenAI API Key** - [Get your key](https://platform.openai.com)

## Setup Instructions

### 1. Install Dependencies

```bash
cd nextjs-migration
npm install
# or
yarn install
# or
pnpm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API to get your credentials
3. Go to SQL Editor and run the schema from `supabase-schema.sql`

This will:
- Enable the pgvector extension
- Create tables for documents, file_load_status, and cpi_monthly
- Create indexes for efficient querying
- Set up the similarity search function

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# HuggingFace Configuration
HUGGINGFACE_API_KEY=hf_your-huggingface-api-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-key
SUPABASE_SECRET_KEY=your-key

# Application Configuration
NODE_ENV=development
```

### 4. Prepare Data Files

The application expects data files in the parent directory:

```
data/
└── original/
    ├── imf_weo/
    │   ├── imf-weo-apr-2025.pdf
    │   └── imf-weo-oct-2024.pdf
    ├── oecd/
    │   ├── oecd-economic-outlook-interim-report-september-2025-en.pdf
    │   └── oecd-economic-outlook-volume-2025-issue-1-202506-en.pdf
    └── oecd_cpi_monthly/
        └── oecd-prices-202309-202509.csv
```

The metadata for these files must be entered into config/data_sources.yaml.

### 5. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Load Documents

1. Click the **"Load DB"** button in the sidebar
2. Choose **"Load Registered Files"** to load registered files marked as not loaded
3. Or choose **"Reload All Files"** to clear and reload everything
4. Wait for the loading process to complete

The status indicator will turn green once documents are loaded.

## Usage

### Asking Questions

Simply type your question in the input box and press Enter or click Send. Examples:

- "What is the GDP growth forecast for the USA in 2025?"
- "What are the main economic risks mentioned in recent reports?"
- "How does inflation in Germany compare to other countries?"

### Viewing Citations

Click on any citation (e.g., `[imf-weo-apr-2025.pdf, p.32]`) to view:
- Source name and file
- Original document URL
- The exact text excerpt used

### Using Function Calling

The chatbot can fetch real-time data:

- **GDP Growth**: "What is the real GDP growth for France in 2024?"
- **Exchange Rates**: "What is the exchange rate between USD and EUR?"
- **CPI Data**: "What is the inflation rate for Germany in 2025?"

### Exporting Chat History

Click **"📥 Export Chat History"** in the sidebar to download your conversation as a JSON file.

## Deployment

### Deploy to Vercel

The easiest way to deploy is using Vercel:

```bash
npm install -g vercel
vercel
```

Make sure to set environment variables in your Vercel project settings.

### Deploy to Other Platforms

This Next.js app can be deployed to any platform that supports Node.js:
- Netlify
- AWS Amplify
- Google Cloud Run
- DigitalOcean App Platform

## Troubleshooting

### Vector Store Issues

- **Empty database**: Use the "Load DB" button to import documents
- **Slow similarity search**: Check that the ivfflat index was created properly
- **Out of memory**: Reduce batch size in `dataLoaderService.ts`

### API Errors

- **OpenAI rate limits**: Add retry logic or upgrade your OpenAI plan
- **Supabase connection**: Check your project is not paused (free tier)
- **CORS errors**: Ensure API routes are properly configured

### Data Loading

- **File not found**: Verify data files are in the correct directory structure
- **Parse errors**: Check CSV format matches expected columns
- **Embedding timeouts**: HuggingFace API may need warmup time

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building for Production

```bash
npm run build
npm start
```

## License

MIT

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase and OpenAI documentation
3. Check Next.js documentation for framework-specific issues

## Acknowledgments

- Uses IMF and OECD data sources
- Powered by OpenAI GPT-4o-mini
- Embeddings by Sentence Transformers
