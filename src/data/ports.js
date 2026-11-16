import '../../assets/ports-data.js'
import '../../assets/world-land.js'

const countryDisplay = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['zh-CN'], { type: 'region' })
  : null

const numberDisplay = new Intl.NumberFormat('zh-CN')

export const sizeLabels = {
  Large: '大型',
  Medium: '中型',
  Small: '小型',
  'Very Small': '很小型',
}

export const typeLabels = {
  'Coastal (Natural)': '海岸天然港',
  'Coastal (Breakwater)': '海岸防波堤港',
  'Coastal (Tide Gates)': '海岸闸门港',
  'Open Roadstead': '开放锚地港',
  'River (Natural)': '天然河道港',
  'River (Basins)': '河道港池港',
  'River (Tide Gates)': '河道潮汐闸门港',
  'Canal or Lake': '运河或湖泊港',
  'Typhoon Harbor': '防台风港',
}

export const useLabels = {
  Cargo: '货运',
  Fishing: '渔业',
  Ferry: '渡运',
  Military: '军用',
}

export const worldLand = window.WORLD_LAND_DATA
export const dataMeta = window.PORTUS_DATA_META

export function normalizeSearch(value) {
  return String(value || '').toLocaleLowerCase().replace(/[\s\-_/().,·]+/g, '')
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export function formatCount(value) {
  return numberDisplay.format(value)
}

export function formatDepth(value) {
  return typeof value === 'number' ? `${value} m` : '未记录'
}

export function formatCoordinate(value, positive, negative) {
  return `${Math.abs(value).toFixed(3)}°${value >= 0 ? positive : negative}`
}

export function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function displayCountry(port) {
  if (!countryDisplay) return port.country
  try {
    return countryDisplay.of(port.countryCode) || port.country
  } catch {
    return port.country
  }
}

const sourcePorts = Array.isArray(window.PORTUS_PORTS) ? window.PORTUS_PORTS : []

export const ports = sourcePorts.map((port) => {
  const displayName = port.nameZh || port.name
  const countryZh = displayCountry(port)
  const searchText = normalizeSearch([
    displayName,
    port.name,
    port.alt,
    port.code,
    port.locode,
    `WPI ${port.wpi}`,
    port.wpi,
    port.country,
    countryZh,
    port.countryCode,
    port.region,
    port.sourceRegion,
    port.water,
    port.size,
    sizeLabels[port.size],
    port.type,
    typeLabels[port.type],
    port.use,
    useLabels[port.use],
    ...port.aliases,
    ...port.tags,
  ].filter(Boolean).join(' '))

  return { ...port, displayName, countryZh, searchText }
})

export const regions = ['全部', '亚洲', '欧洲', '中东', '北美洲', '南美洲', '非洲', '大洋洲', '南极洲']
