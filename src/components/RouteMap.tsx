"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";

export interface MapPoint {
  lat: number;
  lon: number;
  label: string;
  kind: "you" | "farmer" | "market" | "truck" | "site";
}

const COLORS: Record<MapPoint["kind"], string> = { you: "#16a34a", farmer: "#e8a317", market: "#1d4ed8", truck: "#6b7280", site: "#7c3aed" };

function Fit({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 13 });
  }, [points, map]);
  return null;
}

export default function RouteMap({ points, route }: { points: MapPoint[]; route?: [number, number][] }) {
  const icons = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(COLORS).map(([k, c]) => [
          k,
          L.divIcon({
            className: "",
            html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${c};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        ]),
      ) as Record<MapPoint["kind"], L.DivIcon>,
    [],
  );
  return (
    <MapContainer center={[11.2, 7.6]} zoom={10} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}" attribution="Map &copy; Esri" />
      <Fit points={points} />
      {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: "#16a34a", weight: 4, dashArray: "8 6" }} />}
      {points.map((p, i) => (
        <Marker key={`${p.label}-${i}`} position={[p.lat, p.lon]} icon={icons[p.kind]}>
          <Tooltip direction="top" offset={[0, -8]} permanent={p.kind === "you" || p.kind === "market"} className="field-label">
            {p.label}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
