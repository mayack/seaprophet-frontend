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
  Zap,
  AlertTriangle,
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
  'stormy-day': CloudLightning,
  'stormy-night': CloudLightning,
  'windy-day': Wind,
  'windy-night': Wind,
  'rain-day': CloudRain,
  'rain-night': CloudRain,
  'drizzle-day': CloudDrizzle,
  'drizzle-night': CloudDrizzle,
  'thunder-day': Zap,
  'thunder-night': Zap,
  gale: AlertTriangle,
} as const
