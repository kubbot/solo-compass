"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { distanceMeters } from "@solo-compass/core";
import type { NearbyResult } from "@/app/api/experiences/nearby/route";
import { categoryEmoji } from "@/lib/category";
import { healthColor, healthLabel } from "@/lib/health";
import { paperCreamStyle } from "@/lib/map-style";
import { clientEnv } from "@/lib/env";
import { FilterBar, type FilterValue } from "@/components/FilterBar";
import { ExperienceList } from "@/components/ExperienceList";
import { track } from "@/lib/analytics";
import type { ExperienceCategory } from "@solo-compass/core";

const CHIANG_MAI_CENTER: [number, number] = [98.9853, 18.7883];
const DEFAULT_ZOOM = 14;
const REFETCH_PAN_METERS = 500;

// Current hour in local time (Chiang Mai = UTC+7)
function getLocalHour(): number {
  return new Date().getHours();
}

function isOpenNow(result: NearbyResult): boolean {
  const hour = getLocalHour();
  const windows = result.experience.bestTimes;
  if (!windows || windows.length === 0) return true;
  return windows.some((w) => hour >= w.startHour && hour < w.endHour);
}

function applyFilter(results: readonly NearbyResult[], filter: FilterValue): NearbyResult[] {
  if (filter === "all") return [...results];
  if (filter === "now") return results.filter(isOpenNow);
  return results.filter((r) => r.experience.category === (filter as ExperienceCategory));
}

interface DesktopLayoutProps {
  readonly results: readonly NearbyResult[];
  readonly isLoading: boolean;
  readonly selectedId: string | null;
  readonly filter: FilterValue;
  readonly onSelect: (id: string | null) => void;
  readonly onCenterChange: (center: [number, number]) => void;
  readonly onFilterChange: (f: FilterValue) => void;
}

export function DesktopLayout({
  results,
  isLoading,
  selectedId,
  filter,
  onSelect,
  onCenterChange,
  onFilterChange,
}: DesktopLayoutProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const filtered = applyFilter(results, filter);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      const r = results.find((x) => x.experience.id === id);
      if (r) {
        track({
          name: "marker_view",
          props: { experienceId: id, category: r.experience.category },
        });
        track({ name: "sheet_open", props: { experienceId: id, category: r.experience.category } });
      }
    },
    [onSelect, results],
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-paper-cream">
      {/* Left column — 320px fixed */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-muted-road">
        {/* Header */}
        <div className="px-4 py-3 border-b border-muted-road">
          <h1 className="text-base font-semibold text-ink-warm">Solo Compass</h1>
          <p className="text-xs text-ink-warm/50">Chiang Mai</p>
        </div>

        <FilterBar value={filter} onChange={onFilterChange} />

        {/* Sort label */}
        <div className="flex items-center justify-between px-4 py-2 text-xs text-ink-warm/50 border-b border-muted-road">
          <span>
            {isLoading && filtered.length === 0
              ? "Loading…"
              : `${filtered.length} experience${filtered.length !== 1 ? "s" : ""}`}
          </span>
          <span>Sorted by solo score</span>
        </div>

        <ExperienceList
          results={filtered}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={handleSelect}
          onHover={setHoveredId}
        />
      </aside>

      {/* Right column — map fills remaining space */}
      <div className="relative flex-1">
        <DesktopMapView
          results={filtered}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onCenterChange={onCenterChange}
          onMarkerClick={(id) => {
            onSelect(id);
            const r = results.find((x) => x.experience.id === id);
            if (r) {
              track({
                name: "marker_view",
                props: { experienceId: id, category: r.experience.category },
              });
            }
          }}
        />
      </div>
    </div>
  );
}

// ─── Desktop-specific MapView with hover pulse + fly-to ──────────────────────

interface DesktopMapViewProps {
  readonly results: readonly NearbyResult[];
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly onCenterChange: (center: [number, number]) => void;
  readonly onMarkerClick: (id: string) => void;
}

function DesktopMapView({
  results,
  selectedId,
  hoveredId,
  onSelect,
  onCenterChange,
  onMarkerClick,
}: DesktopMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const markerEls = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastReportedCenterRef = useRef<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const onCenterChangeRef = useRef(onCenterChange);
  const onSelectRef = useRef(onSelect);
  const onMarkerClickRef = useRef(onMarkerClick);
  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
  }, [onMarkerClick]);

  const reportCenter = useCallback((center: [number, number]) => {
    const last = lastReportedCenterRef.current;
    if (last && distanceMeters(last, center) < REFETCH_PAN_METERS) return;
    lastReportedCenterRef.current = center;
    onCenterChangeRef.current(center);
  }, []);

  // Mount map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    mapboxgl.accessToken = clientEnv.NEXT_PUBLIC_MAPBOX_TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: paperCreamStyle,
      center: CHIANG_MAI_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      setMapReady(true);
      const c = map.getCenter();
      reportCenter([c.lng, c.lat]);
    });
    map.on("idle", () => {
      const c = map.getCenter();
      reportCenter([c.lng, c.lat]);
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      markerEls.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [reportCenter]);

  // Geolocate once
  useEffect(() => {
    if (!mapReady) return;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: DEFAULT_ZOOM,
          duration: 1500,
        });
      },
      () => {},
      { timeout: 5000, maximumAge: 60_000 },
    );
  }, [mapReady]);

  // Render / update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    markerEls.current.clear();

    for (const result of results) {
      const { experience: exp, health } = result;
      const isSelected = exp.id === selectedId;

      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute(
        "aria-label",
        `${exp.title}, solo score ${exp.soloScore.overall}, ${healthLabel[health]}`,
      );
      el.className = [
        "relative flex h-11 w-11 items-center justify-center rounded-full",
        "bg-paper-cream/95 shadow-md ring-1 ring-ink-warm/15",
        "text-xl transition-all duration-200",
        "cursor-pointer focus:outline-none focus:ring-2 focus:ring-deep-teal",
        isSelected ? "scale-125 ring-2 ring-warm-amber shadow-warm-amber/30 shadow-lg" : "",
      ].join(" ");

      const emoji = document.createElement("span");
      emoji.textContent = categoryEmoji[exp.category];
      emoji.setAttribute("aria-hidden", "true");
      el.appendChild(emoji);

      const badge = document.createElement("span");
      badge.textContent = String(exp.soloScore.overall);
      badge.setAttribute("aria-hidden", "true");
      badge.className = [
        "absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center",
        "rounded-full bg-deep-teal px-1 text-[10px] font-semibold leading-none text-paper-cream",
        "ring-1 ring-paper-cream",
      ].join(" ");
      el.appendChild(badge);

      const dot = document.createElement("span");
      dot.setAttribute("aria-hidden", "true");
      dot.className =
        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-1 ring-paper-cream";
      dot.style.backgroundColor = healthColor[health];
      el.appendChild(dot);

      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onMarkerClickRef.current(exp.id);
      });

      const [lon, lat] = exp.location.coordinates;
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
      markersRef.current.set(exp.id, marker);
      markerEls.current.set(exp.id, el);
    }
  }, [results, mapReady, selectedId]);

  // Hover pulse effect: scale 1.3 + glow on hovered marker
  useEffect(() => {
    markerEls.current.forEach((el, id) => {
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;
      if (isSelected) {
        el.style.transform = "scale(1.25)";
        el.style.boxShadow = "0 0 0 3px rgba(198,142,63,0.4)";
      } else if (isHovered) {
        el.style.transform = "scale(1.3)";
        el.style.boxShadow = "0 0 12px 4px rgba(47,107,107,0.35)";
      } else {
        el.style.transform = "";
        el.style.boxShadow = "";
      }
    });
  }, [hoveredId, selectedId]);

  // Fly to selected experience when selectedId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId) return;
    const result = results.find((r) => r.experience.id === selectedId);
    if (!result) return;
    const [lon, lat] = result.experience.location.coordinates;
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
  }, [selectedId, results, mapReady]);

  // Click on empty map dismisses selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const handler = () => onSelectRef.current(null);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [mapReady]);

  // My location button handler
  const handleMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: DEFAULT_ZOOM,
          duration: 900,
        });
      },
      () => {},
      { timeout: 8000, maximumAge: 30_000 },
    );
  }, []);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {/* My location button */}
      <button
        type="button"
        onClick={handleMyLocation}
        aria-label="Go to my location"
        className={[
          "absolute right-14 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full",
          "bg-paper-cream shadow-md ring-1 ring-ink-warm/15 text-ink-warm",
          "hover:bg-ink-warm hover:text-paper-cream transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-deep-teal",
        ].join(" ")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
    </>
  );
}
