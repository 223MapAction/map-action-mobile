/**
 * Récupère le nom de la zone à partir des coordonnées géographiques via Mapbox
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Nom de la zone ou "Zone inconnue"
 */
export const getZoneFromCoordinates = async (latitude, longitude) => {
 
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_SECRET_TOKEN;
  
  console.log("-> [MAPBOX CALL] Token chargé :", mapboxToken ? "OUI (Masqué)" : "NON TROUVÉ (Vérifie le .env)");

  if (!mapboxToken) {
    console.error("-> [ERROR] Le token Mapbox est manquant dans les variables d'environnement !");
    return "Zone inconnue";
  }

  // Ordre Mapbox impératif : Longitude, puis Latitude
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}`;

  try {
    const response = await fetch(url);
    
    // CORRECTION ICI : On extrait le JSON correctement
    const data = await response.json(); 
    
    console.log("-> [SUCCESS] Réponse de localisation Mapbox reçue");
    console.log("long :", longitude);
    console.log("lat :", latitude);
    
    // Affiche proprement le tableau 'features' reçu dans ton terminal
    if (data.features) {
      console.log("Features trouvées :", JSON.stringify(data.features, null, 2));
    } else {
      console.log("Aucune feature dans la réponse. Réponse brute :", data);
    }
      
    // Retourne le texte principal (ex: "Sébénikoro") ou se rabat sur le nom complet si besoin
    return data.features?.[0]?.text || data.features?.[0]?.place_name || "Zone inconnue";

  } catch (error) {
    // console.error("-> [ERROR] Erreur lors de la récupération de la zone :", error);
    return "Zone inconnue";
  }
};

/**
 * Récupère le nom du quartier ou de la zone via l'API inversée d'OpenStreetMap (Nominatim)
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Nom du quartier (suburb), de la ville ou "Zone inconnue"
 */
export const getZoneFromOSM = async (latitude, longitude) => {
  
  console.log(`-> [OSM CALL] Coordonnées reçues : Lat: ${latitude} | Long: ${longitude}`);

  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    console.error("-> [ERROR] Coordonnées invalides fournies à OpenStreetMap.");
    return "Zone inconnue";
  }

  // URL Nominatim OpenStreetMap (format jsonv2 pour avoir une structure d'adresse propre)
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // IMPORTANT : OpenStreetMap demande un User-Agent pour identifier ton application
        'User-Agent': 'MapActionApp/1.0 (React Native Expo App)'
      }
    });

    const data = await response.json();

    console.log("-> [SUCCESS] Réponse OpenStreetMap reçue");
    
    if (data && data.address) {
      console.log("-> [DIAGNOSTIC OSM] Adresse complète trouvée :", data.display_name);

      // Champs fins (quartier/village) : ambigus seuls (ex. un village peut exister
      // dans plusieurs régions), donc combinés avec city/state ci-dessous.
      const FINE_FIELDS = ['suburb', 'neighbourhood', 'village', 'town', 'city_district', 'municipality'];
      // Champs larges : suffisamment explicites seuls, utilisés en repli ou en contexte.
      const BROAD_FIELDS = ['city', 'county', 'state_district', 'state'];

      const preciseZone = FINE_FIELDS.map(field => data.address[field]).find(Boolean);

      if (preciseZone) {
        const context = data.address.city || data.address.state;
        return context && context !== preciseZone ? `${preciseZone}, ${context}` : preciseZone;
      }

      const broadZone = BROAD_FIELDS.map(field => data.address[field]).find(Boolean);

      return broadZone || "Zone inconnue";
    }

    console.warn("-> [WARN] Aucun composant d'adresse trouvé pour ces coordonnées.");
    return "Zone inconnue";

  } catch (error) {
    // console.error("-> [ERROR] Erreur lors de la récupération de la zone via OSM :", error);
    return "Zone inconnue";
  }
};