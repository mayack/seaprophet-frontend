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

// Human-readable condition labels, surfaced as the weather icon's tooltip /
// accessible name. Day and night share a label except where the wording
// naturally differs (e.g. "Sunny" vs "Clear").
export const WEATHER_LABELS: Record<WeatherType, string> = {
  'clear-day': 'Sunny',
  'clear-night': 'Clear',
  'partly-cloudy-day': 'Partly cloudy',
  'partly-cloudy-night': 'Partly cloudy',
  'mostly-cloudy-day': 'Mostly cloudy',
  'mostly-cloudy-night': 'Mostly cloudy',
  'stormy-day': 'Stormy',
  'stormy-night': 'Stormy',
  'windy-day': 'Windy',
  'windy-night': 'Windy',
  'heavy-rain-day': 'Heavy rain',
  'heavy-rain-night': 'Heavy rain',
  'rain-day': 'Rain',
  'rain-night': 'Rain',
  'drizzle-day': 'Drizzle',
  'drizzle-night': 'Drizzle',
  'thunder-day': 'Thunderstorm',
  'thunder-night': 'Thunderstorm',
  'fog-day': 'Fog',
  'fog-night': 'Fog',
  'light-fog-day': 'Light fog',
  'light-fog-night': 'Light fog',
  'gale-day': 'Gale',
  'gale-night': 'Gale',
} as const
