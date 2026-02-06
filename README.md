# PTG Financial Dashboard

A comprehensive financial dashboard for Park Terrace Gardens with authentication, AI insights, and multi-month data visualization.

## Features

- 🔐 **Authentication** - Secure login with password management
- 📊 **Interactive Charts** - NOI trends, expense breakdowns, variance analysis
- 🤖 **AI Insights** - Automated financial analysis and recommendations
- 📅 **Multi-Month View** - Compare data across different periods
- 🎨 **Customizable** - Filter and personalize your dashboard view

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env.local` file with:

```env
NEXTAUTH_SECRET=your-secret-key-here
# Optional: NextAuth can infer from the request host; if you set this, keep it in sync with your current URL/port.
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=your-openai-api-key
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## Deployment to Vercel

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Tech Stack

- **Framework**: Next.js 14
- **Authentication**: NextAuth.js
- **Charts**: Chart.js + react-chartjs-2
- **AI**: OpenAI GPT-4
- **Styling**: CSS Modules
- **Deployment**: Vercel
