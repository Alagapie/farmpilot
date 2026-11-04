"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Field } from "@/lib/sam";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export interface FlyTarget {
  lat: number;
  lon: number;
  zoom: number;
  key: number; // bump to re-trigger the same target
}

interface Props {
  fields: Field[];
  selected: Set<string>;
  scanPoint: [number, number] | null;
  flyTo: FlyTarget | null;
  onMapClick: (lat: number, lon: number, zoom: number) => void;
  onFieldClick: (id: string) => void;
}

function ClickHandler({ onMapClick }: Pick<Props, "onMapClick">) {
  const map = useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng, map.getZoom()),
  });
  return null;
}

function Flyer({ flyTo }: Pick<Props, "flyTo">) {
  const map = useMap();
  useEffect(() => {
    if (flyTo) map.flyTo([flyTo.lat, flyTo.lon], flyTo.zoom, { duration: 1.6 });
  }, [flyTo, map]);
  return null;
}

export default function FieldMap({ fields, selected, scanPoint, flyTo, onMapClick, onFieldClick }: Props) {
  return (
    <MapContainer center={[9.08, 8.68]} zoom={6} className="h-full w-full" zoomControl>
      <TileLayer
        url={`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`}
        attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
        maxNativeZoom={18}
        maxZoom={19}
      />
      <TileLayer url={`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`} maxNativeZoom={18} maxZoom={19} />
      <ClickHandler onMapClick={onMapClick} />
      <Flyer flyTo={flyTo} />
      {fields.map((f) => {
        const on = selected.has(f.id);
        return (
          <Polygon
            key={f.id}
            positions={f.polygon}
            bubblingMouseEvents={false}
            pathOptions={{
              color: on ? "#4ade80" : "#facc15",
              weight: on ? 3 : 1.5,
              fillColor: on ? "#22c55e" : "#facc15",
              fillOpacity: on ? 0.35 : 0.06,
            }}
            eventHandlers={{ click: () => onFieldClick(f.id) }}
          />
        );
      })}
      {scanPoint && (
        <CircleMarker center={scanPoint} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#ef4444", fillOpacity: 1 }} />
      )}
    </MapContainer>
  );
}
