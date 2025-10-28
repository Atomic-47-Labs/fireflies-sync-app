import { useState, useEffect } from 'react';
import { BrowserCompatibilityScreen } from './components/BrowserCompatibilityScreen';
import { Onboarding } from './components/Onboarding';
import { EnhancedDashboard } from './components/EnhancedDashboard';
import { db } from './lib/db';
import { apiClient } from './lib/api';
import { decryptValue } from './lib/utils/crypto';
import { useAppStore } from './stores/appStore';
import './App.css';

function App() {
  const [browserCompatible, setBrowserCompatible] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const { setAuthenticated, setDirectory, setDirectoryPermission } = useAppStore();

  useEffect(() => {
    checkExistingSetup();
  }, []);

  const checkExistingSetup = async () => {
    try {
      // Check if onboarding was completed
      const completed = await db.getConfig<boolean>('onboarding_completed');
      
      if (completed) {
        // Restore API key
        const encryptedKey = await db.getConfig<string>('api_key_encrypted');
        const userEmail = await db.getConfig<string>('user_email');
        
        if (encryptedKey && userEmail) {
          try {
            const apiKey = await decryptValue(encryptedKey);
            apiClient.setApiKey(apiKey);
            setAuthenticated(apiKey, userEmail);
          } catch (error) {
            console.error('Failed to decrypt API key:', error);
            // Onboarding will be required again
            return;
          }
        }

        // Restore directory handle
        const directoryHandle = await db.getConfig<FileSystemDirectoryHandle>('directory_handle');
        const directoryPath = await db.getConfig<string>('directory_path_display');
        
        if (directoryHandle && directoryPath) {
          try {
            // Request permission to use the saved handle
            const permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
              setDirectory(directoryHandle, directoryPath);
              console.log('Directory handle restored:', directoryPath);
            } else {
              console.log('Directory permission denied, will need to re-select');
              setDirectoryPermission(false);
            }
          } catch (error) {
            console.error('Failed to restore directory handle:', error);
            setDirectoryPermission(false);
          }
        }

        setOnboardingComplete(true);
      }
    } catch (error) {
      console.error('Failed to check existing setup:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleOnboardingComplete = () => {
    setOnboardingComplete(true);
  };

  const handleResetSetup = () => {
    setOnboardingComplete(false);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!browserCompatible) {
    return (
      <BrowserCompatibilityScreen
        onContinue={() => setBrowserCompatible(true)}
      />
    );
  }

  if (!onboardingComplete) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return <EnhancedDashboard onResetSetup={handleResetSetup} />;
}

export default App;
