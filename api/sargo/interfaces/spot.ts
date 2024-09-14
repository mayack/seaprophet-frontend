export interface SpotProps {
  id: number
  attributes: {
    name: string
    environment: string | null
    surf_wave_direction: string | null
    surf_localism: number
    surf_crowds: number
    facilities_dogs_allowed: boolean | null
    facilities_dogs_comment: string | null
    parking_paid: boolean | null
    parking_size: string | null
    location_lat: number
    location_long: number
    parking_camping_allowed: boolean | null
    surf_protected: boolean | null
    surf_wind_direction: string | null
    surf_swell_direction: string | null
    surf_season: string | null
    parking_coords_lat: number | null
    parking_coords_long: number | null
    surf_water_pollution: number | null
    surf_rating: number | null
    facilities: string | null
    parking_height_limit: number | null
    surf_wave_length: string | null
    facilities_camping_lat: number | null
    facilities_camping_long: number | null
    surf_wave_type: string | null
    camping_self_lat: number | null
    camping_self_long: number | null
    parking_comment: string | null
    beach_orientation_from: number | null
    beach_orientation_to: number | null
    surf_comment: string | null
    description: string | null
    surf_hazards: string | null
    surf_tides: string | null
    surf_height_from: number | null
    surf_height_to: number | null
    surf_break_types: string | null
    surf_bottom: string | null
    surf_consistency: number | null
    surf_skill_from: number | null
    surf_skill_to: number | null
    surf_walk: number | null
    createdAt: string
    updatedAt: string
    publishedAt: string
  }
}
