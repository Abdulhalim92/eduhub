"use client";

import Link from "next/link";
import { Navigation, MapPin } from "lucide-react";
import { C, FH } from "@/lib/data";

export type Bbox = [number, number, number, number]; // minLng, minLat, maxLng, maxLat

// эквидистантная (линейная) проекция lat/lng → % внутри bbox.
// Для областей размером со страну/город даёт достаточную точность без карт-библиотеки.
function project(lat: number, lng: number, bbox: Bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 100;
  return { x, y };
}

function osmSrc(bbox: Bbox, marker?: { lat: number; lng: number }) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  let src = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik`;
  if (marker) src += `&marker=${marker.lat}%2C${marker.lng}`;
  return src;
}

/** Карта одного учреждения (профиль): точка + встроенный OSM-маркер + маршрут во внешнем навигаторе. */
export function SingleMap({ lat, lng, height = 220, routeLabel }: { lat: number; lng: number; height?: number; routeLabel?: string }) {
  const d = 0.012;
  const bbox: Bbox = [lng - d, lat - d, lng + d, lat + d];
  // deep-link во внешний навигатор — без API-ключей и своей маршрутизации;
  // на телефоне открывает нативное приложение с голосовой навигацией
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${C.border}` }}>
      <div style={{ height }}>
        <iframe
          src={osmSrc(bbox, { lat, lng })}
          style={{ width: "100%", height: "100%", border: "none" }}
          loading="lazy"
          title="map"
        />
      </div>
      <a
        href={directionsHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", background: C.s2, borderTop: `1px solid ${C.border}`, color: C.teal, fontFamily: FH, fontWeight: 700, fontSize: 13, textDecoration: "none" }}
      >
        <Navigation size={14} /> {routeLabel ?? "Построить маршрут"}
      </a>
    </div>
  );
}

export interface MapPointItem {
  id: number | string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  href: string;
}

/** Карта региона: базовая подложка OSM + свои pin-маркеры поверх (без API-ключа и JS-карт-библиотеки). */
export function RegionMap({ points, bbox, height = 460 }: { points: MapPointItem[]; bbox: Bbox; height?: number }) {
  return (
    <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", border: `1px solid ${C.border}`, height }}>
      <iframe
        src={osmSrc(bbox)}
        style={{ width: "100%", height: "100%", border: "none" }}
        loading="lazy"
        title="map"
      />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {points.map((p) => {
          const { x, y } = project(p.lat, p.lng, bbox);
          if (x < 0 || x > 100 || y < 0 || y > 100) return null;
          return (
            <Link
              key={p.id}
              href={p.href}
              title={p.label}
              style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-100%)", pointerEvents: "auto" }}
            >
              <MapPin size={28} style={{ color: p.color, filter: "drop-shadow(0 3px 5px rgba(0,0,0,.5))" }} fill={p.color} stroke="#fff" strokeWidth={1.5} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
