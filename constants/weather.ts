import { WeatherType } from '@/api/polvo/interfaces/forecast'
import {
  Sun,
  Moon,
  Sunrise,
  Sunset,
  CloudSun,
  CloudMoon,
  Cloud,
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
  'twilight-dawn': Sunrise,
  'twilight-dusk': Sunset,
  'mostly-cloudy-day': Cloud,
  'mostly-cloudy-night': Cloud,
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
  'gale-day': Tornado,
  'gale-night': Tornado,
} as const
