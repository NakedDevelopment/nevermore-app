import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ChevronLeftIcon from '../../assets/icons/chevron-left';
import { LEGAL_WEBVIEW_DARK_THEME_SCRIPT } from '../../constants/legalWebViewTheme';

const TERMS_URL =
  'https://app.termly.io/policy-viewer/policy.html?policyUUID=4d86445f-a733-464e-9fd4-62714484c1d5';

export const TermsAndConditions: React.FC = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon width={24} height={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nevermore</Text>
          <View style={styles.headerSpacer} />
        </View>

        <WebView
          source={{ uri: TERMS_URL }}
          style={styles.webView}
          injectedJavaScript={LEGAL_WEBVIEW_DARK_THEME_SCRIPT}
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator
              style={StyleSheet.absoluteFillObject}
              color="#8B5CF6"
              size="large"
            />
          )}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    backgroundColor: '#131313',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: '#ffffff',
    fontFamily: 'Cinzel_600SemiBold',
    letterSpacing: 2,
  },
  headerSpacer: {
    width: 40,
  },
  webView: {
    flex: 1,
    backgroundColor: '#131313',
  },
});

export default TermsAndConditions;
