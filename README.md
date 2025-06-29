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

## Geolocation System

Simple and efficient geolocation handling:

### 📍 Location Features

- **Standard/High Accuracy**: Simple toggle between standard (fast) and high accuracy (GPS) modes
- **Smart Caching**: 5-minute cache for location data to avoid repeated requests
- **Session Persistence**: Location survives page refreshes

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

## Type System

Simple and maintainable TypeScript definitions:

### 🏗️ Type Architecture

- **Unified Responses**: Single `ActionResponse<T>` interface for all API responses
- **Inline Component Props**: Direct prop types instead of separate interfaces
- **Flattened Data Structures**: Simplified nested API responses where possible
- **Minimal Redundancy**: Removed duplicate and unused type definitions

### 📝 Type Guidelines

- Use inline types for simple component props
- Create interfaces only when reused across multiple files
- Prefer composition over deep nesting
- Keep API response types close to their usage

## Error Handling

Simple and consistent error management:

### 🚨 Error Strategy

- **Standard Errors**: Use native `Error` objects with meaningful messages
- **Error Types**: Simple categorization (`auth`, `network`, `validation`, `unknown`)
- **Consistent Responses**: Unified error format across all API actions
- **Minimal Logging**: Essential errors only, no excessive console output

### 🛠️ Error Guidelines

- Throw errors close to where they occur
- Use `getErrorMessage()` for consistent error extraction
- Avoid complex error hierarchies and custom classes
- Handle auth errors with simple retry logic

## Component Architecture

Unified and simplified component design:

### 🗺️ Map Integration

- **Unified MapNavigator**: Combines map display with integrated spot carousel overlay
- **Dynamic Content**: Spot cards update automatically when panning/zooming the map
- **Smart Caching**: Efficient loading and caching of spots based on map viewport
- **Responsive Design**: Carousel adapts to screen size (2-4 spots visible)

### 🎯 Simplification Benefits

- **Single Component**: Replaced separate `UserLocationSpots` + `Navigator` components
- **Unified State**: Single source of truth for map spots and user location
- **Better UX**: Contextual spot information directly overlaid on the map
- **Reduced Complexity**: Fewer components to maintain and debug

## Project Structure

```
frontend/
├── app/                    # Next.js app router pages
├── components/             # Reusable UI components
├── contexts/              # React contexts (User, Theme)
├── lib/                   # Utility libraries
├── utils/                 # Helper functions
├── api/                   # API client implementations
├── types/                 # Core TypeScript definitions
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
