import regions from '../assets/ukraine-regions.json';
import districts from '../assets/ukraine-districts.json';

export interface Location {
  id: string;
  name: string;
  regionId: string;
}

export const mapRegions = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
export const mapDistricts = [...districts].sort((a, b) => a.name.localeCompare(b.name, 'uk'));
export const mapAreas = [...mapRegions, ...mapDistricts];

const cityRegions: Record<string, string> = {
  'Біла Церква': 'UA-32', 'Бориспіль': 'UA-32', 'Бровари': 'UA-32', 'Буча': 'UA-32',
  'Ірпінь': 'UA-32', 'Фастів': 'UA-32', 'Кременчук': 'UA-53', 'Кривий Ріг': 'UA-12',
  'Вінниця': 'UA-05', 'Дніпро': 'UA-12', 'Донецьк': 'UA-14', 'Житомир': 'UA-18',
  'Запоріжжя': 'UA-23', 'Івано-Франківськ': 'UA-26', 'Кропивницький': 'UA-35', 'Луганськ': 'UA-09',
  'Луцьк': 'UA-07', 'Львів': 'UA-46', 'Миколаїв': 'UA-48', 'Одеса': 'UA-51',
  'Полтава': 'UA-53', 'Рівне': 'UA-56', 'Сімферополь': 'UA-43', 'Суми': 'UA-59',
  'Тернопіль': 'UA-61', 'Ужгород': 'UA-21', 'Харків': 'UA-63', 'Херсон': 'UA-65',
  'Хмельницький': 'UA-68', 'Черкаси': 'UA-71', 'Чернівці': 'UA-77', 'Чернігів': 'UA-74',
};

const cityDistricts: Record<string, string> = {
  'Біла Церква': 'Білоцерківський', 'Бориспіль': 'Бориспільський',
  'Бровари': 'Броварський', 'Буча': 'Бучанський', 'Ірпінь': 'Бучанський',
  'Фастів': 'Фастівський', 'Одеса': 'Одеський', 'Херсон': 'Херсонський',
};

const cityIds = new Set(['UA-30', 'UA-40']);
export const oblastOptions: Location[] = mapRegions.filter(region => !cityIds.has(region.id))
  .map(region => ({ id: region.id, name: region.name, regionId: region.id }));
export const districtOptions: Location[] = mapDistricts
  .map(district => ({ id: district.id, name: district.name, regionId: district.id }));
export const cityOptions: Location[] = [
  ...mapRegions.filter(region => cityIds.has(region.id))
    .map(region => ({ id: region.id, name: region.name, regionId: region.id })),
  ...Object.entries(cityRegions).map(([name, oblastId]) => {
    const district = mapDistricts.find(area => area.parentId === oblastId && area.label === cityDistricts[name]);
    return { id: `city-${name}`, name, regionId: district?.id ?? oblastId };
  }),
].sort((a, b) => a.name.localeCompare(b.name, 'uk'));

export function findLocation(id?: string | null) {
  return oblastOptions.find(location => location.id === id) ??
    cityOptions.find(location => location.id === id) ??
    districtOptions.find(location => location.id === id);
}
