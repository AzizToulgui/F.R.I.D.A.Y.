import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export interface WeatherResult {
  location: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  windKph: number;
  condition: string;
  isDay: boolean;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

// WMO weather interpretation codes, as returned by Open-Meteo's `weather_code`.
const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function describeWeatherCode(code: number): string {
  return WEATHER_CODE_DESCRIPTIONS[code] ?? 'Unknown conditions';
}

// Open-Meteo - free, no API key required, used for both geocoding a place
// name and fetching current conditions. Node's built-in `fetch` is enough
// here, no HTTP client dependency needed.
@Injectable()
export class WeatherService {
  async getCurrentWeather(location: string): Promise<WeatherResult> {
    const geo = await this.geocode(location);
    if (!geo) {
      throw new NotFoundException(`Could not find a location matching "${location}".`);
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(geo.latitude));
    url.searchParams.set('longitude', String(geo.longitude));
    url.searchParams.set(
      'current',
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
    );
    url.searchParams.set('timezone', 'auto');

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      throw new ServiceUnavailableException('Could not reach the weather service right now.');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Could not reach the weather service right now.');
    }

    const data = (await response.json()) as {
      current?: {
        temperature_2m: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
        weather_code: number;
        is_day: number;
      };
    };
    if (!data.current) {
      throw new ServiceUnavailableException('The weather service returned an unexpected response.');
    }

    return {
      location: geo.label,
      latitude: geo.latitude,
      longitude: geo.longitude,
      temperatureC: data.current.temperature_2m,
      feelsLikeC: data.current.apparent_temperature,
      humidityPercent: data.current.relative_humidity_2m,
      windKph: data.current.wind_speed_10m,
      condition: describeWeatherCode(data.current.weather_code),
      isDay: data.current.is_day === 1,
    };
  }

  // Nominatim (OpenStreetMap), not Open-Meteo's own geocoding-api subdomain -
  // the latter was unreachable from this deployment's network path (verified
  // empirically: api.open-meteo.com, used for the forecast call above,
  // resolves and responds fine; geocoding-api.open-meteo.com times out on
  // every attempt despite resolving to a valid IP). Nominatim is free, needs
  // no API key, and works from here.
  private async geocode(location: string): Promise<GeocodeResult | null> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', location);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    // English display names, and enough candidates to prefer an actual
    // city/town over a same-named country or administrative region (e.g.
    // "Tunis" the city vs "Tunisia" the country, which Nominatim's default
    // ranking doesn't reliably disambiguate on its own).
    url.searchParams.set('accept-language', 'en');

    let response: Response;
    try {
      // Nominatim's usage policy requires an identifying User-Agent, or
      // requests may be blocked outright.
      response = await fetch(url, { headers: { 'User-Agent': 'FRIDAY-Assistant/1.0 (personal use)' } });
    } catch {
      throw new ServiceUnavailableException('Could not reach the location lookup service right now.');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Could not reach the location lookup service right now.');
    }

    const results = (await response.json()) as {
      lat: string;
      lon: string;
      display_name: string;
      addresstype: string;
    }[];
    if (results.length === 0) return null;

    const preferredTypes = new Set(['city', 'town', 'village', 'hamlet', 'municipality', 'suburb']);
    const best = results.find((r) => preferredTypes.has(r.addresstype)) ?? results[0];

    return { latitude: parseFloat(best.lat), longitude: parseFloat(best.lon), label: best.display_name };
  }
}
