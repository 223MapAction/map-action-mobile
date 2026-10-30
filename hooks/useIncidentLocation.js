import * as Location from 'expo-location';
import { useState } from 'react';
import { getZoneFromOSM } from '../services/general';

// Géolocalisation + géocodage inverse pour les écrans de signalement
// d'incident (citoyen et agent). La précision GPS diffère selon
// l'appelant (accuracy/timeInterval), donc paramétrée plutôt que figée.
export function useIncidentLocation({ accuracy = Location.Accuracy.High, timeInterval, defaultZoneName = 'Bamako' } = {}) {
  const [location, setLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState(false);
  const [zoneName, setZoneName] = useState(defaultZoneName);

  const obtenirPosition = async () => {
    setLoadingLocation(true);
    setLocationError(false);

    try {
      const serviceEnabled = await Location.hasServicesEnabledAsync();
      if (!serviceEnabled) {
        setLocationError(true);
        setLoadingLocation(false);
        return;
      }

      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const request = await Location.requestForegroundPermissionsAsync();
        status = request.status;
      }

      if (status !== 'granted') {
        setLocationError(true);
        setLoadingLocation(false);
        return;
      }

      const positionOptions = { accuracy };
      if (timeInterval) positionOptions.timeInterval = timeInterval;
      let currentLocation = await Location.getCurrentPositionAsync(positionOptions);

      let addressData = null;
      try {
        let address = await Location.reverseGeocodeAsync({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        if (address && address.length > 0) {
          addressData = address[0];
        }
      } catch (geocodeErr) {
        console.log("Impossible de récupérer l'adresse (hors-ligne)");
      }

      setLocation({
        coords: currentLocation.coords,
        address: addressData,
      });

      let zoneTrouvee = false;
      try {
        const zoneRecuperee = await getZoneFromOSM(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
        if (zoneRecuperee && zoneRecuperee !== 'Zone inconnue') {
          setZoneName(zoneRecuperee);
          zoneTrouvee = true;
        }
      } catch (apiError) {
        // Échec API / réseau, on tente un repli ci-dessous
      }

      if (!zoneTrouvee) {
        if (addressData?.city) {
          setZoneName(addressData.city);
        } else {
          setZoneName('Zone non récupérée');
        }
      }
    } catch (error) {
      setLocationError(true);
    } finally {
      setLoadingLocation(false);
    }
  };

  return { location, loadingLocation, locationError, zoneName, obtenirPosition };
}
