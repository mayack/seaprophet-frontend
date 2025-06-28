# Seaprophet Frontend

This is the frontend application for Seaprophet, built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 🌊 Real-time surf forecast data
- 📍 Location-based spot recommendations
- 🗺️ Interactive maps with Mapbox
- 📱 Responsive design for mobile and desktop
- 🔐 User authentication and personalization
- ⚙️ Customizable unit preferences
- 📸 Webcam integration for surf spots

## Enhanced Geolocation System

The application features an advanced geolocation system designed for optimal performance and user experience:

### 🎯 Adaptive Accuracy
- **Standard Accuracy**: Used for nearby spots and general features (faster, battery-friendly)
- **High Accuracy**: Used for precise mapping and navigation (GPS-level precision)
- **Progressive Fallback**: Automatically falls back from high to standard accuracy if needed

### ⚡ Smart Caching
- **5-minute cache** for location data to avoid repeated requests
- **Accuracy-aware caching**: Different cache durations based on precision requirements
- **Session persistence**: Location survives page refreshes

### 🔄 Intelligent Timeouts
- **Progressive timeouts**: Longer timeouts for initial GPS lock, shorter for subsequent requests
- **Use case optimization**: Different timeout strategies for maps vs. nearby spots
- **Retry mechanisms**: Automatic fallback strategies on failure

### 📊 Location Quality Indicators
- Real-time accuracy feedback to users
- Quality assessment (excellent/good/fair/poor)
- Visual indicators for location confidence

### 🛡️ Privacy & Security
- HTTPS-only geolocation access
- Clear permission explanations
- Configurable via Netlify Permissions Policy
- Graceful error handling for denied permissions

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_SARGO_API_URL=your_sargo_api_url
NEXT_PUBLIC_POLVO_API_URL=your_polvo_api_url
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS
- **State Management**: React Context
- **HTTP Client**: Fetch API
- **Deployment**: Netlify

## Project Structure

```
frontend/
├── app/                    # Next.js app router pages
├── components/             # Reusable UI components
├── contexts/              # React contexts (User, Theme)
├── lib/                   # Utility libraries
├── utils/                 # Helper functions
├── api/                   # API client implementations
├── types/                 # TypeScript type definitions
└── constants/             # Configuration constants
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is private and proprietary.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
