import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useRoute } from '@react-navigation/native';

import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { envoyerIncident } from "../api/incidents";
import { OfflineManager } from '../api/offlineManager';
import VideoRecorderModal from '../Composants/VideoRecorderModal';
import { COLORS } from '../Composants/themeConfig';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useIncidentLocation } from '../hooks/useIncidentLocation';
import { getAuthUser } from '../storage/authStorage';

const { width } = Dimensions.get('window');

export default function SignalerIncidentScreen() {
  const router = useRouter();
  const route = useRoute();
  const { photoUri: initialPhoto } = route.params || {};

  // ÉTATS GÉNÉRAUX
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState(null);

  const { location, loadingLocation, locationError, zoneName, obtenirPosition } =
    useIncidentLocation({ accuracy: Location.Accuracy.High });

  const { recording, audioUri, audioLevels, startRecording, stopRecording, deleteAudio } =
    useAudioRecorder({
      idleLevels: [1, 1, 1, 1, 1],
      normalizeLevel: (metering) => Math.max(4, Math.min(24, (metering + 160) / 6)),
      maxLevelsCount: 20,
      startErrorMessage: "Impossible de démarrer l'enregistrement audio.",
      stopErrorLogPrefix: 'Erreur stop audio:',
    });

  // ÉTATS MULTIMÉDIA
  const [photoUri, setPhotoUri] = useState(initialPhoto);
  const [videoUri, setVideoUri] = useState(null);
  const [videoThumbnail, setVideoThumbnail] = useState(null);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);

  // Charger les infos de l'utilisateur connecté
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await getAuthUser();
        setUser(userData);
      } catch (e) {
        setUser(null);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    obtenirPosition();
  }, []);

  const deleteVideo = () => {
    setVideoUri(null);
    setVideoThumbnail(null);
  };

  // Soumission de l'incident
  const handleSendIncident = async () => {
    if (!location) {
      Alert.alert("Erreur", "Impossible d'envoyer l'incident sans position GPS.");
      return;
    }

    setSending(true);

    const incidentData = {
      user_id: user?.id || null, 
      title: description ? (description.substring(0, 25) + "...") : "Incident anonyme",
      description: description || "",
      lattitude: location.coords.latitude.toString(),
      longitude: location.coords.longitude.toString(),
      zone: zoneName,
      photo: photoUri || "", 
      audio: audioUri || "", 
      video: videoUri || "", 
      etat: "declared",
    };

    try {
      const network = await NetInfo.fetch();
      
      if (network.isConnected) {
        const result = await envoyerIncident(incidentData);
        
        if (result && result.ok) {
          if (!user) {
            await OfflineManager.saveToAnonymousHistory(result.data);
          }
          Alert.alert("Succès", user ? "Incident envoyé avec succès !" : "Incident anonyme envoyé avec succès !");
          router.replace('/(tabs)');
        } else {
          throw new Error("Erreur serveur");
        }
      } else {
        const saved = await OfflineManager.saveForLater(incidentData);
        if (saved) {
          Alert.alert(
            "Mode Hors-ligne", 
            "Pas de connexion. L'incident a été enregistré localement et sera envoyé dès que vous aurez internet.",
            [{ text: "OK", onPress: () => router.replace('/(tabs)') }]
          );
        }
      }
    } catch (error) {
      const savedFallback = await OfflineManager.saveForLater(incidentData);
      if (savedFallback) {
        Alert.alert(
          "Incident sauvegardé", 
          "Une erreur réseau est survenue, mais votre incident a été mis en sécurité localement.",
          [{ text: "OK", onPress: () => router.replace('/(tabs)') }]
        );
      }
    } finally {
      setSending(false);
    }
  };

  if (!loadingLocation && locationError) {
    return (
      <View style={styles.containerBlocked}>
        <Ionicons name="location-off" size={80} color="#e74c3c" />
        <Text style={styles.blockedTitle}>Localisation requise</Text>
        <Text style={styles.blockedText}>
          Impossible de signaler un incident sans coordonnées GPS. Veuillez activer votre GPS et autoriser l'application à accéder à votre position.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={obtenirPosition}>
          <Text style={styles.retryBtnText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Signaler un incident</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="black" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* SECTION MULTIMEDIA : PHOTOS & VIDEOS */}
        <View style={styles.cardsRow}>
          <View style={[styles.card, photoUri && styles.cardActive]}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.cardImage} />
            ) : (
              <Ionicons name="camera" size={40} color="gray" />
            )}
            <Text style={styles.cardText}>Photo</Text>
            {photoUri && (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.card, videoUri && styles.cardActive]}
            onPress={() => setShowVideoRecorder(true)}
          >
            {videoThumbnail ? (
              <Image source={{ uri: videoThumbnail }} style={styles.cardImage} />
            ) : (
              <Ionicons name={videoUri ? "videocam" : "videocam-outline"} size={40} color={videoUri ? COLORS.primary : "gray"} />
            )}
            <Text style={[styles.cardText, !videoUri && {color: 'gray'}]}>Vidéo (Max 30s)</Text>
            {videoUri && (
              <>
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                </View>
                <TouchableOpacity style={styles.videoTrashBadge} onPress={deleteVideo}>
                  <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* CHAMP TEXTE : DESCRIPTION */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description (Facultatif)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Décrivez le problème ici..."
            multiline={true}
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </View>

        {/* COMPOSANT AUDIO SIMPLE ET INTEGRÉ */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Audio (Max 30s)</Text>
          <View style={[styles.audioContainer, audioUri && styles.audioContainerActive]}>
            {recording ? (
              // En cours d'enregistrement
              <View style={styles.audioActiveRow}>
                <View style={styles.pulseDot} />
                <View style={styles.waveContainer}>
                  {audioLevels.map((level, index) => (
                    <View key={index} style={[styles.waveBar, { height: level }]} />
                  ))}
                </View>
                <TouchableOpacity style={styles.stopIconBtn} onPress={stopRecording}>
                  <MaterialIcons name="stop" size={24} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ) : audioUri ? (
              // Audio enregistré
              <View style={styles.audioActiveRow}>
                <View style={styles.audioSuccessContainer}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  <Text style={styles.audioSuccessText}>Vocal enregistré</Text>
                </View>
                <TouchableOpacity style={styles.trashIconBtn} onPress={deleteAudio}>
                  <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ) : (
              // En attente d'enregistrement
              <TouchableOpacity style={styles.audioPlaceholderBtn} onPress={startRecording}>
                <MaterialIcons name="mic-none" size={22} color="gray" style={{ marginRight: 8 }} />
                <Text style={styles.audioPlaceholderText}>Appuyer pour enregistrer un vocal</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* MODULE DE GÉOLOCALISATION */}
        <View style={styles.locationGroup}>
          <Text style={styles.label}>Position de l'incident</Text>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={24} color={COLORS.red1} />
            <View style={styles.locationTextData}>
              {loadingLocation ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Text style={styles.addressText}>{zoneName}, {location?.address?.street || 'Position actuelle'}</Text>
                  <Text style={styles.coordsText}>{location?.coords.latitude.toFixed(5)}, {location?.coords.longitude.toFixed(5)}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* BOUTON D'ACTION PRINCIPAL */}
        <TouchableOpacity 
          style={[styles.submitBtn, (sending || loadingLocation) && {backgroundColor: 'gray'}]} 
          onPress={handleSendIncident}
          disabled={sending || loadingLocation}
        >
          {sending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Envoyer l'incident</Text>
              <Ionicons name="send" size={20} color="white" style={{marginLeft: 10}} />
            </>
          )}
        </TouchableOpacity>

      </ScrollView>

      <VideoRecorderModal
        visible={showVideoRecorder}
        maxDuration={30}
        onClose={() => setShowVideoRecorder(false)}
        onConfirm={(uri, thumbnail) => {
          setVideoUri(uri);
          setVideoThumbnail(thumbnail);
          setShowVideoRecorder(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 50, paddingBottom: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: COLORS.gray2 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'black' },
  closeBtn: { position: 'absolute', right: 20, top: 50 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  cardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  card: { width: width * 0.43, height: width * 0.43, backgroundColor: 'white', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.gray2, elevation: 2, overflow: 'hidden' },
  cardActive: { borderColor: COLORS.primary, borderWidth: 2 },
  cardImage: { ...StyleSheet.absoluteFillObject, resizeMode: 'cover' },
  cardText: { marginTop: 10, fontWeight: '600', fontSize: 15, color: COLORS.primary },
  checkBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'white', borderRadius: 12 },
  videoTrashBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'white', borderRadius: 12, padding: 4 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: COLORS.secondary, marginBottom: 8 },
  textArea: { backgroundColor: 'white', borderRadius: 12, padding: 15, height: 100, borderColor: COLORS.gray2, borderWidth: 1, fontSize: 16 },
  
  // NOUVEAU STYLE AUDIO SIMPLE ET EMBARQUÉ
  audioContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderColor: COLORS.gray2,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  audioContainerActive: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  audioPlaceholderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  audioPlaceholderText: {
    fontSize: 15,
    color: 'gray',
  },
  audioActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
  },
  audioSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioSuccessText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  trashIconBtn: {
    padding: 8,
  },
  stopIconBtn: {
    padding: 8,
  },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e74c3c',
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#e74c3c',
    marginHorizontal: 1.5,
    borderRadius: 1.5,
  },

  locationGroup: { marginBottom: 30 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  locationTextData: { marginLeft: 12, flex: 1 },
  addressText: { fontSize: 15, fontWeight: '600', color: COLORS.secondary },
  coordsText: { fontSize: 12, color: COLORS.gray1, marginTop: 2 },
  submitBtn: { backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, borderRadius: 12 },
  submitBtnText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  
  containerBlocked: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#fcfcfc' },
  blockedTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, color: '#2c3e50' },
  blockedText: { fontSize: 15, color: '#7f8c8d', textAlign: 'center', marginTop: 10, marginBottom: 30, lineHeight: 22 },
  retryBtn: { backgroundColor: COLORS.primary, width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
  retryBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { width: '100%', paddingVertical: 15, alignItems: 'center' },
  cancelBtnText: { color: '#7f8c8d', fontSize: 16, fontWeight: '600' },
});