import { WeatherType } from '@/api/polvo/interfaces/forecast'
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudLightning,
  Wind,
  CloudRain,
  CloudDrizzle,
  CloudRainWind,
  CloudFog,
  CloudHail,
} from 'lucide-react'
import { LucideProps } from 'lucide-react'

// Note: `mostly-cloudy-night` intentionally reuses the day icon because
// Lucide has no "cloud + moon (overcast)" glyph. The night state is still
// conveyed by surrounding UI (timestamp, theme).
export const WEATHER_ICONS: Record<
  WeatherType,
  React.ComponentType<LucideProps>
> = {
  'clear-day': Sun,
  'clear-night': Moon,
  'partly-cloudy-day': CloudSun,
  'partly-cloudy-night': CloudMoon,
  'mostly-cloudy-day': Cloud,
  'mostly-cloudy-night': Cloud,
  'stormy-day': CloudRainWind,
  'stormy-night': CloudRainWind,
  'windy-day': Wind,
  'windy-night': Wind,
  'heavy-rain-day': CloudHail,
  'heavy-rain-night': CloudHail,
  'rain-day': CloudRain,
  'rain-night': CloudRain,
  'drizzle-day': CloudDrizzle,
  'drizzle-night': CloudDrizzle,
  'thunder-day': CloudLightning,
  'thunder-night': CloudLightning,
  'fog-day': CloudFog,
  'fog-night': CloudFog,
  'light-fog-day': CloudFog,
  'light-fog-night': CloudFog,
  'gale-day': Wind,
  'gale-night': Wind,
} as const
