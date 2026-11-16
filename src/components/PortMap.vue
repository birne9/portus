<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import { escapeHTML, formatCount, reducedMotion, worldLand } from '../data/ports'

const props = defineProps({
  ports: { type: Array, required: true },
  results: { type: Array, required: true },
  selectedId: { type: String, default: null },
})

const emit = defineEmits(['select'])
const mapElement = ref(null)
const mapFailed = ref(false)

let map = null
let markerLayer = null
let resizeObserver = null
let revealTimer = null
let revealedMarker = null
let revealRequestId = 0
const markers = new Map()
const worldCopies = new Map()

function createWorldLayer(offset = 0) {
  const layer = L.geoJSON(worldLand, {
    interactive: false,
    coordsToLatLng: (coords) => L.latLng(coords[1], coords[0] + offset),
    style: {
      className: 'world-land',
      color: '#35606a',
      weight: 0.65,
      fillColor: '#143b47',
      fillOpacity: 1,
      opacity: 0.9,
    },
  })
  layer.addTo(map).bringToBack()
  worldCopies.set(offset, layer)
}

function syncWorldCopies(offsets = [0]) {
  const wanted = new Set([0, ...offsets])
  worldCopies.forEach((layer, offset) => {
    if (!wanted.has(offset)) {
      map.removeLayer(layer)
      worldCopies.delete(offset)
    }
  })
  wanted.forEach((offset) => {
    if (!worldCopies.has(offset)) createWorldLayer(offset)
  })
  map.options.worldCopyJump = wanted.size === 1
}

function restoreBaseWorld() {
  if (!map) return
  props.ports.forEach((port) => {
    const marker = markers.get(port.id)
    if (!marker) return
    const position = marker.getLatLng()
    if (position.lat !== port.lat || position.lng !== port.lng) {
      marker.setLatLng([port.lat, port.lng])
    }
  })
  syncWorldCopies([0])
}

function updateActiveMarker() {
  markers.forEach((marker, id) => {
    const element = marker.getElement()
    if (element) element.classList.toggle('is-active', props.selectedId === id)
  })
}

function cancelPendingReveal() {
  revealRequestId += 1
  if (revealTimer !== null) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  if (revealedMarker) {
    revealedMarker.closeTooltip()
    revealedMarker = null
  }
  return revealRequestId
}

function updateMarkers(results = props.results) {
  if (!map || !markerLayer) return
  cancelPendingReveal()
  map.setView(map.getCenter(), map.getZoom(), { animate: false })
  markerLayer.clearLayers()
  restoreBaseWorld()
  markerLayer.addLayers(results.map((port) => markers.get(port.id)).filter(Boolean))
  updateActiveMarker()
}

function revealMarker(port) {
  if (!map || !markerLayer) return
  const marker = markers.get(port.id)
  if (!marker) return
  const requestId = cancelPendingReveal()
  const position = marker.getLatLng()
  if (reducedMotion()) map.setView(position, 7, { animate: false })
  else map.flyTo(position, 7, { duration: 1.1 })

  revealTimer = setTimeout(() => {
    revealTimer = null
    if (requestId !== revealRequestId || !markerLayer.hasLayer(marker)) return
    if (!map.hasLayer(marker) || !map.getBounds().contains(marker.getLatLng())) return
    marker.openTooltip()
    revealedMarker = marker
    updateActiveMarker()
  }, reducedMotion() ? 60 : 1150)
}

function shortestLongitudeArc(results) {
  const longitudes = results.map((port) => port.lng).sort((a, b) => a - b)
  let largestGap = -1
  let largestGapIndex = 0
  longitudes.forEach((lng, index) => {
    const next = index === longitudes.length - 1 ? longitudes[0] + 360 : longitudes[index + 1]
    const gap = next - lng
    if (gap > largestGap) {
      largestGap = gap
      largestGapIndex = index
    }
  })
  const start = longitudes[(largestGapIndex + 1) % longitudes.length]
  const span = 360 - largestGap
  const rawCenter = start + span / 2
  const center = ((rawCenter + 180) % 360 + 360) % 360 - 180
  return { center, span }
}

function fitResults(results = props.results) {
  if (!map || !results.length) return
  cancelPendingReveal()
  if (results.length === props.ports.length) {
    resetMapView()
    return
  }
  if (results.length === 1) {
    revealMarker(results[0])
    return
  }

  const arc = shortestLongitudeArc(results)
  const adjusted = results.map((port) => {
    const offset = 360 * Math.round((arc.center - port.lng) / 360)
    return { port, lat: port.lat, lng: port.lng + offset, offset }
  })
  syncWorldCopies(adjusted.map((point) => point.offset))
  adjusted.forEach((point) => {
    const marker = markers.get(point.port.id)
    if (marker) marker.setLatLng([point.lat, point.lng])
  })
  const bounds = L.latLngBounds(adjusted.map((point) => [point.lat, point.lng]))
  const padding = map.getSize().x < 640 ? 22 : 55
  map.fitBounds(bounds, { padding: [padding, padding], maxZoom: 5, animate: false })
}

function resetMapView() {
  if (!map) return
  cancelPendingReveal()
  map.setView([24, 24], 2, { animate: false })
  restoreBaseWorld()
}

function initMap() {
  try {
    map = L.map(mapElement.value, {
      center: [24, 24],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: false,
      scrollWheelZoom: false,
      worldCopyJump: true,
      attributionControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    for (let lat = -60; lat <= 60; lat += 30) {
      L.polyline([[lat, -180], [lat, 180]], {
        color: '#77a9aa', weight: 0.5, opacity: 0.14, interactive: false,
      }).addTo(map)
    }
    for (let lng = -150; lng <= 180; lng += 30) {
      L.polyline([[-85, lng], [85, lng]], {
        color: '#77a9aa', weight: 0.5, opacity: 0.14, interactive: false,
      }).addTo(map)
    }

    if (!worldLand) throw new Error('World map data unavailable')
    createWorldLayer()
    markerLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      disableClusteringAtZoom: 7,
      chunkedLoading: false,
      iconCreateFunction: (cluster) => L.divIcon({
        className: 'port-cluster',
        html: `<span>${formatCount(cluster.getChildCount())}</span>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
      }),
    }).addTo(map)

    props.ports.forEach((port) => {
      const icon = L.divIcon({
        className: `port-marker marker-${port.id}`,
        html: `<span class="marker-pin"><span class="marker-pulse"></span><span class="marker-core"></span><span class="marker-code">${escapeHTML(port.code)}</span></span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      const marker = L.marker([port.lat, port.lng], {
        icon,
        title: `${port.displayName} / ${port.code}`,
        keyboard: false,
        riseOnHover: true,
      })
      marker.bindTooltip(`${escapeHTML(port.displayName)} · ${escapeHTML(port.code)}`, {
        direction: 'top',
        offset: [0, -10],
      })
      marker.on('click', () => emit('select', port.id))
      markers.set(port.id, marker)
    })

    updateMarkers()
    resizeObserver = new ResizeObserver(() => map?.invalidateSize())
    resizeObserver.observe(mapElement.value)
  } catch (error) {
    console.error('Map initialization failed', error)
    mapFailed.value = true
  }
}

watch(() => props.results, (results) => updateMarkers(results))
watch(() => props.selectedId, updateActiveMarker)

onMounted(initMap)
onBeforeUnmount(() => {
  cancelPendingReveal()
  resizeObserver?.disconnect()
  map?.remove()
  map = null
})

defineExpose({ fitResults, resetMapView, revealMarker, cancelPendingReveal })
</script>

<template>
  <div class="map-wrap">
    <div id="map" ref="mapElement" role="application" aria-label="全球港口交互地图" />
    <div class="map-topline">
      <span class="map-badge">ATLAS VIEW / NGA PUB.150 · 2025.04</span>
      <van-button class="map-reset" size="small" icon="replay" @click="resetMapView">
        重置世界视图
      </van-button>
    </div>
    <div class="map-legend">
      <span><i class="legend-dot" />真实港口</span>
      <span>NGA Pub.150 · Natural Earth</span>
    </div>
    <div v-if="mapFailed" class="map-fallback">
      <div>
        <strong>海图暂时未能载入</strong>
        <span>你仍可通过港口列表与索引探索全部真实数据。<br>刷新页面即可重新加载交互地图。</span>
      </div>
    </div>
  </div>
</template>
