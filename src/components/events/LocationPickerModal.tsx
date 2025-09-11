import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

declare global { interface Window { google?: any } }

interface LocationPickerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (data: { lat: number; lng: number; name: string }) => void;
  initialCenter?: { lat: number; lng: number };
}

const DEFAULT_CENTER = { lat: 25.2854, lng: 51.5310 }; // Doha

export default function LocationPickerModal({ open, onOpenChange, onConfirm, initialCenter }: LocationPickerModalProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const gmapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchInputDomRef = useRef<HTMLInputElement | null>(null);
  const goTimerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const selectedRef = useRef<{ lat?: number; lng?: number; label?: string }>({});
  type LatLng = { lat: number; lng: number };
  // Map ID for vector map + Advanced Markers
  // Read directly from env to ensure we always pass it to Map options
  const ENV_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;

  useEffect(() => {
    if (!open) return;

    const init = () => {
      if (!window.google || !mapRef.current) return;

      const center = initialCenter || DEFAULT_CENTER;
      const gmap = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        mapId: ENV_MAP_ID,
      });
      gmapRef.current = gmap;
      if (!ENV_MAP_ID) { try { console.warn('[Maps] VITE_GOOGLE_MAPS_MAP_ID is not set'); } catch {} }

      // Prefer AdvancedMarkerElement when available (Vector map with Map ID)
      if (window.google?.maps?.marker?.AdvancedMarkerElement) {
        markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          map: gmap,
          position: center,
          gmpDraggable: true,
        });
      } else {
        // Rare fallback if marker library isn't available
        markerRef.current = new window.google.maps.Marker({
          position: center,
          map: gmap,
          draggable: true,
        });
      }

      // Track selection defaults to map center
      selectedRef.current = { lat: center.lat, lng: center.lng, label: '' };

      // Dragend handler (works for both AdvancedMarkerElement and Marker)
      const geocoder = new window.google.maps.Geocoder();
      if (window.google?.maps?.event?.addListener) {
        window.google.maps.event.addListener(markerRef.current, 'dragend', async (e: any) => {
          const latLng = e?.latLng || markerRef.current.getPosition?.();
          if (!latLng) return;
          const pos: LatLng = {
            lat: typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat,
            lng: typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng,
          };
          selectedRef.current = { ...selectedRef.current, ...pos };
          try {
            const res: any = await geocoder.geocode({ location: pos });
            const addr = res.results?.[0]?.formatted_address;
            if (addr) { selectedRef.current.label = addr; setPlaceName(addr); }
          } catch {}
        });
      }

      // New Places element (no legacy). We control resolution via Geocoder.
      if (searchContainerRef.current && window.google?.maps?.places?.PlaceAutocompleteElement) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search places';
        input.className = 'w-full rounded-xl border border-border/40 bg-white/5 px-3 py-2';
        searchContainerRef.current.innerHTML = '';
        searchContainerRef.current.appendChild(input);
        searchInputDomRef.current = input;

        const pac = new window.google.maps.places.PlaceAutocompleteElement({ inputElement: input });
        // Do NOT append pac to DOM to avoid a second black search bar.

        const geocoder = new window.google.maps.Geocoder();
        const resolveAndMove = async (query: string) => {
          const gmap = gmapRef.current;
          if (!gmap || !query) return;
          try {
            const resp: any = await geocoder.geocode({ address: query });
            const gg = resp?.results?.[0]?.geometry?.location;
            if (!gg) return;
            const pos = { lat: typeof gg.lat === 'function' ? gg.lat() : gg.lat, lng: typeof gg.lng === 'function' ? gg.lng() : gg.lng };
            gmap.setCenter(pos);
            try { gmap.setZoom(16); } catch {}
            // AdvancedMarkerElement uses the `position` property
            markerRef.current.position = pos as any;
            selectedRef.current.lat = pos.lat;
            selectedRef.current.lng = pos.lng;
            selectedRef.current.label = resp?.results?.[0]?.formatted_address || query;
          } catch (err) {
            try { console.warn('[Geocode failed]', err); } catch {}
          }
        };

        // Enter key fallback
        input.addEventListener('keydown', async (ke: KeyboardEvent) => {
          if (ke.key !== 'Enter') return;
          await resolveAndMove((searchInputDomRef.current?.value || '').trim());
        });

        // Handle selection from new element by geocoding its name/address
        pac.addEventListener('gmp-placeselect', async (event: any) => {
          try { event.preventDefault && event.preventDefault(); } catch {}
          const place = event?.place || event?.detail?.place;
          let query = input.value.trim();
          try { if (place?.fetchFields) await place.fetchFields({ fields: ['displayName', 'formattedAddress'] }); } catch {}
          if (place?.displayName) query = place.displayName;
          if (!query && place?.formattedAddress) query = place.formattedAddress;
          await resolveAndMove(query);
        });
      }

      setReady(true);
    };

    // Try to use geolocation for modal center
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mapRef.current) return;
          init();
          try {
            const posLL = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            gmapRef.current?.setCenter(posLL);
            markerRef.current?.setPosition(posLL);
          } catch {}
        },
        () => {
          init();
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    } else {
      init();
    }
  }, [open, initialCenter]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        const posLL: LatLng = { lat, lng };
        gmapRef.current?.setCenter(posLL);
        markerRef.current.position = posLL as any;
        selectedRef.current.lat = lat;
        selectedRef.current.lng = lng;
        try {
          const geocoder = new window.google.maps.Geocoder();
          const res: any = await geocoder.geocode({ location: posLL });
          const addr = res.results?.[0]?.formatted_address;
          if (addr) { selectedRef.current.label = addr; setPlaceName(addr); }
        } catch {}
        // Immediately confirm and close
        onConfirm({ lat, lng, name: selectedRef.current.label || 'Current Location' });
        onOpenChange(false);
      },
      (err) => { try { console.warn('[Use My Location] failed', err); } catch {} },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirm = () => {
    let { lat, lng, label } = selectedRef.current;
    if (!lat || !lng) {
      // Fallback to marker position
      const m = markerRef.current;
      const latLng = m?.getPosition?.() || m?.position;
      if (latLng) {
        lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
        lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
      }
    }
    if (!lat || !lng) {
      // Final fallback: map center
      const c = gmapRef.current?.getCenter?.();
      if (c) {
        lat = c.lat();
        lng = c.lng();
      }
    }
    if (!lat || !lng) return;
    onConfirm({ lat, lng, name: label || placeName || 'Selected Location' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick Location</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <div ref={searchContainerRef} className="w-full rounded-xl border border-border/40 bg-background/60 p-0.5 relative z-[200] overflow-visible" />
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Go to this place"
                title="Go to this place"
                className="text-xs bg-primary/90 hover:bg-primary text-primary-foreground border border-border/40 rounded-md px-3 py-1"
                onClick={async () => {
                  try {
                    const typed: string = (searchInputDomRef.current?.value || '').trim();
                    if (!typed) return;
                    // Use Geocoder only to avoid legacy/new API warnings
                    const geocoder = new window.google.maps.Geocoder();
                    const resp: any = await geocoder.geocode({ address: typed });
                    const gg = resp?.results?.[0]?.geometry?.location;
                    if (!gg) return;
                    const pos = { lat: gg.lat(), lng: gg.lng() };
                    const gmap = gmapRef.current; if (!gmap) return;
                    gmap.setCenter(pos);
                    try { gmap.setZoom(16); } catch {}
                    markerRef.current.position = pos as any;
                    selectedRef.current.lat = pos.lat;
                    selectedRef.current.lng = pos.lng;
                    selectedRef.current.label = resp?.results?.[0]?.formatted_address || typed;
                  } catch {}
                }}
              >
                Go
              </button>
            </div>
          </div>
          <div ref={mapRef} className="w-full h-80 rounded-md border border-border/40" />
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={useMyLocation}>Use My Location</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleConfirm} disabled={!ready}>Confirm</Button>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Drag the pin to fine-tune the position.</div>
      </DialogContent>
    </Dialog>
  );
}
