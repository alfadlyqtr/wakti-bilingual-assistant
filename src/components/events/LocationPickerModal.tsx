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
  const [ready, setReady] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const selectedRef = useRef<{ lat?: number; lng?: number; label?: string }>({});
  type LatLng = { lat: number; lng: number };

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
      });
      gmapRef.current = gmap;

      // Create draggable AdvancedMarkerElement if available, else fallback
      if (window.google?.maps?.marker?.AdvancedMarkerElement) {
        markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          map: gmap,
          position: center,
          gmpDraggable: true,
        });
      } else {
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

      // New PlaceAutocompleteElement rendered in container (no duplicate input)
      if (searchContainerRef.current && window.google?.maps?.places?.PlaceAutocompleteElement) {
        const pac = new window.google.maps.places.PlaceAutocompleteElement({});
        // stretch and style the element
        (pac as any).style.display = 'block';
        (pac as any).style.width = '100%';
        searchContainerRef.current.innerHTML = '';
        searchContainerRef.current.appendChild(pac as unknown as Node);
        pac.addEventListener('gmp-placeselect', async (event: any) => {
          const place = event?.place || event?.detail?.place;
          if (!place) return;
          try {
            if (place.fetchFields) {
              await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
            }
          } catch {}
          const loc = place?.location || place?.geometry?.location;
          if (!loc) return;
          const pos: LatLng = {
            lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
            lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
          };
          gmap.setCenter(pos);
          if (markerRef.current.position !== undefined) {
            markerRef.current.position = pos;
          } else {
            markerRef.current.setPosition(pos as any);
          }
          selectedRef.current = {
            lat: pos.lat,
            lng: pos.lng,
            label: place?.displayName || place?.formattedAddress || '',
          };
          setPlaceName(selectedRef.current.label || '');
        });
      } else if (searchContainerRef.current && window.google?.maps?.places?.Autocomplete) {
        // Fallback legacy Autocomplete if new element not available
        // Create a single input inside the container
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search places';
        input.className = 'w-full rounded-xl border border-border/40 bg-white/5 px-3 py-2 mb-2';
        searchContainerRef.current.innerHTML = '';
        searchContainerRef.current.appendChild(input);
        const legacy = new window.google.maps.places.Autocomplete(input, {
          fields: ['geometry', 'name', 'formatted_address']
        });
        legacy.addListener('place_changed', () => {
          const place = legacy.getPlace();
          if (!place || !place.geometry) return;
          const loc = place.geometry.location;
          const pos: LatLng = { lat: loc.lat(), lng: loc.lng() };
          gmap.setCenter(pos);
          if (markerRef.current.position !== undefined) {
            markerRef.current.position = pos;
          } else {
            markerRef.current.setPosition(pos as any);
          }
          selectedRef.current = {
            lat: pos.lat,
            lng: pos.lng,
            label: place.name || place.formatted_address || ''
          };
          setPlaceName(selectedRef.current.label || '');
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
        if (markerRef.current.position !== undefined) {
          markerRef.current.position = posLL;
        } else {
          markerRef.current?.setPosition(posLL as any);
        }
        selectedRef.current.lat = lat;
        selectedRef.current.lng = lng;
        try {
          const geocoder = new window.google.maps.Geocoder();
          const res: any = await geocoder.geocode({ location: posLL });
          const addr = res.results?.[0]?.formatted_address;
          if (addr) { selectedRef.current.label = addr; setPlaceName(addr); }
        } catch {}
      },
      () => { /* optionally toast, but do not crash */ },
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
          <div ref={searchContainerRef} className="w-full rounded-xl border border-border/40 bg-background/60 p-0.5" />
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
