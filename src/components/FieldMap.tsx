"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { Field } from "@/lib/sam";
import type { LatLon } from "@/lib/geo";

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";

export interface FlyTarget {
  lat: number;
  lon: number;
  zoom: number;
  key: number; // bump to re-trigger the same target
}

export interface UserPos {
  lat: number;
  lon: number;
  accuracy: number; // metres
}

interface Props {
  fields: Field[];
  selected: Set<string>;
  userPos: UserPos | null;
  walkPoints: LatLon[];
  flyTo: FlyTarget | null;
  onMapClick: (lat: number, lon: number, zoom: number) => void;
  onFieldClick: (id: string, lat: number, lon: number) => void;
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

export default function FieldMap({ fields, selected, userPos, walkPoints, flyTo, onMapClick, onFieldClick }: Props) {
  const youIcon = useMemo(
    () => L.divIcon({ className: "", html: '<span class="you-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    [],
  );
  const cornerIcon = useMemo(
    () => L.divIcon({ className: "", html: '<span class="corner-dot"></span>', iconSize: [14, 14], iconAnchor: [7, 7] }),
    [],
  );
  const pickedIds = fields.filter((f) => selected.has(f.id)).map((f) => f.id);

  return (
    <MapContainer center={[9.08, 8.68]} zoom={6} className="h-full w-full">
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
        const plotNo = pickedIds.indexOf(f.id) + 1;
        return (
          <Polygon
            key={`${f.id}-${on}`}
            positions={f.polygon}
            bubblingMouseEvents={false}
            pathOptions={{
              color: on ? "#4ade80" : "#facc15",
              weight: on ? 3.5 : 1.5,
              fillColor: on ? "#22c55e" : "#facc15",
              fillOpacity: on ? 0.4 : 0.08,
            }}
            eventHandlers={{ click: (e) => onFieldClick(f.id, e.latlng.lat, e.latlng.lng) }}
          >
            {on ? (
              <Tooltip permanent direction="center" className="field-label field-label-on">
                {pickedIds.length > 1 ? `Plot ${plotNo}` : "Your farm"} · {f.hectares.toFixed(2)} ha
              </Tooltip>
            ) : (
              <Tooltip direction="top" className="field-label">
                {f.hectares.toFixed(2)} ha · tap to add
              </Tooltip>
            )}
          </Polygon>
        );
      })}

      {walkPoints.length > 0 && (
        <>
          {walkPoints.length >= 3 ? (
            <Polygon positions={walkPoints} pathOptions={{ color: "#38bdf8", weight: 3, dashArray: "6 6", fillOpacity: 0.25 }} />
          ) : (
            <Polyline positions={walkPoints} pathOptions={{ color: "#38bdf8", weight: 3, dashArray: "6 6" }} />
          )}
          {walkPoints.map((p, i) => (
            <Marker key={i} position={p} icon={cornerIcon} />
          ))}
        </>
      )}

      {userPos && (
        <>
          <Circle
            center={[userPos.lat, userPos.lon]}
            radius={userPos.accuracy}
            pathOptions={{ color: "#3b82f6", weight: 1, fillOpacity: 0.12 }}
            interactive={false}
          />
          <Marker position={[userPos.lat, userPos.lon]} icon={youIcon} interactive={false}>
            <Tooltip permanent direction="bottom" offset={[0, 10]} className="field-label">
              You are here
            </Tooltip>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
