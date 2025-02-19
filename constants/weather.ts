import { WeatherType } from '@/api/polvo/interfaces/forecast'
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  CloudLightning,
  Wind,
  CloudRain,
  CloudDrizzle,
  CloudRainWind,
  CloudFog,
  Tornado,
} from 'lucide-react'
import { LucideProps } from 'lucide-react'

export const WEATHER_ICONS: Record<
  WeatherType,
  React.ComponentType<LucideProps>
> = {
  'clear-day': Sun,
  'clear-night': Moon,
  'partly-cloudy-day': CloudSun,
  'partly-cloudy-night': CloudMoon,
  'stormy-day': CloudRainWind,
  'stormy-night': CloudRainWind,
  'windy-day': Wind,
  'windy-night': Wind,
  'rain-day': CloudRain,
  'rain-night': CloudRain,
  'drizzle-day': CloudDrizzle,
  'drizzle-night': CloudDrizzle,
  'thunder-day': CloudLightning,
  'thunder-night': CloudLightning,
  'fog-day': CloudFog,
  'fog-night': CloudFog,
  gale: Tornado,
} as const
